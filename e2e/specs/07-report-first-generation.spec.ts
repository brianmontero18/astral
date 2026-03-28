import { test, expect } from "@playwright/test";
import { mockGetUser, mockGetReport, mockUpdateUser, mockGenerateReport, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_NO_INTAKE, FREE_REPORT } from "../helpers/fixtures";

test.describe("Report — First Generation", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
  });

  test('Clicking "Generar mi informe" from Profile Panel navigates to IntakeView', async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null); // No cached report — 404
    // Mock chat history for initial load
    await page.route("**/api/users/*/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { messages: [], used: 0, limit: 15 } });
      } else await route.fallback();
    });
    await page.goto("/");

    // Open profile panel and click generate
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    // Should land on IntakeView (GET report returned 404)
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();
  });

  test("User can type in all 3 intake fields", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await page.route("**/api/users/*/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { messages: [], used: 0, limit: 15 } });
      } else await route.fallback();
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();

    await page.getByLabel("¿A qué te dedicás?").fill("Soy diseñadora");
    await page.getByLabel("¿Qué buscás en este momento?").fill("Entender mi energía");
    await page.getByLabel("¿Cuál es tu mayor desafío?").fill("Decir que no");

    await expect(page.getByLabel("¿A qué te dedicás?")).toHaveValue("Soy diseñadora");
    await expect(page.getByLabel("¿Qué buscás en este momento?")).toHaveValue("Entender mi energía");
    await expect(page.getByLabel("¿Cuál es tu mayor desafío?")).toHaveValue("Decir que no");
  });

  test('Clicking "Generar mi informe" shows loading then report', async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockUpdateUser(page);
    await mockGenerateReport(page, FREE_REPORT);
    await page.route("**/api/users/*/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { messages: [], used: 0, limit: 15 } });
      } else await route.fallback();
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await page.getByLabel("¿A qué te dedicás?").fill("Soy diseñadora");
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    // Report should appear
    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText("Tu Carta Mecánica")).toBeVisible();
  });

  test('Clicking "Omitir" generates report without intake', async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockGenerateReport(page, FREE_REPORT);
    await page.route("**/api/users/*/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { messages: [], used: 0, limit: 15 } });
      } else await route.fallback();
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();

    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();
  });

  test("Report shows free sections expanded and premium sections locked", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockUpdateUser(page);
    await mockGenerateReport(page, FREE_REPORT);
    await page.route("**/api/users/*/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { messages: [], used: 0, limit: 15 } });
      } else await route.fallback();
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: "Omitir" }).click();

    await expect(page.getByText("Tu Tipo")).toBeVisible();
    await expect(page.getByText("Tu Autoridad")).toBeVisible();
    // Premium sections have lock icon
    await expect(page.getByText("🔒").first()).toBeVisible();
  });

  test("Generation date is visible in ReportView", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockGenerateReport(page, FREE_REPORT);
    await page.route("**/api/users/*/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { messages: [], used: 0, limit: 15 } });
      } else await route.fallback();
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: "Omitir" }).click();

    await expect(page.getByText(/Generado el/)).toBeVisible();
  });

  test('"Volver" button in NavBar returns to previous tab', async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockGenerateReport(page, FREE_REPORT);
    await page.route("**/api/users/*/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { messages: [], used: 0, limit: 15 } });
      } else await route.fallback();
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();

    await page.getByRole("button", { name: "← Volver" }).click();
    // Should return to chat (default previousView)
    await expect(page.getByPlaceholder("Preguntá al oráculo")).toBeVisible();
  });
});
