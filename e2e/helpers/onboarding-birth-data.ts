import { expect, type Page } from "@playwright/test";

import { HD_PROFILE } from "./fixtures";

export const ESQUEL_RESULT = {
  geonameId: 3855974,
  name: "Esquel",
  admin1: "Chubut",
  country: "Argentina",
  countryCode: "AR",
  lat: -42.9135,
  lon: -71.31947,
  population: 28486,
};

export const BIRTH_DATA_PROFILE = {
  ...HD_PROFILE,
  birthData: {
    dateLocalIso: "1988-12-28T04:13:00-02:00",
    dateUtcIso: "1988-12-28T06:13:00.000Z",
    placeLabel: "Esquel, Chubut, Argentina",
    coordinates: { lat: -42.9135, lon: -71.31947 },
    timezoneOffsetHours: -2,
    ageYears: 37,
  },
  humanDesign: {
    ...HD_PROFILE.humanDesign,
    activatedGates: [{ number: 34, line: 1, planet: "Sun", isPersonality: true }],
  },
};

export async function mockPlacesAutocomplete(page: Page) {
  await page.route("**/api/places/autocomplete*", async (route) => {
    const query = (new URL(route.request().url()).searchParams.get("q") ?? "").toLowerCase();
    await route.fulfill({ status: 200, json: { results: query.includes("esq") ? [ESQUEL_RESULT] : [] } });
  });
}

export async function completeBirthDataStep(page: Page) {
  await page.getByLabel("Fecha de nacimiento").fill("1988-12-28");
  await page.getByLabel("Hora local").fill("04:13");
  await page.getByLabel("Lugar de nacimiento").fill("Esq");
  await page.getByRole("button", { name: "Esquel Chubut, Argentina" }).click();
  await page.getByRole("button", { name: /calcular mi carta/i }).click();
  await expect(page.getByRole("heading", { name: "Esto es lo que calculamos" })).toBeVisible();
}

