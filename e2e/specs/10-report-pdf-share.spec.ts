import { test, expect } from "@playwright/test";
import { mockGetUser, mockGetReport, mockShareReport, mockShareReportError, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_WITH_INTAKE, FREE_REPORT } from "../helpers/fixtures";

test.describe("Report — PDF & Share", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.route("**/api/users/*/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { messages: [], used: 0, limit: 15 } });
      } else await route.fallback();
    });
  });

  test("PDF download button opens correct URL", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    const pdfLink = page.getByRole("link", { name: /Descargar PDF/ });
    await expect(pdfLink).toBeVisible();
    const href = await pdfLink.getAttribute("href");
    expect(href).toContain("/api/users/test-user-123/report/pdf");
    expect(href).toContain("tier=free");
  });

  test("Share button generates link and copies to clipboard", async ({ page }) => {
    await mockShareReport(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await page.getByRole("button", { name: /Compartir/ }).click();
    await expect(page.getByText("✓ Link copiado")).toBeVisible();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("report/shared/abc");
  });

  test('Share button shows "✓ Link copiado" after success', async ({ page }) => {
    await mockShareReport(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await page.getByRole("button", { name: /Compartir/ }).click();
    await expect(page.getByText("✓ Link copiado")).toBeVisible();
  });

  test("Share button shows error on failure", async ({ page }) => {
    await mockShareReportError(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await page.getByRole("button", { name: /Compartir/ }).click();
    await expect(page.getByText("Error al compartir")).toBeVisible();
  });

  test("Locked premium section clicks scroll to upgrade CTA", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    // Click on a locked premium section
    await page.getByText("Tu Definición").click();
    await expect(page.getByText("Desbloquear informe completo")).toBeVisible();
  });
});
