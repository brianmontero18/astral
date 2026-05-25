import { Buffer } from "node:buffer";

import { test, expect, type Page } from "@playwright/test";

import {
  mockBodygraphChartSvg,
  mockBodygraphFullSvg,
  mockBodygraphPdfDownload,
  mockChatContextBudget,
  mockChatHistory,
  mockGenerateReport,
  mockGetReport,
  mockGetReportStale,
  mockGetUser,
  mockHealth,
  mockTransits,
  mockUpdateUser,
} from "../helpers/mock-api";
import {
  FREE_REPORT,
  HD_PROFILE,
  HISTORY_MESSAGES,
  TEST_INTAKE,
  TEST_USER,
} from "../helpers/fixtures";

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

const ACTIVE_PROFILE = {
  ...HD_PROFILE,
  birthData: {
    dateLocalIso: "1989-02-18T12:00:00-03:00",
    dateUtcIso: "1989-02-18T15:00:00.000Z",
    placeLabel: "Buenos Aires, Argentina",
    coordinates: { lat: -34.6037, lon: -58.3816 },
    timezoneOffsetHours: -3,
    ageYears: 37,
  },
  humanDesign: {
    ...HD_PROFILE.humanDesign,
    type: "Generador",
    authority: "Emocional",
    profile: "6/2",
    definition: "Simple",
    strategy: "Esperar para responder",
    notSelfTheme: "Frustración",
    incarnationCross: "Cruz del Ángulo Derecho del Edén",
    design: { date: "1988-11-20T22:10:00.000Z" },
    variableLabels: {
      brain: "Activo",
      determination: "Caliente",
      determinationCategory: "Digestión",
      cognition: "Olfato",
      environment: "Costas",
      environmentDetail: "Costas naturales",
      environmentStyle: "Observado",
      personality: "Derecha",
      motivation: "Esperanza",
      sense: "Sentir",
      trajectory: "Personal",
      viewPerspective: "Probabilidad",
      view: "Poder",
      transferredMotivation: "Culpa",
      transferredView: "Posibilidad",
    },
    channels: [{ id: "20-34", name: "Canal de Carisma", circuit: "Integración" }],
    activatedGates: [
      { number: 34, line: 1, planet: "Sun", isPersonality: true },
      { number: 57, line: 2, planet: "Earth", isPersonality: false },
    ],
    definedCenters: ["Sacral", "Throat"],
    undefinedCenters: ["Head", "Ajna", "G", "Heart", "Spleen", "SolarPlexus", "Root"],
  },
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
  humanDesign: {
    ...ACTIVE_PROFILE.humanDesign,
    type: "Proyector",
    authority: "Esplénica",
    profile: "3/5",
    strategy: "Esperar la invitación",
    activatedGates: [
      { number: 48, line: 3, planet: "Sun", isPersonality: true },
      { number: 16, line: 5, planet: "Earth", isPersonality: false },
    ],
    channels: [{ id: "16-48", name: "Canal de la Longitud de Onda", circuit: "Colectivo" }],
  },
};

const ACTIVE_USER = {
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

const RESET_USER = {
  ...ACTIVE_USER,
  profile: REPLACED_PROFILE,
  intake: null,
};

async function seedMyChartShell(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem("astral_user", JSON.stringify(user));
  }, TEST_USER);
  await mockHealth(page);
  await mockChatContextBudget(page);
  await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
  await mockGetUser(page, ACTIVE_USER);
  await mockTransits(page);
  await mockBodygraphChartSvg(page);
  await mockBodygraphFullSvg(page);
  await mockBodygraphPdfDownload(page);
}

async function openMyChart(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Mi Carta" }).click();
}

async function mockPlaces(page: Page) {
  await page.route("**/api/places/autocomplete*", async (route) => {
    const query = (new URL(route.request().url()).searchParams.get("q") ?? "").toLowerCase();
    await route.fulfill({ status: 200, json: { results: query.includes("esq") ? [ESQUEL_RESULT] : [] } });
  });
}

async function mockBirthReplace(page: Page) {
  await page.route("**/api/me/bodygraph/replace", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const body = JSON.parse(route.request().postData() ?? "{}") as {
      confirmReplace?: boolean;
      date?: string;
      time?: string;
      place?: { label?: string };
    };
    expect(body).toMatchObject({
      confirmReplace: true,
      date: "1988-12-28",
      time: "04:13",
    });
    expect(body.place?.label).toContain("Esquel");
    await route.fulfill({
      status: 201,
      json: {
        user: RESET_USER,
        profile: REPLACED_PROFILE,
        asset: {
          id: "asset-replaced-birth",
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
}

async function mockPdfReplace(page: Page) {
  await page.route("**/api/me/bodygraph/replace", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const body = route.request().postData() ?? "";
    expect(body).toContain('name="confirmReplace"');
    expect(body).toContain("true");
    expect(body).toContain('name="file"');
    await route.fulfill({
      status: 201,
      json: {
        user: RESET_USER,
        profile: REPLACED_PROFILE,
        asset: {
          id: "asset-replaced-pdf",
          filename: "bodygraph.pdf",
          mimeType: "application/pdf",
          fileType: "hd",
          sizeBytes: 1024,
          createdAt: "2026-05-25T12:00:00.000Z",
          isActive: true,
        },
      },
    });
  });
}

async function expectResetVisible(page: Page) {
  await expect(page.getByText("Carta reemplazada. Tu chat, memoria e informes se reiniciaron.")).toBeVisible();
  await expect(page.getByText("Proyector").first()).toBeVisible();
  await expect(page.getByText("3/5").first()).toBeVisible();
  await expect(page.getByText("Esquel, Chubut, Argentina")).toBeVisible();

  await mockChatHistory(page, [], { used: 0, limit: 20 });
  await page.getByRole("button", { name: "Chat" }).click();
  await expect(page.getByText("Que transitos tengo esta semana?")).not.toBeVisible();
  await expect(page.getByText("Como afecta mi centro Sacral?")).not.toBeVisible();

  await mockGetReportStale(page);
  await mockUpdateUser(page);
  await mockGenerateReport(page, FREE_REPORT);
  await page.getByRole("button", { name: "Informe", exact: true }).click();
  await expect(page.getByText("Personalizá tu informe")).toBeVisible();
  await expect(page.getByLabel("¿A qué dedicás tu energía hoy?")).toHaveValue("");
}

test.describe("Mi Carta — bodygraph, downloads, and replace reset", () => {
  test("renders the active bodygraph, identity card, variables, and download endpoints", async ({ page }) => {
    await seedMyChartShell(page);
    await openMyChart(page);

    await expect(page.getByRole("img", { name: "Bodygraph" })).toBeVisible();
    await expect(page.getByRole("heading", { name: TEST_USER.name })).toBeVisible();
    await expect(page.getByText("Generador").first()).toBeVisible();
    await expect(page.getByText("6/2").first()).toBeVisible();
    await expect(page.getByText("Emocional").first()).toBeVisible();
    await expect(page.getByText("Buenos Aires, Argentina")).toBeVisible();
    await expect(page.getByText(/18 de febrero de 1989/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Diseño" })).toBeVisible();
    await expect(page.getByText("Cerebro")).toBeVisible();
    await expect(page.getByText("Caliente")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Personalidad" })).toBeVisible();
    await expect(page.getByText("Esperanza")).toBeVisible();

    await page.getByRole("button", { name: /Descargar/ }).click();
    const pdfResponse = page.waitForResponse((response) =>
      response.url().includes("/api/me/bodygraph/pdf") &&
      response.status() === 200 &&
      response.headers()["content-type"]?.includes("application/pdf") === true,
    );
    await page.getByRole("menuitem", { name: "Como PDF" }).click();
    await pdfResponse;

    await openMyChart(page);
    await page.getByRole("button", { name: /Descargar/ }).click();
    const svgResponse = page.waitForResponse((response) =>
      response.url().includes("/api/me/bodygraph/full-svg") &&
      response.status() === 200 &&
      response.headers()["content-type"]?.includes("image/svg+xml") === true,
    );
    await page.getByRole("menuitem", { name: "Como imagen" }).click();
    await svgResponse;
  });

  test("birth-data replace returns to Mi Carta with the new chart and reset surfaces", async ({ page }) => {
    await seedMyChartShell(page);
    await mockPlaces(page);
    await mockBirthReplace(page);
    await openMyChart(page);

    await page.getByRole("button", { name: "Reemplazar carta" }).click();
    await page.getByLabel("Fecha de nacimiento").fill("1988-12-28");
    await page.getByLabel("Hora local").fill("04:13");
    await page.getByLabel("Lugar de nacimiento").fill("Esq");
    await page.getByRole("button", { name: "Esquel Chubut, Argentina" }).click();
    await page.getByRole("button", { name: "Calcular y guardar" }).click();
    await page.getByRole("dialog", { name: "¿Reemplazar tu carta?" }).getByRole("button", { name: "Reemplazar y reiniciar" }).click();

    await expectResetVisible(page);
  });

  test("PDF replace follows the same confirmed reset path", async ({ page }) => {
    await seedMyChartShell(page);
    await mockPdfReplace(page);
    await openMyChart(page);

    await page.getByRole("button", { name: "Reemplazar carta" }).click();
    await page.getByRole("tab", { name: "PDF" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "bodygraph.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 bodygraph test"),
    });
    await page.getByRole("button", { name: "Subir y canalizar" }).click();
    await page.getByRole("dialog", { name: "¿Reemplazar tu carta?" }).getByRole("button", { name: "Reemplazar y reiniciar" }).click();

    await expectResetVisible(page);
  });
});
