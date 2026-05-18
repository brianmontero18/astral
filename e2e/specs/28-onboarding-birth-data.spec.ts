/**
 * Onboarding birth-data flow — happy path.
 *
 * Pivote del onboarding: en lugar de upload PDF, el usuario ingresa fecha,
 * hora y lugar de nacimiento. El backend resuelve la timezone histórica con
 * geo-tz + luxon y calcula el bodygraph determinístico (Swiss Ephemeris).
 *
 * Mockea:
 *   POST /api/users                       → bootstrap inicial (sin auth).
 *   GET  /api/me                          → 409 antes del bootstrap, 200 después.
 *   GET  /api/places/autocomplete?q=...   → devuelve "Esquel" como único resultado.
 *   POST /api/me/bodygraph/from-birth     → devuelve HD_PROFILE + birthData.
 */
import { test, expect } from "@playwright/test";

import { mockHealth } from "../helpers/mock-api";
import { HD_PROFILE } from "../helpers/fixtures";

const LINKED_USER = {
  id: "test-user-123",
  name: "Brian Montero",
  profile: HD_PROFILE,
  intake: null,
  plan: "free" as const,
  role: "user" as const,
  status: "active" as const,
  onboardingStatus: "pending" as const,
  onboardingStep: "review" as const,
  accessSource: "self" as const,
};

const ESQUEL_RESULT = {
  geonameId: 3855974,
  name: "Esquel",
  admin1: "Chubut",
  country: "Argentina",
  countryCode: "AR",
  lat: -42.9135,
  lon: -71.31947,
  population: 28486,
};

const BIRTH_DATA_RESPONSE = {
  ...HD_PROFILE,
  birthData: {
    dateLocalIso: "1988-12-28T04:13:00-02:00",
    dateUtcIso: "1988-12-28T06:13:00.000Z",
    placeLabel: "Esquel, Chubut, Argentina",
    coordinates: { lat: -42.9135, lon: -71.31947 },
    timezoneOffsetHours: -2,
    ageYears: 37,
  },
};

test.describe("Onboarding — birth data flow (astral-tza)", () => {
  test("user fills name → date → time → place autocomplete → review", async ({ page }) => {
    let bootstrapped = false;

    await mockHealth(page);

    await page.route("**/api/me", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname !== "/api/me" || route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      if (!bootstrapped) {
        await route.fulfill({
          status: 409,
          json: {
            error: "identity_not_linked",
            provider: "supertokens",
            subject: "st-birth-flow",
          },
        });
        return;
      }
      await route.fulfill({ status: 200, json: LINKED_USER });
    });

    await page.route("**/api/users", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      bootstrapped = true;
      await route.fulfill({ status: 201, json: { id: LINKED_USER.id } });
    });

    let autocompleteHits = 0;
    await page.route("**/api/places/autocomplete*", async (route) => {
      autocompleteHits += 1;
      const url = new URL(route.request().url());
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      // Solo devolver Esquel cuando la búsqueda matchea. Para queries cortas
      // o no-matching, devolver lista vacía (refleja el comportamiento real).
      const results = q.includes("esq") ? [ESQUEL_RESULT] : [];
      await route.fulfill({ status: 200, json: { results } });
    });

    await page.route("**/api/me/bodygraph/from-birth", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      expect(body.date).toBe("1988-12-28");
      expect(body.time).toBe("04:13");
      expect(body.place.lat).toBeCloseTo(-42.9135, 4);
      expect(body.place.lon).toBeCloseTo(-71.31947, 4);
      expect(body.place.label).toContain("Esquel");
      await route.fulfill({
        status: 201,
        json: {
          user: { ...LINKED_USER, profile: BIRTH_DATA_RESPONSE },
          profile: BIRTH_DATA_RESPONSE,
        },
      });
    });

    await page.goto("/");

    // Welcome → click "Descubrir mi carta"
    await page.getByRole("button", { name: /descubrir mi carta/i }).click();

    // Name step
    await page.getByPlaceholder("Tu nombre").fill("Brian Montero");
    await page.getByRole("button", { name: /continuar/i }).click();

    // Birth-data step visible
    await expect(page.getByRole("heading", { name: "Coordenadas de tu carta" })).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");

    // Fill date and time (native inputs, fill works on Chromium)
    await page.locator('input[type="date"]').fill("1988-12-28");
    await page.locator('input[type="time"]').fill("04:13");

    // Type place query → autocomplete dropdown appears
    const placeInput = page.getByPlaceholder(/empezá a escribir/i);
    await placeInput.click();
    await placeInput.fill("esquel");

    // Wait for debounce (250ms) + autocomplete result to render
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByRole("button", { name: /Esquel\s+Chubut, Argentina/ })).toBeVisible();

    // Pick the result
    await page.getByRole("button", { name: /Esquel\s+Chubut, Argentina/ }).click();

    // Dropdown closes, input shows the formatted label
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(placeInput).toHaveValue("Esquel, Chubut, Argentina");

    // Submit
    await page.getByRole("button", { name: /calcular mi carta/i }).click();

    // Calculating spinner brief, then review
    await expect(page.getByRole("heading", { name: "Esto es lo que calculamos" })).toBeVisible();

    // Review fields populated from the calculated profile
    await expect(page.getByText("Generador").first()).toBeVisible();
    await expect(page.getByText("6/2").first()).toBeVisible();
    await expect(page.getByText("Emocional").first()).toBeVisible();
    await expect(page.getByText("Esquel, Chubut, Argentina")).toBeVisible();

    // Autocomplete hit at least once
    expect(autocompleteHits).toBeGreaterThan(0);
  });

  test("validates required fields before submit", async ({ page }) => {
    await mockHealth(page);
    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 409,
        json: { error: "identity_not_linked", provider: "supertokens", subject: "st-birth-validate" },
      });
    });
    await page.route("**/api/users", async (route) => {
      await route.fulfill({ status: 201, json: { id: LINKED_USER.id } });
    });

    await page.goto("/");
    await page.getByRole("button", { name: /descubrir mi carta/i }).click();
    await page.getByPlaceholder("Tu nombre").fill("Brian");
    await page.getByRole("button", { name: /continuar/i }).click();

    await expect(page.getByRole("heading", { name: "Coordenadas de tu carta" })).toBeVisible();

    // Click submit sin llenar nada → error de fecha
    await page.getByRole("button", { name: /calcular mi carta/i }).click();
    await expect(page.getByText(/fecha válida/i)).toBeVisible();

    // Solo fecha → error de hora
    await page.locator('input[type="date"]').fill("1988-12-28");
    await page.getByRole("button", { name: /calcular mi carta/i }).click();
    await expect(page.getByText(/hora válida/i)).toBeVisible();

    // Fecha + hora pero sin lugar → error de lugar
    await page.locator('input[type="time"]').fill("04:13");
    await page.getByRole("button", { name: /calcular mi carta/i }).click();
    await expect(page.getByText(/elegí un lugar/i)).toBeVisible();
  });
});
