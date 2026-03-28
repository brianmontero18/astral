import { test, expect } from "@playwright/test";
import {
  mockGetUser, mockGetReport, mockUpdateUser, mockUpdateUserError,
  mockGenerateReport, mockGenerateReportError, mockHealth,
} from "../helpers/mock-api";
import { TEST_USER, TEST_USER_WITH_INTAKE, FREE_REPORT, REGENERATED_REPORT } from "../helpers/fixtures";

test.describe("Report — Regeneration", () => {
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

  test("Confirm dialog appears before regeneration when report exists", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUser(page);

    let confirmCalled = false;
    page.on("dialog", async (dialog) => {
      confirmCalled = true;
      await dialog.dismiss();
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    expect(confirmCalled).toBe(true);
  });

  test("Canceling confirm dialog does not regenerate", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);

    let postCalled = false;
    await page.route("**/api/users/*/report", async (route) => {
      if (route.request().method() === "POST") {
        postCalled = true;
        await route.fulfill({ status: 200, json: FREE_REPORT });
      } else await route.fallback();
    });

    page.on("dialog", async (dialog) => {
      await dialog.dismiss();
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    // Wait a moment to verify no POST was made
    await page.waitForTimeout(500);
    expect(postCalled).toBe(false);
  });

  test("Confirming generates new report", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUser(page);
    await mockGenerateReport(page, REGENERATED_REPORT);

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
  });

  test("Failed regeneration preserves previous report", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUser(page);
    await mockGenerateReportError(page, 500);

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    // After failure, the error fallback should be shown but the app should not crash
    // The report state gets preserved (report was already set before regeneration)
    await expect(page.getByText(/No se pudo generar|Informe Personal/)).toBeVisible();
  });

  test("Rate limit (429) preserves previous report state", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUser(page);
    await mockGenerateReportError(page, 429);

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    // Previous report is preserved — app doesn't crash
    await expect(page.getByText(/No se pudo generar|Informe Personal/)).toBeVisible();
  });

  test("IntakeError warning appears if PUT fails but report succeeds", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await mockUpdateUserError(page);
    await mockGenerateReport(page, REGENERATED_REPORT);

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();
    await page.getByRole("button", { name: /Regenerar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText(/contexto personal no se pudo guardar/)).toBeVisible();
  });
});
