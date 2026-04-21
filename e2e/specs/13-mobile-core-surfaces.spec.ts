import { test, expect } from "@playwright/test";

import {
  mockMediaDevicesDenied,
  mockMediaDevicesGranted,
} from "../helpers/mock-media";
import {
  expectNoHorizontalOverflow,
  expectWithinViewport,
  VISUAL_SMOKE_STYLE,
} from "../helpers/layout";
import {
  mockChatHistory,
  mockChatStream,
  mockGenerateReportError,
  mockGetAssets,
  mockGetAssetsError,
  mockGetReport,
  mockGetUser,
  mockHealth,
  mockTranscribe,
  mockTranscribeError,
  mockTransits,
  mockTransitsError,
} from "../helpers/mock-api";
import {
  FREE_REPORT,
  HISTORY_MESSAGES,
  TEST_USER,
  TEST_USER_NO_INTAKE,
  TEST_USER_WITH_INTAKE,
} from "../helpers/fixtures";

const MOBILE_VIEWPORT = { width: 375, height: 812 };

const MOBILE_ASSETS = [
  {
    id: "asset-mobile-1",
    filename: "mi-carta.pdf",
    mimeType: "application/pdf",
    fileType: "hd",
    sizeBytes: 204800,
    createdAt: "2026-04-20T12:00:00.000Z",
  },
];

test.describe("Mobile — Core Surfaces", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
  });

  test("chat, profile, report, transits, and assets stay usable on mobile without horizontal overflow", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await mockGetReport(page, FREE_REPORT);
    await mockTransits(page);
    await mockGetAssets(page, MOBILE_ASSETS);
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Test User" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Chat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tránsitos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mis Cartas" })).toBeVisible();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Grabar nota de voz" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectWithinViewport(page.getByRole("button", { name: "Test User" }), page);
    await expectWithinViewport(page.getByRole("button", { name: "Salir" }), page);

    await page.getByRole("button", { name: "Test User" }).click();
    await expect(page.getByText("✦ Perfil activo")).toBeVisible();
    await expect(page.getByRole("button", { name: /Generar mi informe/ })).toBeVisible();
    await expectWithinViewport(page.getByText("✦ Perfil activo"), page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();
    await page.getByText("Cómo trabajás mejor").click();
    await expect(page.getByText("✦ Continuación aplicada del informe")).toBeVisible();
    await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeVisible();
    await expectWithinViewport(page.getByRole("link", { name: "Completar mi informe" }), page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "← Volver" }).click();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();

    await page.getByRole("button", { name: "Tránsitos" }).click();
    await expect(page.getByText("Tránsitos de la Semana")).toBeVisible();
    await expect(page.getByText("Mar 28 – Apr 3, 2026")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Mis Cartas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Cartas" })).toBeVisible();
    await expect(page.getByText("mi-carta.pdf")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("mobile limit and failure states keep user-facing copy safe across report, transits, and assets", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 20, limit: 20 });
    await mockGetReport(page, null);
    await mockGenerateReportError(page, 500);
    await mockTransitsError(page, 401, "authentication_required");
    await mockGetAssetsError(page, 500);
    await page.goto("/");

    await expect(page.getByText("Tu ventana al cosmos de este mes se ha completado")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver planes Astral ✦" })).toBeVisible();
    await expect(page.getByText("message_limit_reached")).not.toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();
    await expect(page.getByTitle("Grabar con voz")).toHaveCount(3);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText("No se pudo generar el informe. Intentá de nuevo.")).toBeVisible();
    await expect(page.getByText("Generation failed")).not.toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Volver", exact: true }).click();
    await expect(page.getByText("Tu ventana al cosmos de este mes se ha completado")).toBeVisible();

    await page.getByRole("button", { name: "Tránsitos" }).click();
    await expect(page.getByText("Tu sesión se cerró o venció. Volvé a entrar para ver tus tránsitos.")).toBeVisible();
    await expect(page.getByText("authentication_required")).not.toBeVisible();
    await expect(page.getByText("Transits error 401")).not.toBeVisible();
    await expect(page.getByText("/api/transits")).not.toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Mis Cartas" }).click();
    await expect(page.getByText("No pudimos cargar tus archivos ahora.")).toBeVisible();
    await expect(page.getByText("Assets error 500")).not.toBeVisible();
    await expect(page.getByText("/api/me/assets")).not.toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("mobile logout returns to the public entry state without leaving protected controls on screen", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Test User" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Salir" }).click();

    await expect(page.getByRole("button", { name: "Test User" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Chat" })).not.toBeVisible();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).not.toBeVisible();
    await expect(page.getByText("Astral Guide", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("mobile voice flow stays usable during recording and after a successful transcription send", async ({ page }) => {
    await mockMediaDevicesGranted(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await mockTranscribe(page, "Necesito claridad para esta semana");
    await mockChatStream(page, ["Te acompaño con una lectura breve."], {
      userMsgId: 30,
      assistantMsgId: 31,
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Grabar nota de voz" }).click();

    const cancelButton = page.getByRole("button", { name: "Cancelar grabación" });
    const sendButton = page.getByRole("button", { name: "Enviar nota de voz" });
    await expect(cancelButton).toBeVisible();
    await expect(sendButton).toBeVisible();
    await expectWithinViewport(cancelButton, page);
    await expectWithinViewport(sendButton, page);
    await expectNoHorizontalOverflow(page);

    await sendButton.click();

    await expect(page.getByText("Necesito claridad para esta semana")).toBeVisible();
    await expect(page.getByText("Te acompaño con una lectura breve.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Grabar nota de voz" })).toBeVisible();
    await expect(page.getByPlaceholder("Preguntá al oráculo")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("mobile voice errors keep recovery actions visible and inside the viewport", async ({ page }) => {
    await mockMediaDevicesGranted(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockChatHistory(page, []);
    await mockTranscribeError(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Grabar nota de voz" }).click();
    await page.getByRole("button", { name: "Enviar nota de voz" }).click();

    const closeAfterTranscriptionError = page.getByRole("button", { name: "Cerrar" });
    await expect(page.getByText(/[Ee]rror al transcribir el audio/)).toBeVisible();
    await expect(closeAfterTranscriptionError).toBeVisible();
    await expectWithinViewport(closeAfterTranscriptionError, page);
    await expectNoHorizontalOverflow(page);

    await closeAfterTranscriptionError.click();
    await expect(page.getByRole("button", { name: "Grabar nota de voz" })).toBeVisible();

    await mockMediaDevicesDenied(page);
    await page.reload();

    await page.getByRole("button", { name: "Grabar nota de voz" }).click();
    await expect(page.getByText(/[Mm]icrófono bloqueado/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("mobile visual smoke stays stable on chat shell and locked report state", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await mockGetReport(page, FREE_REPORT);
    await mockTransits(page);
    await mockGetAssets(page, MOBILE_ASSETS);
    await page.goto("/");
    await page.addStyleTag({ content: VISUAL_SMOKE_STYLE });

    await expect(page.getByRole("button", { name: "Test User" })).toBeVisible();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Grabar nota de voz" })).toBeVisible();
    await expect(page).toHaveScreenshot("mobile-chat-shell-visual-smoke.png", {
      animations: "disabled",
      caret: "hide",
    });

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText("Cómo trabajás mejor")).toBeVisible();
    await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeVisible();
    await expect(page).toHaveScreenshot("mobile-report-locked-visual-smoke.png", {
      animations: "disabled",
      caret: "hide",
    });
  });
});
