import { test, expect } from "@playwright/test";
import {
  mockGetUser,
  mockGetReport,
  mockUpdateUser,
  mockUpdateUserError,
  mockGenerateReport,
  mockGenerateReportError,
} from "../helpers/mock-api";
import { TEST_USER, TEST_USER_WITH_INTAKE, FREE_REPORT, REGENERATED_REPORT } from "../helpers/fixtures";
import {
  acceptNextDialog,
  dismissNextDialog,
  openReportEditor,
  seedAuthenticatedReportShell,
} from "../helpers/report";

test.describe("Report — Regeneration", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedReportShell(page, TEST_USER);
  });

  test("Basic users keep regeneration bound to the allowed free tier", async ({ page }) => {
    const basicUser = {
      ...TEST_USER_WITH_INTAKE,
      plan: "basic",
      role: "user",
      status: "active",
    };
    const generatedReportTiers: string[] = [];

    await mockGetUser(page, basicUser);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUser(page);
    await page.route("**/api/me/report", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/me/report") {
        const body = request.postDataJSON() as { tier?: string };
        generatedReportTiers.push(body.tier ?? "missing");
        await route.fulfill({ status: 200, json: REGENERATED_REPORT });
      } else {
        await route.fallback();
      }
    });

    acceptNextDialog(page);

    await openReportEditor(page);
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    expect(generatedReportTiers).toEqual(["free"]);
  });

  test("Confirm dialog appears before regeneration when report exists", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUser(page);

    let confirmCalled = false;
    page.once("dialog", async (dialog) => {
      confirmCalled = true;
      await dialog.dismiss();
    });

    await openReportEditor(page);
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    expect(confirmCalled).toBe(true);
  });

  test("Canceling confirm dialog does not regenerate", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);

    let postCalled = false;
    await page.route("**/api/me/report", async (route) => {
      if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/api/me/report") {
        postCalled = true;
        await route.fulfill({ status: 200, json: FREE_REPORT });
      } else {
        await route.fallback();
      }
    });

    dismissNextDialog(page);

    await openReportEditor(page);
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    await expect(page.getByText("Personalizá tu informe")).toBeVisible();
    expect(postCalled).toBe(false);
  });

  test("Confirming generates new report", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUser(page);
    await mockGenerateReport(page, REGENERATED_REPORT);

    acceptNextDialog(page);

    await openReportEditor(page);
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
  });

  test("Failed regeneration preserves previous report", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUser(page);
    await mockGenerateReportError(page, 500);

    acceptNextDialog(page);

    await openReportEditor(page);
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText("Tu Carta Mecánica")).toBeVisible();
    await expect(page.getByText("No se pudo generar el informe. Intentá de nuevo.")).not.toBeVisible();
    await expect(page.getByText("Generation failed")).not.toBeVisible();
  });

  test("Rate limit (429) preserves previous report state", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUser(page);
    await mockGenerateReportError(page, 429);

    acceptNextDialog(page);

    await openReportEditor(page);
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText("Tu Carta Mecánica")).toBeVisible();
    await expect(page.getByText("No se pudo generar el informe. Intentá de nuevo.")).not.toBeVisible();
    await expect(page.getByText("Generation failed")).not.toBeVisible();
  });

  test("IntakeError warning appears if PUT fails but report succeeds", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUserError(page);
    await mockGenerateReport(page, REGENERATED_REPORT);

    acceptNextDialog(page);

    await openReportEditor(page);
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText(/contexto personal no se pudo guardar/)).toBeVisible();
  });
});
