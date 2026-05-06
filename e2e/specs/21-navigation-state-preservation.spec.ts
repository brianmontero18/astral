import { test, expect } from "@playwright/test";

import {
  mockChatHistory,
  mockGenerateReport,
  mockGetAssets,
  mockGetReport,
  mockGetUser,
  mockHealth,
  mockTransits,
  mockUpdateUser,
} from "../helpers/mock-api";
import {
  FREE_REPORT,
  HISTORY_MESSAGES,
  TEST_USER,
  TEST_USER_NO_INTAKE,
  TEST_USER_WITH_INTAKE,
} from "../helpers/fixtures";

const ASSET_FIXTURES = [
  {
    id: "asset-nav-1",
    filename: "carta-base.pdf",
    mimeType: "application/pdf",
    fileType: "hd",
    sizeBytes: 1024,
    createdAt: "2026-04-20T12:00:00.000Z",
  },
];

test.describe("Navigation — state preservation", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await mockTransits(page);
    await mockGetAssets(page, ASSET_FIXTURES);
  });

  test("main navigation keeps the user moving across chat, transits, assets, intake, and report without losing the originating tab", async ({ page }) => {
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockGetReport(page, null);
    await mockUpdateUser(page);
    await mockGenerateReport(page, FREE_REPORT);
    await page.goto("/");

    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Como afecta mi centro Sacral?")).toBeVisible();

    await page.getByRole("button", { name: "Tránsitos" }).click();
    await expect(page.getByRole("heading", { name: "Tránsitos de la Semana" })).toBeVisible();

    await page.getByRole("button", { name: "Mis Cartas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Cartas" })).toBeVisible();
    await expect(page.getByText("carta-base.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();

    await page.getByLabel("¿A qué dedicás tu energía hoy?").fill("Navego entre superficies sin perderme");
    // The NavBar back button was removed — leaving intake means clicking a tab.
    await page.getByRole("button", { name: "Mis Cartas" }).click();

    await expect(page.getByRole("heading", { name: "Mis Cartas" })).toBeVisible();
    await expect(page.getByText("carta-base.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();

    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();

    await page.getByRole("button", { name: "Mis Cartas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Cartas" })).toBeVisible();

    await page.getByRole("button", { name: "Chat" }).click();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Como afecta mi centro Sacral?")).toBeVisible();
  });

  test("cached report and intake editing return to the tab that originated the report flow", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.goto("/");

    await page.getByRole("button", { name: "Tránsitos" }).click();
    await expect(page.getByRole("heading", { name: "Tránsitos de la Semana" })).toBeVisible();

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();

    await page.getByRole("button", { name: /Editar mis respuestas/ }).click();
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();
    await expect(page.getByLabel("¿A qué dedicás tu energía hoy?")).toHaveValue("Soy diseñadora freelance");
    await expect(page.getByRole("button", { name: "Volver al informe" })).toBeVisible();

    await page.getByRole("button", { name: "Volver al informe" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();

    // No back button — tabs are the navigation.
    await page.getByRole("button", { name: "Tránsitos" }).click();
    await expect(page.getByRole("heading", { name: "Tránsitos de la Semana" })).toBeVisible();
  });

  test("the new \"Informe\" tab is a first-class entry into the report flow", async ({ page }) => {
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, FREE_REPORT);
    await page.goto("/");

    // The chat surface should not need the profile dropdown anymore — tapping
    // the new top-level Informe tab routes through handleGoToReport, which
    // surfaces the cached report directly.
    await page.getByRole("button", { name: "Informe" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();
  });

  test("Informe with completed intake but no cached report skips the form and generates directly", async ({ page }) => {
    // Regression guard: after onboarding, hitting Informe used to re-prompt
    // the same intake form even when actividad+desafio were already filled.
    // handleGoToReport now generates the report directly when intake is
    // complete; the form only appears for users who haven't filled it yet.
    await mockGetUser(page, TEST_USER_WITH_INTAKE);
    await mockGetReport(page, null);
    await mockUpdateUser(page);
    await mockGenerateReport(page, FREE_REPORT);
    await page.goto("/");

    await page.getByRole("button", { name: "Informe" }).click();

    // Should land on the report, NOT on the intake form.
    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText("Personalizá tu informe")).not.toBeVisible();
  });

  test("admin clicking a tab from /admin/users lands on that tab without bouncing through Chat", async ({ page }) => {
    // Regression guard: leaving the admin support route triggers a pathname
    // change that re-fires the bootstrap effect. The bootstrap used to
    // unconditionally setCurrentView(\"chat\") on every run, so an admin
    // clicking Tránsitos from Personas would visibly bounce back to Chat.
    // The fix uses a functional setter that only sets the default view
    // when the prior view was \"onboarding\".
    await page.unrouteAll();
    await mockHealth(page);
    await mockChatHistory(page, []);
    await mockTransits(page);
    await mockGetReport(page, FREE_REPORT);

    const adminUser = {
      ...TEST_USER_WITH_INTAKE,
      id: "admin-1",
      name: "Admin User",
      plan: "premium" as const,
      role: "admin" as const,
      status: "active" as const,
    };
    await page.route("**/api/me", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: adminUser });
        return;
      }
      await route.fallback();
    });
    await page.route("**/api/admin/users**", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          users: [],
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          pageSize: 12,
          rangeStart: 0,
          rangeEnd: 0,
        },
      });
    });

    await page.goto("/admin/users");
    await expect(page.getByRole("button", { name: "Usuarios" })).toBeVisible();

    await page.getByRole("button", { name: "Tránsitos" }).click();
    await expect(page.getByRole("heading", { name: "Tránsitos de la Semana" })).toBeVisible();
    // Chat placeholder must NOT appear — that would mean we bounced through it.
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).not.toBeVisible();
  });
});
