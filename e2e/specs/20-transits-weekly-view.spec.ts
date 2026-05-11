import { test, expect } from "@playwright/test";

import {
  mockChatHistory,
  mockGetUser,
  mockHealth,
  mockTransitExperienceNext7Days,
  mockTransitExperienceToday,
  TRANSIT_EXPERIENCE_COLLECTIVE_ONLY,
  TRANSIT_EXPERIENCE_TODAY_TIMELINE,
} from "../helpers/mock-api";
import {
  HISTORY_MESSAGES,
  TEST_USER,
  TEST_USER_WITH_INTAKE,
} from "../helpers/fixtures";

const LINKED_TRANSIT_USER = {
  ...TEST_USER_WITH_INTAKE,
  plan: "free" as const,
  role: "user" as const,
  status: "active" as const,
  profile: {
    ...TEST_USER_WITH_INTAKE.profile,
    humanDesign: {
      ...TEST_USER_WITH_INTAKE.profile.humanDesign,
      activatedGates: [
        {
          number: 35,
          line: 5,
          planet: "Venus",
          isPersonality: true,
        },
      ],
      definedCenters: ["Sacral", "Throat", "G"],
      undefinedCenters: ["Head", "Ajna", "Heart", "Spleen", "SolarPlexus", "Root"],
    },
  },
};

test.describe("Transits — Experience view", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await mockGetUser(page, LINKED_TRANSIT_USER);
  });

  test("opens on Hoy/Ahora with interpretation before planet detail", async ({ page }) => {
    await mockTransitExperienceToday(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tránsitos" }).click();

    await expect(page.getByRole("heading", { name: "Tránsitos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Ahora · 08:15", { exact: true })).toBeVisible();
    await expect(page.getByText("LO PRINCIPAL AHORA")).toBeVisible();
    await expect(page.getByText("CÓMO TE TOCA")).toBeVisible();
    await expect(page.getByText("CENTROS", { exact: true })).toBeVisible();
    await expect(page.getByText("DETALLE PLANETARIO")).toBeVisible();

    const insightTop = await page.getByText("LO PRINCIPAL AHORA").boundingBox();
    const planetTop = await page.getByText("DETALLE PLANETARIO").boundingBox();
    expect(insightTop?.y).toBeLessThan(planetTop?.y ?? 0);
  });

  test("selects 14:00 locally without another transit request", async ({ page }) => {
    let transitRequests = 0;
    await page.route("**/api/transits/experience**", async (route) => {
      transitRequests += 1;
      await route.fulfill({
        status: 200,
        json: TRANSIT_EXPERIENCE_TODAY_TIMELINE,
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tránsitos" }).click();
    await expect(page.getByText("Ahora · 08:15", { exact: true })).toBeVisible();
    const requestsBeforeSlider = transitRequests;

    await page.getByLabel("Seleccionar hora del tránsito").fill("1");

    await expect(page.getByText("A las 14:00", { exact: true })).toBeVisible();
    await expect(page.getByText("Canal de lo Transitorio", { exact: true }).first()).toBeVisible();
    expect(transitRequests).toBe(requestsBeforeSlider);

    await page.getByRole("button", { name: "Ahora" }).click();
    await expect.poll(() => transitRequests).toBe(requestsBeforeSlider + 1);
  });

  test("renders Próximos 7 días as panorama without daily precision promise", async ({ page }) => {
    await mockTransitExperienceToday(page);
    await mockTransitExperienceNext7Days(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tránsitos" }).click();
    await page.getByRole("button", { name: "Próximos 7 días" }).click();

    await expect(page.getByText("Tema de la semana · 10 may - 16 may · panorama colectivo")).toBeVisible();
    await expect(page.getByText("10 may - 16 may · panorama colectivo")).toBeVisible();
    await expect(page.getByText(/sin prometer precisión diaria/)).toBeVisible();
    await expect(page.getByText(/cada día/)).not.toBeVisible();
  });

  test("opens the bodygraph map view from the hero miniature and returns to ritual", async ({ page }) => {
    await mockTransitExperienceToday(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tránsitos" }).click();

    await expect(page.getByRole("heading", { name: "Tránsitos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver mapa del momento" })).toBeVisible();

    await page.getByRole("button", { name: "Ver mapa del momento" }).click();

    await expect(page.getByRole("img", { name: "Bodygraph del momento (vista completa)" })).toBeVisible();
    await expect(page.getByText("Tu definición permanente")).toBeVisible();
    await expect(page.getByText("EN TU DISEÑO")).toBeVisible();

    await page.getByRole("button", { name: "Volver a la lectura" }).click();

    await expect(page.getByText("LO PRINCIPAL AHORA")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver mapa del momento" })).toBeVisible();
  });

  test("renders Días clave with chronological summaries in panorama", async ({ page }) => {
    await mockTransitExperienceToday(page);
    await mockTransitExperienceNext7Days(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tránsitos" }).click();
    await page.getByRole("button", { name: "Próximos 7 días" }).click();

    await expect(page.getByText("DÍAS CLAVE")).toBeVisible();
    await expect(page.getByText("Canal de lo Transitorio ya está activo.")).toBeVisible();
    await expect(page.getByText("Cierra Canal de lo Transitorio.")).toBeVisible();
    await expect(page.getByText("Marte cambia a Puerta 40.")).toBeVisible();
    await expect(page.getByText("Hoy dom")).toBeVisible();
    await expect(page.getByText("jue 14")).toBeVisible();
  });

  test("sends transitContext.targetAt to chat from a selected hour CTA", async ({ page }) => {
    let chatPayload: unknown = null;
    await mockTransitExperienceToday(page);
    await page.route("**/api/chat/stream", async (route) => {
      chatPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: `data: ${JSON.stringify({ content: "Respuesta sobre las 14:00." })}\n\ndata: ${JSON.stringify({ done: true, transits_used: "2026-05-10T14:00:00.000Z", userMsgId: 50, assistantMsgId: 51 })}\n\n`,
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tránsitos" }).click();
    await page.getByLabel("Seleccionar hora del tránsito").fill("1");
    await page.getByRole("button", { name: /Preguntale al agente/ }).click();

    await expect(page.getByPlaceholder(/Preguntá al oráculo/)).toBeVisible();
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("Respuesta sobre las 14:00.")).toBeVisible();
    expect(chatPayload).toMatchObject({
      transitContext: {
        source: "transitScreen",
        mode: "today",
        snapshotId: "hour:2026-05-10T14:00:00.000Z",
        targetAt: "2026-05-10T14:00:00.000Z",
      },
    });
  });

  test("degrades safely for collective-only and recovers after an error", async ({ page }) => {
    await mockTransitExperienceToday(page, TRANSIT_EXPERIENCE_COLLECTIVE_ONLY);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tránsitos" }).click();

    await expect(page.getByText("Lectura colectiva disponible")).toBeVisible();
    await expect(page.getByText("CÓMO TE TOCA")).toHaveCount(0);

    await page.getByRole("button", { name: "Chat" }).click();
    await expect(page.getByPlaceholder(/Preguntá al oráculo/)).toBeVisible();
  });

  test("shows a clear recoverable transit error and recovers on the next visit", async ({ page }) => {
    let transitAttempts = 0;

    await page.route("**/api/transits/experience**", async (route) => {
      transitAttempts += 1;

      if (transitAttempts === 1) {
        await route.fulfill({
          status: 502,
          json: { error: "swiss ephemeris timeout on worker 3" },
        });
        return;
      }

      await route.fulfill({
        status: 200,
        json: TRANSIT_EXPERIENCE_TODAY_TIMELINE,
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tránsitos" }).click();

    await expect(page.getByText("No pudimos cargar tus tránsitos ahora. Probá de nuevo.")).toBeVisible();
    await expect(page.getByText("swiss ephemeris timeout on worker 3")).not.toBeVisible();

    await page.getByRole("button", { name: "Chat" }).click();
    await expect(page.getByPlaceholder(/Preguntá al oráculo/)).toBeVisible();

    await page.getByRole("button", { name: "Tránsitos" }).click();
    await expect(page.getByText("LO PRINCIPAL AHORA")).toBeVisible();
    expect(transitAttempts).toBeGreaterThanOrEqual(2);
  });
});
