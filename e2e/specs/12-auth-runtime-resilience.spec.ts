import { test, expect } from "@playwright/test";

import { mockChatHistory, mockGetReport, mockGetUser, mockHealth } from "../helpers/mock-api";
import { HISTORY_MESSAGES, TEST_USER, TEST_USER_NO_INTAKE } from "../helpers/fixtures";

test.describe("Auth — Runtime Resilience", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
  });

  test("Salir hides the protected shell and returns the user to the public entry state", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Test User" })).toBeVisible();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();

    await page.getByRole("button", { name: "Salir" }).click();

    await expect(page.getByRole("button", { name: "Test User" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Chat" })).not.toBeVisible();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).not.toBeVisible();
    await expect(page.getByText("Astral Guide", { exact: true })).toBeVisible();
  });

  test("Session expiry during chat action shows friendly copy without leaking backend details", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await page.route("**/api/chat/stream", async (route) => {
      await route.fulfill({ status: 401, json: { error: "authentication_required" } });
    });
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({ status: 401, json: { error: "authentication_required" } });
    });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo sobre tu semana...");
    await input.fill("Necesito claridad");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("Tu sesión se cerró o venció. Volvé a entrar para seguir.")).toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Como afecta mi centro Sacral?")).toBeVisible();
    await expect(page.getByText("authentication_required")).not.toBeVisible();
    await expect(page.getByText(/Backend error 401/)).not.toBeVisible();
  });

  test("Session expiry during report generation shows a safe fallback and lets the user return to chat", async ({ page }) => {
    await mockChatHistory(page, []);
    await mockGetReport(page, null);
    await page.route("**/api/me/report", async (route) => {
      const pathname = new URL(route.request().url()).pathname;

      if (route.request().method() === "POST" && pathname === "/api/me/report") {
        await route.fulfill({ status: 401, json: { error: "authentication_required" } });
        return;
      }

      await route.fallback();
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Test User" }).click();
    await page.getByRole("button", { name: /Generar mi informe/ }).click();
    await expect(page.getByText("Personalizá tu informe")).toBeVisible();

    await page.getByRole("button", { name: "Omitir" }).click();

    await expect(page.getByText("No se pudo generar el informe. Intentá de nuevo.")).toBeVisible();
    await expect(page.getByText("authentication_required")).not.toBeVisible();
    await expect(page.getByText(/Report generation failed|Backend error 401/)).not.toBeVisible();

    await page.getByRole("button", { name: "Volver", exact: true }).click();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
  });

  test("Session expiry while loading assets keeps the shell usable and hides backend details", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await page.route("**/api/me/assets", async (route) => {
      if (route.request().method() === "GET" && new URL(route.request().url()).pathname === "/api/me/assets") {
        await route.fulfill({ status: 401, json: { error: "authentication_required" } });
        return;
      }

      await route.fallback();
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Mis Cartas" }).click();

    await expect(page.getByText("No pudimos cargar tus archivos ahora.")).toBeVisible();
    await expect(page.getByText("authentication_required")).not.toBeVisible();
    await expect(page.getByText("/api/me/assets")).not.toBeVisible();

    await page.getByRole("button", { name: "Chat" }).click();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
  });
});
