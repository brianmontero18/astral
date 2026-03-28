import { test, expect } from "@playwright/test";
import { mockGetUser, mockGetReport, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_WITH_INTAKE, FREE_REPORT } from "../helpers/fixtures";

test.describe("Report — Cache-First Loading", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await page.route("**/api/users/*/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { messages: [], used: 0, limit: 15 } });
      } else await route.fallback();
    });
  });

  test("User with cached report goes directly to ReportView", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    // Should skip intake and go directly to report
    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText("Personalizá tu informe")).not.toBeVisible();
  });

  test('"Editar mis respuestas" button is visible in ReportView', async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await expect(page.getByRole("button", { name: /Editar mis respuestas/ })).toBeVisible();
  });

  test('Clicking "Editar mis respuestas" navigates to IntakeView pre-filled', async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();

    await expect(page.getByText("Personalizá tu informe")).toBeVisible();
    await expect(page.getByLabel("¿A qué te dedicás?")).toHaveValue("Soy diseñadora freelance");
    await expect(page.getByLabel("¿Qué buscás en este momento?")).toHaveValue("Quiero entender mi energía");
    await expect(page.getByLabel("¿Cuál es tu mayor desafío?")).toHaveValue("Me cuesta decir que no");
  });

  test('IntakeView shows "Volver al informe" instead of "Omitir"', async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();

    await expect(page.getByRole("button", { name: "Volver al informe" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Omitir" })).not.toBeVisible();
  });

  test('IntakeView shows "Regenerar mi informe" instead of "Generar"', async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();

    await expect(page.getByRole("button", { name: /Regenerar mi informe/ })).toBeVisible();
  });

  test('"Volver al informe" navigates back without regenerating', async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    let postCalled = false;
    await page.route("**/api/users/*/report", async (route) => {
      if (route.request().method() === "POST") {
        postCalled = true;
        await route.fulfill({ status: 200, json: FREE_REPORT });
      } else await route.fallback();
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();
    await page.getByRole("button", { name: "Volver al informe" }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    expect(postCalled).toBe(false);
  });
});
