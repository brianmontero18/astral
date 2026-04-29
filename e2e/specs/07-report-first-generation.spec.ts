import { test, expect } from "@playwright/test";
import {
  mockChatHistory,
  mockGetUser,
  mockGetReport,
  mockUpdateUser,
  mockGenerateReport,
  mockGenerateReportError,
  mockHealth,
} from "../helpers/mock-api";
import { TEST_USER, TEST_USER_NO_INTAKE, FREE_REPORT } from "../helpers/fixtures";
import {
  openFreshReportIntake,
  openReportEntryPoint,
  seedAuthenticatedReportShell,
} from "../helpers/report";

test.describe("Report — First Generation", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedReportShell(page, TEST_USER);
  });

  test("Basic users keep initial report load and first generation bound to the allowed free tier", async ({ page }) => {
    const basicUser = {
      ...TEST_USER_NO_INTAKE,
      plan: "basic",
      role: "user",
      status: "active",
    };
    const requestedReportTiers: string[] = [];
    const generatedReportTiers: string[] = [];

    await page.unrouteAll();
    await mockHealth(page);
    await mockChatHistory(page, []);
    await mockGetUser(page, basicUser);
    await page.route("**/api/me/report**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;

      if (pathname !== "/api/me/report") {
        await route.fallback();
        return;
      }

      if (request.method() === "GET") {
        requestedReportTiers.push(new URL(request.url()).searchParams.get("tier") ?? "missing");
        await route.fulfill({ status: 404, json: { error: "No report found" } });
        return;
      }

      if (request.method() === "POST") {
        const body = request.postDataJSON() as { tier?: string };
        generatedReportTiers.push(body.tier ?? "missing");
        await route.fulfill({ status: 200, json: FREE_REPORT });
        return;
      }

      await route.fallback();
    });

    await openFreshReportIntake(page);
    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();

    expect(requestedReportTiers).toEqual(["free"]);
    expect(generatedReportTiers).toEqual(["free"]);
  });

  test('Clicking "Generar mi informe" from Profile Panel navigates to IntakeView', async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null); // No cached report — 404
    await openFreshReportIntake(page);
  });

  test("User can type in the intake fields", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await openFreshReportIntake(page);

    await page.getByLabel("¿A qué te dedicás?").fill("Soy diseñadora");
    await page.getByLabel("¿Qué desafío tenés ahora?").fill("Decir que no");
    await page.getByLabel("¿Qué querés concretar en los próximos 12 meses? (opcional)").fill("Entender mi energía");

    await expect(page.getByLabel("¿A qué te dedicás?")).toHaveValue("Soy diseñadora");
    await expect(page.getByLabel("¿Qué desafío tenés ahora?")).toHaveValue("Decir que no");
    await expect(page.getByLabel("¿Qué querés concretar en los próximos 12 meses? (opcional)")).toHaveValue("Entender mi energía");
  });

  test('Clicking "Generar mi informe" shows loading then report', async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockUpdateUser(page);
    await mockGenerateReport(page, FREE_REPORT);
    await openFreshReportIntake(page);

    // Both required fields must be filled now (schema 5-fields, 2 obligatorios).
    await page.getByLabel("¿A qué te dedicás?").fill("Soy diseñadora");
    await page.getByLabel("¿Qué desafío tenés ahora?").fill("Decir que no");
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    // Report should appear
    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText("Tu Carta Mecánica")).toBeVisible();
  });

  test('Clicking "Omitir" generates report without intake', async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockGenerateReport(page, FREE_REPORT);
    await openFreshReportIntake(page);
    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();
  });

  test("First generation failure shows a user-safe fallback instead of backend details", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockGenerateReportError(page, 500);
    await openFreshReportIntake(page);
    await page.getByRole("button", { name: "Omitir" }).click();

    await expect(page.getByText("No se pudo generar el informe. Intentá de nuevo.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Volver", exact: true })).toBeVisible();
    await expect(page.getByText("Generation failed")).not.toBeVisible();
  });

  test("Report shows free sections expanded and premium sections locked", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockUpdateUser(page);
    await mockGenerateReport(page, FREE_REPORT);
    await openFreshReportIntake(page);
    await page.getByRole("button", { name: "Omitir" }).click();

    await expect(page.getByText("Tu Tipo")).toBeVisible();
    await expect(page.getByText("Tu Autoridad")).toBeVisible();
    await expect(page.getByText("🔒").first()).toBeVisible();
  });

  test("Generation date is visible in ReportView", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockGenerateReport(page, FREE_REPORT);
    await openFreshReportIntake(page);
    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText(/Generado el/)).toBeVisible();
  });

  test('"Volver" button in NavBar returns to previous tab', async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockGenerateReport(page, FREE_REPORT);
    await openReportEntryPoint(page);
    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();

    await page.getByRole("button", { name: "← Volver" }).click();
    // Should return to chat (default previousView)
    await expect(page.getByPlaceholder("Preguntá al oráculo")).toBeVisible();
  });
});
