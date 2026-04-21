import { test, expect } from "@playwright/test";
import { mockGetUser, mockGetReport, mockGenerateReport } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_WITH_INTAKE, TEST_USER_NO_INTAKE, FREE_REPORT } from "../helpers/fixtures";
import { openFreshReportIntake, seedAuthenticatedReportShell } from "../helpers/report";

test.describe("Report — Intake Persistence", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedReportShell(page, TEST_USER);
  });

  test("Intake is saved via PUT when generating report", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    let putBody: unknown = null;
    await page.route("**/api/me", async (route) => {
      if (route.request().method() === "PUT" && new URL(route.request().url()).pathname === "/api/me") {
        putBody = JSON.parse(route.request().postData() ?? "{}");
        await route.fulfill({ status: 200, json: { ok: true } });
      } else {
        await route.fallback();
      }
    });
    await mockGenerateReport(page, FREE_REPORT);

    await openFreshReportIntake(page);

    await page.getByLabel("¿A qué te dedicás?").fill("Soy dev");
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    expect((putBody as Record<string, unknown>)?.intake).toBeDefined();
  });

  test("Null intake from DB results in empty IntakeView fields", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);

    await openFreshReportIntake(page);

    await expect(page.getByLabel("¿A qué te dedicás?")).toHaveValue("");
    await expect(page.getByLabel("¿Qué buscás en este momento?")).toHaveValue("");
    await expect(page.getByLabel("¿Cuál es tu mayor desafío?")).toHaveValue("");
  });

  test("User reset clears intake state", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);

    await page.goto("/");
    await page.getByRole("button", { name: "Salir" }).click();

    await expect(page.getByText("Astral Guide", { exact: true })).toBeVisible();
  });
});
