import { test, expect } from "@playwright/test";
import { mockGetUser, mockGetReport, mockUpdateUser, mockGenerateReport, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_WITH_INTAKE, TEST_USER_NO_INTAKE, FREE_REPORT } from "../helpers/fixtures";

test.describe("Report — Intake Persistence", () => {
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

  test("IntakeView pre-fills with saved intake on navigation", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();

    await expect(page.getByLabel("¿A qué te dedicás?")).toHaveValue("Soy diseñadora freelance");
  });

  test("Intake is saved via PUT when generating report", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    let putBody: unknown = null;
    await page.route("**/api/users/*", async (route) => {
      if (route.request().method() === "PUT") {
        putBody = JSON.parse(route.request().postData() ?? "{}");
        await route.fulfill({ status: 200, json: { ok: true } });
      } else await route.fallback();
    });
    await mockGenerateReport(page, FREE_REPORT);
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await page.getByLabel("¿A qué te dedicás?").fill("Soy dev");
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    expect((putBody as Record<string, unknown>)?.intake).toBeDefined();
  });

  test("Null intake from DB results in empty IntakeView fields", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await expect(page.getByLabel("¿A qué te dedicás?")).toHaveValue("");
    await expect(page.getByLabel("¿Qué buscás en este momento?")).toHaveValue("");
    await expect(page.getByLabel("¿Cuál es tu mayor desafío?")).toHaveValue("");
  });

  test("User reset clears intake state", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.goto("/");

    // Click "Salir" to reset
    await page.getByRole("button", { name: "Salir" }).click();

    // Should be back to onboarding
    await expect(page.getByText("Astral Guide")).toBeVisible();
    // localStorage should be cleared
    const stored = await page.evaluate(() => localStorage.getItem("astral_user"));
    expect(stored).toBeNull();
  });
});
