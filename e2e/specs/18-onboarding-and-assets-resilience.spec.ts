import { Buffer } from "node:buffer";

import { test, expect } from "@playwright/test";

import { mockChatHistory, mockGetUser, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_WITH_INTAKE } from "../helpers/fixtures";
import {
  BIRTH_DATA_PROFILE,
  mockPlacesAutocomplete,
} from "../helpers/onboarding-birth-data";

const LINKED_USER = {
  ...TEST_USER_WITH_INTAKE,
  plan: "free" as const,
  role: "user" as const,
  status: "active" as const,
};

test.describe("Onboarding & Mi Carta resilience", () => {
  test("Birth-data calculation failure shows safe retry copy and lets the user retry cleanly", async ({ page }) => {
    let bootstrapped = false;
    let bootstrapCalls = 0;
    let calculateAttempts = 0;

    await mockHealth(page);
    await mockPlacesAutocomplete(page);
    await page.route("**/api/me", async (route) => {
      const pathname = new URL(route.request().url()).pathname;

      if (pathname !== "/api/me") {
        await route.fallback();
        return;
      }

      if (route.request().method() === "PUT") {
        await route.fulfill({ status: 200, json: { ok: true } });
        return;
      }

      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      if (!bootstrapped) {
        await route.fulfill({
          status: 409,
          json: {
            error: "identity_not_linked",
            provider: "supertokens",
            subject: "st-onboarding-retry",
          },
        });
        return;
      }

      await route.fulfill({
        status: 200,
        json: {
          ...LINKED_USER,
          profile: BIRTH_DATA_PROFILE,
          intake: null,
        },
      });
    });
    await page.route("**/api/users", async (route) => {
      if (route.request().method() !== "POST" || new URL(route.request().url()).pathname !== "/api/users") {
        await route.fallback();
        return;
      }

      bootstrapCalls += 1;
      bootstrapped = true;

      if (bootstrapCalls === 1) {
        await route.fulfill({ status: 201, json: { id: "test-user-123" } });
        return;
      }

      await route.fulfill({
        status: 409,
        json: { error: "identity_already_linked", userId: "test-user-123" },
      });
    });
    await page.route("**/api/me/bodygraph/from-birth", async (route) => {
      if (route.request().method() !== "POST" || new URL(route.request().url()).pathname !== "/api/me/bodygraph/from-birth") {
        await route.fallback();
        return;
      }

      calculateAttempts += 1;

      if (calculateAttempts === 1) {
        await route.fulfill({
          status: 502,
          json: { error: "swiss ephemeris worker timeout" },
        });
        return;
      }

      await route.fulfill({
        status: 201,
        json: {
          user: {
            ...LINKED_USER,
            profile: BIRTH_DATA_PROFILE,
            intake: null,
          },
          profile: BIRTH_DATA_PROFILE,
        },
      });
    });
    await page.goto("/");

    await page.getByRole("button", { name: "DESCUBRIR MI CARTA" }).click();
    await page.getByPlaceholder("Tu nombre").fill("Test User");
    await page.getByRole("button", { name: "CONTINUAR" }).click();
    await page.getByLabel("Fecha de nacimiento").fill("1988-12-28");
    await page.getByLabel("Hora local").fill("04:13");
    await page.getByLabel("Lugar de nacimiento").fill("Esq");
    await page.getByRole("button", { name: "Esquel Chubut, Argentina" }).click();
    await page.getByRole("button", { name: /calcular mi carta/i }).click();

    await expect(page.getByText("No pudimos calcular tu carta ahora. Probá de nuevo en un momento.")).toBeVisible();
    await expect(page.getByText("swiss ephemeris worker timeout")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Coordenadas de tu carta" })).toBeVisible();

    await page.getByRole("button", { name: /calcular mi carta/i }).click();

    await expect(page.getByRole("heading", { name: "Esto es lo que calculamos" })).toBeVisible();
    await expect(page.getByText("No pudimos calcular tu carta ahora. Probá de nuevo en un momento.")).toHaveCount(0);
  });

  test.describe("Mi Carta", () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((user) => {
        localStorage.setItem("astral_user", JSON.stringify(user));
      }, TEST_USER);
      await mockHealth(page);
      await mockChatHistory(page, []);
      await mockGetUser(page, LINKED_USER);
    });

    test("empty state opens the current V1 replacement surface", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Mi Carta" }).click();

      await expect(page.getByRole("heading", { name: "Todavía no calculaste tu carta" })).toBeVisible();

      await page.getByRole("button", { name: "Cargar mi carta" }).click();

      await expect(page.getByRole("heading", { name: "¿Cómo querés cargar tu Diseño Humano?" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Datos de nacimiento" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "PDF" })).toBeVisible();
    });

    test("validation failures keep the replacement surface usable", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Mi Carta" }).click();
      await page.getByRole("button", { name: "Cargar mi carta" }).click();

      await page.getByRole("button", { name: "Calcular y guardar" }).click();
      await expect(page.getByText("Ingresá una fecha válida (formato YYYY-MM-DD).")).toBeVisible();

      await page.getByLabel("Fecha de nacimiento").fill("1988-12-28");
      await page.getByRole("button", { name: "Calcular y guardar" }).click();
      await expect(page.getByText("Ingresá una hora válida (formato HH:mm 24h).")).toBeVisible();

      await page.getByLabel("Hora local").fill("04:13");
      await page.getByRole("button", { name: "Calcular y guardar" }).click();
      await expect(page.getByText("Elegí un lugar de la lista para que podamos resolver tu zona horaria.")).toBeVisible();
    });

    test("PDF replace failures stay friendly and keep the surface usable", async ({ page }) => {
      await page.route("**/api/me/bodygraph/replace", async (route) => {
        if (route.request().method() !== "POST") {
          await route.fallback();
          return;
        }

        await route.fulfill({
          status: 400,
          json: { error: "parser_stacktrace_internal_pdf_failure" },
        });
      });

      await page.goto("/");
      await page.getByRole("button", { name: "Mi Carta" }).click();
      await page.getByRole("button", { name: "Cargar mi carta" }).click();
      await page.getByRole("tab", { name: "PDF" }).click();
      await page.locator('input[type="file"]').setInputFiles({
        name: "mi-carta.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 test"),
      });
      await page.getByRole("button", { name: "Subir y canalizar" }).click();
      await page.getByRole("dialog", { name: "¿Reemplazar tu carta?" }).getByRole("button", { name: "Reemplazar y reiniciar" }).click();

      await expect(page.getByText("No pudimos sincronizar el archivo.")).toBeVisible();
      await expect(page.getByText("parser_stacktrace_internal_pdf_failure")).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "¿Cómo querés cargar tu Diseño Humano?" })).toBeVisible();
    });
  });
});
