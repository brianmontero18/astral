import { test, expect, type Page } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectWithinViewport,
  VISUAL_SMOKE_STYLE,
} from "../helpers/layout";
import {
  mockChatHistory,
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

async function bootstrapLayoutSurface(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem("astral_user", JSON.stringify(user));
  }, TEST_USER);
  await mockHealth(page);
  await mockGetUser(page, TEST_USER_WITH_INTAKE);
  await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
  await mockGetReport(page, FREE_REPORT);
  await page.goto("/");
  await page.addStyleTag({ content: VISUAL_SMOKE_STYLE });
}

function profilePanel(page: Page) {
  return page.locator("div").filter({
    has: page.getByRole("button", { name: /Ver mi informe semanal/ }),
    hasText: "Plan actual",
  }).first();
}

async function openProfilePanel(page: Page) {
  await page.getByRole("button", { name: "Test User" }).click();
  await expect(page.getByText("✦ Perfil activo")).toBeVisible();
  return profilePanel(page);
}

async function assertLockedReportLayout(page: Page) {
  await page.getByRole("dialog", { name: "Perfil activo" }).getByRole("button", { name: /Ver mi informe semanal/ }).click();
  await expect(page.getByText("Informe Personal")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cómo trabajás mejor/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeVisible();
  await page.getByRole("link", { name: "Completar mi informe" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
}

test.describe("Responsive layout stability", () => {
  test("desktop overlays and locked report state stay inside the viewport", async ({ page }) => {
    await bootstrapLayoutSurface(page);

    const panel = await openProfilePanel(page);
    await expectWithinViewport(panel, page);
    await expectNoHorizontalOverflow(page);

    await page.mouse.click(16, 16);
    await expect(page.getByText("✦ Perfil activo")).not.toBeVisible();

    await openProfilePanel(page);
    await assertLockedReportLayout(page);
    await page.getByRole("button", { name: "Chat" }).click();
  });

  test.describe("mobile", () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test("mobile overlays and locked report state stay usable without overflow", async ({ page }) => {
      await bootstrapLayoutSurface(page);

      const panel = await openProfilePanel(page);
      await expectWithinViewport(panel, page);
      await expectNoHorizontalOverflow(page);

      await assertLockedReportLayout(page);
      await expect(page.getByRole("button", { name: /Cómo trabajás mejor/ })).toBeVisible();
      await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeVisible();
      await page.getByRole("button", { name: "Chat" }).click();
      await expectNoHorizontalOverflow(page);
    });
  });
});
