import { test, expect } from "@playwright/test";
import {
  mockGetUser,
  mockGetReport,
  mockShareReport,
  mockShareReportError,
} from "../helpers/mock-api";
import { TEST_USER, TEST_USER_WITH_INTAKE, FREE_REPORT } from "../helpers/fixtures";
import { openCachedReport, seedAuthenticatedReportShell } from "../helpers/report";

test.describe("Report — PDF & Share", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedAuthenticatedReportShell(page, TEST_USER);
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
  });

  test("PDF download button opens correct URL", async ({ page }) => {
    await openCachedReport(page);

    const pdfLink = page.getByRole("link", { name: /Descargar PDF/ });
    await expect(pdfLink).toBeVisible();
    const href = await pdfLink.getAttribute("href");
    expect(href).toContain("/api/me/report/pdf");
    expect(href).toContain("tier=free");
  });

  test("Share button generates link and copies to clipboard", async ({ page }) => {
    await mockShareReport(page);

    await openCachedReport(page);
    await page.getByRole("button", { name: /Compartir/ }).click();

    await expect(page.getByText("✓ Link copiado")).toBeVisible();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("report/shared/abc");
  });

  test("Share button shows error on failure", async ({ page }) => {
    await mockShareReportError(page);

    await openCachedReport(page);
    await page.getByRole("button", { name: /Compartir/ }).click();

    await expect(page.getByText("Error al compartir")).toBeVisible();
  });

  test("Locked premium section clicks scroll to upgrade CTA", async ({ page }) => {
    await openCachedReport(page);

    await page.getByText("Cómo trabajás mejor").click();
    await expect(page.getByText("✦ Continuación aplicada del informe")).toBeVisible();
    await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeVisible();
  });

  test("Basic users keep report actions bound to the allowed free tier", async ({ page, context }) => {
    const basicUser = {
      ...TEST_USER_WITH_INTAKE,
      plan: "basic",
      role: "user",
      status: "active",
    };
    let requestedTier: string | null = null;

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.unrouteAll();
    await seedAuthenticatedReportShell(page, TEST_USER);
    await mockGetUser(page, basicUser);
    await mockGetReport(page, FREE_REPORT);
    await page.route("**/api/me/report/share", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { tier?: string };
        requestedTier = body.tier ?? null;
        await route.fulfill({
          status: 200,
          json: { token: "basic-share", url: "http://localhost:3000/api/report/shared/basic-share" },
        });
      } else {
        await route.fallback();
      }
    });

    await openCachedReport(page);

    const pdfLink = page.getByRole("link", { name: /Descargar PDF/ });
    await expect(pdfLink).toBeVisible();
    await expect(pdfLink).toHaveAttribute("href", /tier=free/);

    await page.getByRole("button", { name: /Compartir/ }).click();
    await expect(page.getByText("✓ Link copiado")).toBeVisible();
    expect(requestedTier).toBe("free");
  });
});
