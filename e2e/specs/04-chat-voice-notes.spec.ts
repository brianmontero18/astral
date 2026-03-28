import { test, expect } from "@playwright/test";
import { mockChatHistory, mockChatStream, mockTranscribe, mockTranscribeError, mockGetUser, mockHealth } from "../helpers/mock-api";
import { mockMediaDevicesGranted, mockMediaDevicesDenied, mockMediaDevicesNotFound, mockNoMediaDevices } from "../helpers/mock-media";
import { TEST_USER, TEST_USER_NO_INTAKE } from "../helpers/fixtures";

test.describe("Chat — Voice Notes", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockChatHistory(page, []);
  });

  test("Mic button visible when input is empty and browser supports mediaDevices", async ({ page }) => {
    await mockMediaDevicesGranted(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Grabar nota de voz" })).toBeVisible();
  });

  test("Mic button hidden when input has text", async ({ page }) => {
    await mockMediaDevicesGranted(page);
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("algo");
    await expect(page.getByRole("button", { name: "Grabar nota de voz" })).not.toBeVisible();
  });

  test("Clicking mic starts recording and shows waveform", async ({ page }) => {
    await mockMediaDevicesGranted(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Grabar nota de voz" }).click();
    // Recording mode shows cancel and confirm buttons
    await expect(page.getByRole("button", { name: "Cancelar grabación" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar nota de voz" })).toBeVisible();
  });

  test("Clicking confirm sends audio to transcribe API and sends message", async ({ page }) => {
    await mockMediaDevicesGranted(page);
    await mockTranscribe(page, "texto transcrito");
    await mockChatStream(page, ["Respuesta al audio"], { userMsgId: 10, assistantMsgId: 11 });
    await page.goto("/");

    await page.getByRole("button", { name: "Grabar nota de voz" }).click();
    await page.getByRole("button", { name: "Enviar nota de voz" }).click();

    // Transcribed text is sent as a message directly (not placed in textarea)
    await expect(page.getByText("texto transcrito")).toBeVisible();
    await expect(page.getByText("Respuesta al audio")).toBeVisible();
  });

  test("Clicking cancel stops recording without transcribing", async ({ page }) => {
    await mockMediaDevicesGranted(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Grabar nota de voz" }).click();
    await page.getByRole("button", { name: "Cancelar grabación" }).click();

    // Back to normal input
    await expect(page.getByPlaceholder("Preguntá al oráculo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar grabación" })).not.toBeVisible();
  });

  test("Permission denied shows error message", async ({ page }) => {
    await mockMediaDevicesDenied(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Grabar nota de voz" }).click();
    await expect(page.getByText(/[Mm]icrófono bloqueado/)).toBeVisible();
  });

  test("No microphone found shows error message", async ({ page }) => {
    await mockMediaDevicesNotFound(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Grabar nota de voz" }).click();
    await expect(page.getByText(/[Nn]o se detectó ningún micrófono/)).toBeVisible();
  });

  test("Transcription error shows user-friendly message", async ({ page }) => {
    await mockMediaDevicesGranted(page);
    await mockTranscribeError(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Grabar nota de voz" }).click();
    await page.getByRole("button", { name: "Enviar nota de voz" }).click();

    await expect(page.getByText(/[Ee]rror al transcribir/)).toBeVisible();
  });

  test("Mic button hidden if browser does not support mediaDevices", async ({ page }) => {
    await mockNoMediaDevices(page);
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Grabar nota de voz" })).not.toBeVisible();
  });
});
