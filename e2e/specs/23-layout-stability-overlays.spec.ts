import { test, expect, type Page } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectWithinViewport,
  VISUAL_SMOKE_STYLE,
} from "../helpers/layout";
import {
  mockChatHistory,
  mockGetAssets,
  mockGetReport,
  mockGetUser,
  mockHealth,
} from "../helpers/mock-api";
import {
  FREE_REPORT,
  HISTORY_MESSAGES,
  TEST_USER,
  TEST_USER_WITH_INTAKE,
} from "../helpers/fixtures";

const MOBILE_VIEWPORT = { width: 375, height: 812 };

const LAYOUT_ASSET = {
  id: "asset-layout",
  filename: "mi-carta-super-detallada-con-contexto-extendido-para-validar-breakpoints-y-ajuste-del-modal.txt",
  mimeType: "text/plain",
  fileType: "natal",
  sizeBytes: 1536,
  createdAt: "2026-04-21T10:00:00.000Z",
};

async function bootstrapLayoutSurface(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem("astral_user", JSON.stringify(user));
  }, TEST_USER);
  await mockHealth(page);
  await mockGetUser(page, TEST_USER_WITH_INTAKE);
  await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
  await mockGetReport(page, FREE_REPORT);
  await mockGetAssets(page, [LAYOUT_ASSET]);
  await page.route("**/api/assets/asset-layout", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: [
          "Resumen de layout.",
          "Esta preview existe para validar que el modal no se sale del viewport.",
          "La superficie debe seguir usable en desktop y mobile.",
        ].join("\n\n"),
      });
      return;
    }

    await route.fallback();
  });
  await page.goto("/");
  await page.addStyleTag({ content: VISUAL_SMOKE_STYLE });
}

function profilePanel(page: Page) {
  return page.locator("div").filter({
    has: page.getByRole("button", { name: /Generar mi informe/ }),
    hasText: "Plan actual",
  }).first();
}

async function openProfilePanel(page: Page) {
  await page.getByRole("button", { name: "Test User" }).click();
  await expect(page.getByText("✦ Perfil activo")).toBeVisible();
  return profilePanel(page);
}

async function assertLockedReportLayout(page: Page) {
  await page.getByRole("button", { name: /Generar mi informe/ }).click();
  await expect(page.getByText("Informe Personal")).toBeVisible();
  await expect(page.getByText("Cómo trabajás mejor")).toBeVisible();
  await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeVisible();
  await page.getByRole("link", { name: "Completar mi informe" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
}

async function openAssetPreview(page: Page) {
  await page.getByRole("button", { name: "Mis Cartas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Cartas" })).toBeVisible();
  await expect(page.getByText(LAYOUT_ASSET.filename)).toBeVisible();
  await page.getByRole("button", { name: "Ver" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Vista previa")).toBeVisible();
  await expect(page.getByText("Resumen de layout.")).toBeVisible();
  await expectWithinViewport(dialog, page);
  await expectNoHorizontalOverflow(page);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  return dialog;
}

test.describe("Responsive layout stability", () => {
  test("desktop overlays and locked report state stay inside the viewport", async ({ page }) => {
    await bootstrapLayoutSurface(page);

    const panel = await openProfilePanel(page);
    await expectWithinViewport(panel, page);
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot("desktop-profile-panel-layout-smoke.png", {
      animations: "disabled",
      caret: "hide",
    });

    await page.mouse.click(16, 16);
    await expect(page.getByText("✦ Perfil activo")).not.toBeVisible();

    await openProfilePanel(page);
    await assertLockedReportLayout(page);
    await expect(page).toHaveScreenshot("desktop-report-locked-layout-smoke.png", {
      animations: "disabled",
      caret: "hide",
    });
    await page.getByRole("button", { name: "Chat" }).click();

    const dialog = await openAssetPreview(page);
    await expect(page).toHaveScreenshot("desktop-asset-preview-layout-smoke.png", {
      animations: "disabled",
      caret: "hide",
    });

    await page.getByLabel("Cerrar vista previa").click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test.describe("mobile", () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test("mobile overlays and locked report state stay usable without overflow", async ({ page }) => {
      await bootstrapLayoutSurface(page);

      const panel = await openProfilePanel(page);
      await expectWithinViewport(panel, page);
      await expectNoHorizontalOverflow(page);
      await expect(page).toHaveScreenshot("mobile-profile-panel-layout-smoke.png", {
        animations: "disabled",
        caret: "hide",
      });

      await assertLockedReportLayout(page);
      await expect(page.getByText("Cómo trabajás mejor")).toBeVisible();
      await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeVisible();
      await page.getByRole("button", { name: "Chat" }).click();

      const dialog = await openAssetPreview(page);
      await expect(page).toHaveScreenshot("mobile-asset-preview-layout-smoke.png", {
        animations: "disabled",
        caret: "hide",
      });

      await page.getByLabel("Cerrar vista previa").click();
      await expect(dialog).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
      await expectNoHorizontalOverflow(page);
    });
  });
});
