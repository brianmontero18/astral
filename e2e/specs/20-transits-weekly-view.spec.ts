import { test, expect } from "@playwright/test";

import {
  mockChatHistory,
  mockGetUser,
  mockHealth,
} from "../helpers/mock-api";
import {
  HISTORY_MESSAGES,
  TEST_USER,
  TEST_USER_WITH_INTAKE,
} from "../helpers/fixtures";
import type { TransitsResponse } from "../../frontend/src/types";

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
          number: 55,
          line: 1,
          planet: "Sol",
          isPersonality: true,
        },
      ],
      definedCenters: ["Sacral", "Throat", "G"],
      undefinedCenters: ["Head", "Ajna", "Heart", "Spleen", "SolarPlexus", "Root"],
    },
  },
};

const TRANSITS_WITH_PERSONAL_IMPACT: TransitsResponse = {
  fetchedAt: "2026-04-21T12:00:00.000Z",
  weekRange: "21 de abril de 2026 – 27 de abril de 2026",
  planets: [
    {
      name: "Sol",
      longitude: 123.45,
      sign: "Tauro",
      degree: 3.45,
      isRetrograde: false,
      hdGate: 55,
      hdLine: 2,
    },
    {
      name: "Júpiter",
      longitude: 224.12,
      sign: "Escorpio",
      degree: 14.12,
      isRetrograde: false,
      hdGate: 39,
      hdLine: 4,
    },
    {
      name: "Saturno",
      longitude: 77.01,
      sign: "Géminis",
      degree: 17.01,
      isRetrograde: true,
      hdGate: 63,
      hdLine: 1,
    },
    {
      name: "Venus",
      longitude: 14.55,
      sign: "Aries",
      degree: 14.55,
      isRetrograde: false,
      hdGate: 35,
      hdLine: 5,
    },
    {
      name: "Marte",
      longitude: 16.01,
      sign: "Aries",
      degree: 16.01,
      isRetrograde: false,
      hdGate: 36,
      hdLine: 3,
    },
  ],
  activatedChannels: ["Canal de lo Transitorio"],
  impact: {
    personalChannels: [
      {
        channelId: "39-55",
        channelName: "Canal de la Emoción",
        userGate: 55,
        transitGate: 39,
        transitPlanet: "Júpiter",
      },
    ],
    educationalChannels: [
      {
        channelId: "35-36",
        channelName: "Canal de lo Transitorio",
        planet1: "Venus",
        planet2: "Marte",
      },
    ],
    reinforcedGates: [
      {
        gate: 55,
        planet: "Sol",
      },
    ],
    conditionedCenters: [
      {
        center: "Head",
        gates: [
          {
            gate: 63,
            planet: "Saturno",
          },
        ],
      },
    ],
  },
};

test.describe("Transits — Weekly view", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await mockGetUser(page, LINKED_TRANSIT_USER);
  });

  test("loads the weekly view, expands cards cleanly, and shows personalized impact for a linked user", async ({ page }) => {
    await page.route("**/api/transits**", async (route) => {
      await route.fulfill({
        status: 200,
        json: TRANSITS_WITH_PERSONAL_IMPACT,
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Tránsitos" }).click();

    await expect(page.getByRole("heading", { name: "Tránsitos de la Semana" })).toBeVisible();
    await expect(page.getByText("21 de abril de 2026 – 27 de abril de 2026")).toBeVisible();
    await expect(page.getByText("✦ ACTIVA TU PUERTA 55")).toBeVisible();
    await expect(page.getByText("CANALES PERSONALES ACTIVADOS")).toBeVisible();
    await expect(page.getByText("CENTROS CONDICIONADOS")).toBeVisible();
    await expect(page.getByText("PUERTAS REFORZADAS")).toBeVisible();
    await expect(page.getByText("Puerta 55 — Sol")).toBeVisible();
    await expect(page.getByText("Saturno en Puerta 63")).toBeVisible();

    await page.getByText("Sol", { exact: true }).click();
    await expect(page.getByText("Espíritu", { exact: true })).toBeVisible();
    await expect(page.getByText("Espíritu", { exact: true })).toHaveCount(1);

    await page.getByText("Sol", { exact: true }).click();
    await expect(page.getByText("Espíritu", { exact: true })).toHaveCount(0);

    await page.getByText("Canal de lo Transitorio", { exact: true }).click();
    await expect(page.getByText(/Crecer a través de experiencias emocionales intensas/)).toBeVisible();

    await page.getByText("Canal de la Emoción (39-55)").click();
    await expect(page.getByText(/Ola emocional que alterna entre melancolía y éxtasis creativo/)).toBeVisible();
  });

  test("shows a clear recoverable transit error and recovers on the next visit", async ({ page }) => {
    let transitAttempts = 0;

    await page.route("**/api/transits**", async (route) => {
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
        json: TRANSITS_WITH_PERSONAL_IMPACT,
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Tránsitos" }).click();

    await expect(page.getByText("No pudimos cargar tus tránsitos ahora. Probá de nuevo.")).toBeVisible();
    await expect(page.getByText("swiss ephemeris timeout on worker 3")).not.toBeVisible();

    await page.getByRole("button", { name: "Chat" }).click();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();

    await page.getByRole("button", { name: "Tránsitos" }).click();
    await expect(page.getByRole("heading", { name: "Tránsitos de la Semana" })).toBeVisible();
    await expect(page.getByText("CANALES PERSONALES ACTIVADOS")).toBeVisible();
    await expect(page.getByText("No pudimos cargar tus tránsitos ahora. Probá de nuevo.")).toHaveCount(0);
    expect(transitAttempts).toBeGreaterThanOrEqual(2);
  });
});
