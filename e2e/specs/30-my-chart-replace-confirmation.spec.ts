import { Buffer } from "node:buffer";

import { test, expect, type Page } from "@playwright/test";

import { mockChatHistory, mockGetUser, mockHealth } from "../helpers/mock-api";
import { HD_PROFILE, TEST_INTAKE, TEST_USER } from "../helpers/fixtures";

const ACTIVE_PROFILE = {
  ...HD_PROFILE,
  humanDesign: {
    ...HD_PROFILE.humanDesign,
    activatedGates: [{ number: 34, line: 1, planet: "Sun", isPersonality: true }],
  },
};

const LINKED_USER = {
  id: TEST_USER.id,
  name: TEST_USER.name,
  profile: ACTIVE_PROFILE,
  intake: TEST_INTAKE,
  plan: "free" as const,
  role: "user" as const,
  status: "active" as const,
  onboardingStatus: "complete" as const,
  onboardingStep: null,
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

const REPLACED_PROFILE = {
  ...ACTIVE_PROFILE,
  birthData: {
    dateLocalIso: "1988-12-28T04:13:00-02:00",
    dateUtcIso: "1988-12-28T06:13:00.000Z",
    placeLabel: "Esquel, Chubut, Argentina",
    coordinates: { lat: -42.9135, lon: -71.31947 },
    timezoneOffsetHours: -2,
    ageYears: 37,
  },
};

async function seedLinkedChart(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem("astral_user", JSON.stringify(user));
  }, TEST_USER);
  await mockHealth(page);
  await mockChatHistory(page, []);
  await mockGetUser(page, LINKED_USER);
  await page.route("**/api/me/chat/context-budget", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        model: "gpt-4o-mini",
        provider: "openai",
        used: 1200,
        limit: 128000,
        percentUsed: 0.009375,
        breakdown: {
          system: 400,
          memory: 100,
          history: 200,
          tools: 300,
          response: 200,
        },
        blocks: [],
      },
    });
  });
  await page.route("**/api/places/autocomplete*", async (route) => {
    const q = (new URL(route.request().url()).searchParams.get("q") ?? "").toLowerCase();
    await route.fulfill({ status: 200, json: { results: q.includes("esq") ? [ESQUEL_RESULT] : [] } });
  });
}

async function openReplaceView(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Mi Carta" }).click();
  await page.getByRole("button", { name: "Reemplazar carta" }).click();
}

test.describe("Mi Carta — replace confirmation", () => {
  test("birth-data replace requires confirmation and posts the explicit wipe intent", async ({ page }) => {
    await seedLinkedChart(page);

    let oldEndpointCalled = false;
    let replaceRequests = 0;
    await page.route("**/api/me/bodygraph/from-birth", async (route) => {
      oldEndpointCalled = true;
      await route.fulfill({ status: 500, json: { error: "old_endpoint_should_not_be_used" } });
    });
    await page.route("**/api/me/bodygraph/replace", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      replaceRequests += 1;
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        confirmReplace?: boolean;
        date?: string;
        time?: string;
        place?: { lat?: number; lon?: number; label?: string };
      };
      expect(body.confirmReplace).toBe(true);
      expect(body.date).toBe("1988-12-28");
      expect(body.time).toBe("04:13");
      expect(body.place?.label).toContain("Esquel");
      await route.fulfill({
        status: 201,
        json: {
          user: { ...LINKED_USER, profile: REPLACED_PROFILE, intake: null },
          profile: REPLACED_PROFILE,
          asset: {
            id: "asset-replaced",
            filename: "generated-bodygraph.json",
            mimeType: "application/json",
            fileType: "hd",
            sizeBytes: 0,
            createdAt: "2026-05-25T12:00:00.000Z",
            isActive: true,
          },
        },
      });
    });

    await openReplaceView(page);
    await page.getByLabel("Fecha de nacimiento").fill("1988-12-28");
    await page.getByLabel("Hora local").fill("04:13");
    await page.getByLabel("Lugar de nacimiento").fill("Esq");
    await page.getByRole("button", { name: "Esquel Chubut, Argentina" }).click();

    await page.getByRole("button", { name: "Calcular y guardar" }).click();

    const dialog = page.getByRole("dialog", { name: "¿Reemplazar tu carta?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("vamos a borrar el chat, la memoria, tus respuestas de contexto y los informes");
    await expect(dialog).toContainText("Astral no mezcle datos de distintas cartas");
    expect(replaceRequests).toBe(0);

    await dialog.getByRole("button", { name: "No, mantener mi carta" }).click();
    await expect(dialog).toHaveCount(0);
    expect(replaceRequests).toBe(0);

    await page.getByRole("button", { name: "Calcular y guardar" }).click();
    await page.getByRole("dialog", { name: "¿Reemplazar tu carta?" }).getByRole("button", { name: "Reemplazar y reiniciar" }).dblclick();

    await expect(page.getByText("Carta reemplazada. Tu chat, memoria e informes se reiniciaron.")).toBeVisible();
    expect(replaceRequests).toBe(1);
    expect(oldEndpointCalled).toBe(false);
  });

  test("PDF replace sends confirmReplace in multipart only after the modal confirm", async ({ page }) => {
    await seedLinkedChart(page);

    let replaceRequests = 0;
    await page.route("**/api/me/bodygraph/replace", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      replaceRequests += 1;
      const body = route.request().postData() ?? "";
      expect(body).toContain('name="confirmReplace"');
      expect(body).toContain("true");
      expect(body).toContain('name="file"');
      await route.fulfill({
        status: 201,
        json: {
          user: { ...LINKED_USER, profile: REPLACED_PROFILE, intake: null },
          profile: REPLACED_PROFILE,
          asset: {
            id: "asset-replaced-pdf",
            filename: "mi-carta.pdf",
            mimeType: "application/pdf",
            fileType: "hd",
            sizeBytes: 1024,
            createdAt: "2026-05-25T12:00:00.000Z",
            isActive: true,
          },
        },
      });
    });

    await openReplaceView(page);
    await page.getByRole("tab", { name: "PDF" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "mi-carta.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test"),
    });
    await page.getByRole("button", { name: "Subir y canalizar" }).click();

    await expect(page.getByRole("dialog", { name: "¿Reemplazar tu carta?" })).toBeVisible();
    expect(replaceRequests).toBe(0);

    await page.getByRole("dialog", { name: "¿Reemplazar tu carta?" }).getByRole("button", { name: "Reemplazar y reiniciar" }).click();

    await expect(page.getByText("Carta reemplazada. Tu chat, memoria e informes se reiniciaron.")).toBeVisible();
    expect(replaceRequests).toBe(1);
  });
});
