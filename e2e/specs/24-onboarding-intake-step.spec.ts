/**
 * Onboarding — Intake step (post-bodygraph)
 *
 * Cubre el step "intake" agregado al final del flujo de onboarding (después
 * de la review del bodygraph extraído). Verifica:
 * - Que el step aparece después de "CONTINUAR" desde la review.
 * - Que los 2 obligatorios bloquean el submit con un hint visible.
 * - Que un submit con obligatorios completos persiste el intake correctamente
 *   (PUT /api/me con shape nuevo) y deja al usuario en el chat.
 *
 * El flow completo del onboarding ya está cubierto por el spec 18 hasta
 * "Tu Identidad Cósmica" — este spec extiende a partir de ahí.
 */

import path from "node:path";
import { test, expect } from "@playwright/test";

import { mockChatHistory, mockHealth, mockTransits } from "../helpers/mock-api";
import { HD_PROFILE } from "../helpers/fixtures";

const CHART_FIXTURE_PATH = path.resolve("test-assets/bodygraph-sources/myhumandesign-chart.pdf");

const LINKED_USER_BASE = {
  id: "test-user-intake-step",
  name: "Test Intake User",
  profile: HD_PROFILE,
  plan: "free" as const,
  role: "user" as const,
  status: "active" as const,
};

/**
 * Set up the full onboarding API surface and walk the page from the welcome
 * screen up to the review step. Returns a `getPutBody` closure so individual
 * tests can assert against the last `PUT /api/me` request after the user
 * submits the intake.
 */
async function walkOnboardingToReview(page: import("@playwright/test").Page) {
  let bootstrapped = false;
  let lastPutBody: unknown = null;

  await mockHealth(page);
  await mockTransits(page);
  await mockChatHistory(page, []);

  await page.route("**/api/me", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/me") {
      await route.fallback();
      return;
    }
    if (route.request().method() === "PUT") {
      lastPutBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({ status: 200, json: { ok: true } });
      return;
    }
    if (route.request().method() === "GET") {
      if (!bootstrapped) {
        await route.fulfill({
          status: 409,
          json: { error: "identity_not_linked", provider: "supertokens", subject: "st-intake-step" },
        });
      } else {
        await route.fulfill({
          status: 200,
          json: { ...LINKED_USER_BASE, intake: null },
        });
      }
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/users", async (route) => {
    if (route.request().method() !== "POST" || new URL(route.request().url()).pathname !== "/api/users") {
      await route.fallback();
      return;
    }
    bootstrapped = true;
    await route.fulfill({ status: 201, json: { id: LINKED_USER_BASE.id } });
  });

  await page.route("**/api/me/assets", async (route) => {
    if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/api/me/assets") {
      await route.fulfill({
        status: 201,
        json: {
          id: "asset-intake-1",
          filename: "chart.pdf",
          mimeType: "application/pdf",
          fileType: "hd",
          sizeBytes: 1024,
          createdAt: "2026-04-29T09:00:00.000Z",
        },
      });
    } else {
      await route.fallback();
    }
  });

  await page.route("**/api/extract-profile", async (route) => {
    if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/api/extract-profile") {
      await route.fulfill({ status: 200, json: { profile: HD_PROFILE } });
    } else {
      await route.fallback();
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "DESCUBRIR MI CARTA" }).click();
  await page.getByPlaceholder("Tu nombre").fill("Test Intake User");
  await page.getByRole("button", { name: "CONTINUAR" }).click();
  await page.locator('input[type="file"]').setInputFiles(CHART_FIXTURE_PATH);
  await page.getByRole("button", { name: "CANALIZAR ENERGÍA" }).click();

  // We're at the review step now.
  await expect(page.getByText("Tu Identidad Cósmica")).toBeVisible();

  return { getPutBody: () => lastPutBody };
}

test.describe("Onboarding — Intake step", () => {
  test("Continuar from review opens the intake step with required + optional fields", async ({ page }) => {
    await walkOnboardingToReview(page);

    await page.getByRole("button", { name: "CONTINUAR" }).click();

    // Required fields
    await expect(page.getByLabel("¿A qué te dedicás?")).toBeVisible();
    await expect(page.getByLabel("¿Qué desafío tenés ahora?")).toBeVisible();

    // Optional fields
    await expect(page.getByLabel("Tipo de negocio (opcional)")).toBeVisible();
    await expect(page.getByLabel("¿Qué querés concretar en los próximos 12 meses? (opcional)")).toBeVisible();
    await expect(page.getByLabel("¿Cómo describirías el tono de tu marca? (opcional)")).toBeVisible();

    // Primary CTA
    await expect(page.getByRole("button", { name: /Embarcar al chat/ })).toBeVisible();
  });

  test("Submitting with empty required fields blocks navigation and shows hint", async ({ page }) => {
    await walkOnboardingToReview(page);
    await page.getByRole("button", { name: "CONTINUAR" }).click();

    await page.getByRole("button", { name: /Embarcar al chat/ }).click();

    await expect(
      page.getByText("Necesitamos al menos los dos campos marcados con *", { exact: false }),
    ).toBeVisible();
    // We didn't navigate — the intake form is still mounted.
    await expect(page.getByLabel("¿A qué te dedicás?")).toBeVisible();
  });

  test("Submitting with required fields persists the intake and navigates to chat", async ({ page }) => {
    const { getPutBody } = await walkOnboardingToReview(page);
    await page.getByRole("button", { name: "CONTINUAR" }).click();

    await page.getByLabel("¿A qué te dedicás?").fill("Mentora de coaches en Latam");
    await page.getByLabel("¿Qué desafío tenés ahora?").fill("Lanzar mi programa premium en mayo");
    await page.getByLabel("Tipo de negocio (opcional)").selectOption("mentora");
    await page
      .getByLabel("¿Qué querés concretar en los próximos 12 meses? (opcional)")
      .fill("50 alumnas pagas en programa anual");

    await page.getByRole("button", { name: /Embarcar al chat/ }).click();

    // The chat surface uses the empty-state header rendered for new users.
    await expect(page.getByText("Hola, Test Intake User")).toBeVisible();

    const body = getPutBody() as { intake?: Record<string, unknown> } | null;
    expect(body).not.toBeNull();
    expect(body?.intake).toMatchObject({
      actividad: "Mentora de coaches en Latam",
      desafio_actual: "Lanzar mi programa premium en mayo",
      tipo_de_negocio: "mentora",
      objetivo_12m: "50 alumnas pagas en programa anual",
    });
    // voz_marca was left blank → the form strips it before persisting.
    expect(body?.intake?.voz_marca).toBeUndefined();
  });
});
