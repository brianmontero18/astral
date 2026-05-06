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

  test("User can type in all 3 intake fields", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await openFreshReportIntake(page);

    await page.getByLabel("¿A qué dedicás tu energía hoy?").fill("Soy diseñadora");
    await page.getByLabel("¿Qué desafío tenés ahora?").fill("Entender mi energía");
    await page.getByLabel("¿Qué querés concretar en los próximos 12 meses? (opcional)").fill("Decir que no");

    await expect(page.getByLabel("¿A qué dedicás tu energía hoy?")).toHaveValue("Soy diseñadora");
    await expect(page.getByLabel("¿Qué desafío tenés ahora?")).toHaveValue("Entender mi energía");
    await expect(page.getByLabel("¿Qué querés concretar en los próximos 12 meses? (opcional)")).toHaveValue("Decir que no");
  });

  test('Clicking "Generar mi informe" shows loading then report', async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockUpdateUser(page);
    await mockGenerateReport(page, FREE_REPORT);
    await openFreshReportIntake(page);

    await page.getByLabel("¿A qué dedicás tu energía hoy?").fill("Soy diseñadora");
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    // Report should appear
    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText("Tu Carta Mecánica")).toBeVisible();

    // TOC navigation: each section has a corresponding pill in the report
    // TOC. The bar wraps to multiple rows when needed — every pill is
    // visible at all times, no horizontal scroll, no fade mask. We assert
    // visibility on the first and last pills to catch regressions back to
    // the old single-row scroll layout where late pills were clipped.
    const toc = page.getByRole("navigation", { name: "Secciones del informe" });
    await expect(toc).toBeVisible();
    await expect(toc.getByRole("link", { name: "Tu Carta Mecánica" })).toBeVisible();
    await expect(toc.getByRole("link", { name: "Próximos 30 días" })).toBeVisible();

    // Initial active pill anchors on the first section.
    await expect(toc.getByRole("link", { name: "Tu Carta Mecánica" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    // Clicking another pill flips aria-current onto it (the scroll listener
    // also reconciles this on real wheel events; this guards the optimistic
    // click path).
    await toc.getByRole("link", { name: "Tu Tipo" }).click();
    await expect(toc.getByRole("link", { name: "Tu Tipo" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(toc.getByRole("link", { name: "Tu Carta Mecánica" })).not.toHaveAttribute(
      "aria-current",
      "true",
    );

    // Sections render as semantic <h2> headings (replaces previous <span> structure).
    await expect(page.getByRole("heading", { level: 2, name: "Tu Carta Mecánica" })).toBeVisible();
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

  test("clicking another tab from the report navigates away cleanly", async ({ page }) => {
    // The NavBar no longer renders a dedicated \"Volver\" button — the tabs
    // (Chat / Informe / Tránsitos / Mis Cartas) are always visible and
    // doubling as the back path. This test guards against regressions
    // where a tab click while in report would bounce back to chat.
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockGenerateReport(page, FREE_REPORT);
    await openReportEntryPoint(page);
    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();

    await page.getByRole("button", { name: "Chat" }).click();
    await expect(page.getByPlaceholder("Preguntá al oráculo")).toBeVisible();
  });
});
