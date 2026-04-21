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

    await page.getByLabel("¿A qué te dedicás?").fill("Navego entre superficies sin perderme");
    await page.getByRole("button", { name: "← Volver" }).click();

    await expect(page.getByRole("heading", { name: "Mis Cartas" })).toBeVisible();
    await expect(page.getByText("carta-base.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();

    await page.getByRole("button", { name: "Omitir" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();

    await page.getByRole("button", { name: "← Volver" }).click();
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
    await expect(page.getByLabel("¿A qué te dedicás?")).toHaveValue("Soy diseñadora freelance");
    await expect(page.getByRole("button", { name: "Volver al informe" })).toBeVisible();

    await page.getByRole("button", { name: "Volver al informe" }).click();
    await expect(page.getByText("Informe Personal")).toBeVisible();

    await page.getByRole("button", { name: "← Volver" }).click();
    await expect(page.getByRole("heading", { name: "Tránsitos de la Semana" })).toBeVisible();
  });
});
