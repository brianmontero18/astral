import { test, expect } from "@playwright/test";

import {
  mockChatHistory,
  mockGetUser,
  mockGetReport,
  mockHealth,
} from "../helpers/mock-api";
import {
  HISTORY_MESSAGES,
  TEST_USER,
  TEST_USER_NO_INTAKE,
  TEST_USER_WITH_INTAKE,
} from "../helpers/fixtures";

const PARTIAL_PROFILE_USER = {
  ...TEST_USER_NO_INTAKE,
  name: "Profile User",
  plan: "basic" as const,
  role: "user" as const,
  status: "active" as const,
  profile: {
    name: "",
    humanDesign: {
      type: "",
      strategy: "",
      authority: "",
      profile: "",
      definition: "",
      incarnationCross: "",
      notSelfTheme: "",
      variable: "",
      digestion: "",
      environment: "",
      strongestSense: "",
      channels: [],
      activatedGates: [],
      definedCenters: [],
      undefinedCenters: [],
    },
  },
};

test.describe("Profile — panel visibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
  });

  test("profile panel exposes plan and HD cues on the current shell", async ({ page }) => {
    await mockGetUser(page, {
      ...TEST_USER_WITH_INTAKE,
      plan: "premium",
      role: "user" as const,
      status: "active" as const,
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();

    await expect(page.getByText("✦ Perfil activo")).toBeVisible();
    await expect(page.getByText("Plan actual")).toBeVisible();
    await expect(page.getByText("Premium")).toBeVisible();
    await expect(page.getByText("Tipo")).toBeVisible();
    await expect(page.getByText("Generador")).toBeVisible();
    await expect(page.getByText("Autoridad")).toBeVisible();
    await expect(page.getByText("Emocional")).toBeVisible();
    await expect(page.getByText("Definidos", { exact: true })).toBeVisible();
    await expect(page.getByText("Sacral, Garganta")).toBeVisible();
    await expect(page.getByText("Canales", { exact: true })).toBeVisible();
    await expect(page.getByText("Canal de Carisma")).toBeVisible();
    await expect(page.getByRole("button", { name: /Generar mi informe/ })).toBeVisible();
  });

  test("profile panel stays usable with partial HD data and still opens the report flow", async ({ page }) => {
    await mockGetUser(page, PARTIAL_PROFILE_USER);
    await mockGetReport(page, null);
    await page.goto("/");

    await page.getByRole("button", { name: "Profile User" }).click();

    await expect(page.getByText("✦ Perfil activo")).toBeVisible();
    await expect(page.getByText("Perfil activo", { exact: true })).toBeVisible();
    await expect(page.getByText("Plan actual")).toBeVisible();
    await expect(page.getByText("Basic")).toBeVisible();
    await expect(page.getByText("Tipo", { exact: true })).toBeVisible();
    await expect(page.getByText("Definición", { exact: true })).toBeVisible();
    await expect(page.getByText("Canales", { exact: true })).toBeVisible();
    await expect(page.getByText("—", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Omitir" })).toBeVisible();
  });
});
