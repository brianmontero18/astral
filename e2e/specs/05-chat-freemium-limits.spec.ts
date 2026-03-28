import { test, expect } from "@playwright/test";
import { mockChatHistory, mockChatStream, mockChatStreamLimit, mockGetUser, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_NO_INTAKE, HISTORY_MESSAGES } from "../helpers/fixtures";

test.describe("Chat — Freemium Limits", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
  });

  test("Free user can send messages up to the limit", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 15 });
    await mockChatStream(page, ["Respuesta"], { userMsgId: 10, assistantMsgId: 11 });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Nuevo mensaje");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Respuesta")).toBeVisible();
  });

  test("Limit reached shows upgrade prompt", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 15, limit: 15 });
    await page.goto("/");

    await expect(page.getByText("Tu ventana al cosmos se ha completado")).toBeVisible();
    await expect(page.getByRole("link", { name: /[Dd]esbloquear/ })).toBeVisible();
  });

  test("Chat input is replaced by upgrade CTA when limit reached", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 15, limit: 15 });
    await page.goto("/");

    // Input should not be visible — replaced by upgrade CTA
    await expect(page.getByPlaceholder("Preguntá al oráculo")).not.toBeVisible();
    await expect(page.getByRole("link", { name: /[Dd]esbloquear/ })).toBeVisible();
  });

  test("Backend 403 triggers limit state", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 14, limit: 15 });
    await mockChatStreamLimit(page, 15, 15);
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Ultimo mensaje");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("Tu ventana al cosmos se ha completado")).toBeVisible();
  });
});
