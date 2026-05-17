/**
 * Prompt cache discipline.
 *
 * OpenAI's automatic prompt cache only helps when the prefix is byte-stable.
 * These tests lock the contract that everything before `# Contexto` is static
 * and all per-user/per-turn blocks come after it.
 */

import { describe, expect, it } from "vitest";
import { buildSystemPrompt, type UserProfile } from "../agent-service.js";
import { buildSystemPromptV2 } from "../agent-service-v2-prompt.js";
import type { Intake } from "../report/types.js";
import type { TransitImpact, WeeklyTransits } from "../transit-service.js";

const BASE_PROFILE: UserProfile = {
  name: "Daniela",
  birthData: {
    dateLocalIso: "1989-02-18T08:00:00-04:00",
    dateUtcIso: "1989-02-18T12:00:00Z",
    placeLabel: "Punta Cardon",
    timezoneOffsetHours: -4,
    ageYears: 37,
  },
  humanDesign: {
    type: "Generador",
    strategy: "Responder",
    authority: "Sacral",
    profile: "5/1",
    definition: "Single",
    incarnationCross: "Cruz de Foo",
    notSelfTheme: "Frustracion",
    variable: "PRR",
    digestion: "Calma",
    environment: "Mercados",
    strongestSense: "Vista",
    channels: [{ id: "1-8", name: "Inspiracion", circuit: "Individual" }],
    activatedGates: [
      { number: 1, line: 3, planet: "Sol", isPersonality: true },
      { number: 8, line: 4, planet: "Saturno", isPersonality: false },
    ],
    definedCenters: ["G", "Throat"],
    undefinedCenters: ["Head"],
  },
};

const OTHER_PROFILE: UserProfile = {
  ...BASE_PROFILE,
  name: "Camila",
  birthData: undefined,
  humanDesign: {
    ...BASE_PROFILE.humanDesign,
    type: "Projector",
    strategy: "Esperar invitacion",
    channels: [],
    activatedGates: [],
  },
};

const TRANSITS_A: WeeklyTransits = {
  fetchedAt: "2026-05-15T17:00:00.000Z",
  weekRange: "May 11 - May 17, 2026",
  planets: [
    { name: "Sun", longitude: 54.5, sign: "Tauro", degree: 24.5, isRetrograde: false, hdGate: 8, hdLine: 4 },
  ],
  activatedChannels: ["1-8"],
};

const TRANSITS_B: WeeklyTransits = {
  fetchedAt: "2026-05-16T17:00:00.000Z",
  weekRange: "May 18 - May 24, 2026",
  planets: [
    { name: "Moon", longitude: 12.1, sign: "Geminis", degree: 12.1, isRetrograde: false, hdGate: 20, hdLine: 1 },
  ],
  activatedChannels: [],
};

const IMPACT: TransitImpact = {
  personalChannels: [
    {
      channelId: "1-8",
      channelName: "Canal de Inspiracion",
      userGate: 1,
      transitGate: 8,
      transitPlanet: "Sun",
    },
  ],
  educationalChannels: [],
  reinforcedGates: [{ gate: 8, planet: "Sun" }],
  conditionedCenters: [{ center: "Head", gates: [{ gate: 61, planet: "Moon" }] }],
};

const INTAKE: Intake = {
  actividad: "Mentora de marcas personales",
  tipo_de_negocio: "marca_personal",
  desafio_actual: "Clarificar oferta",
  objetivo_12m: "Lanzar programa premium",
  voz_marca: "Directa",
};

const MEMORY = "## Negocio\n- Esta validando una oferta premium";

function staticPrefix(prompt: string): string {
  const contextStart = prompt.indexOf("# Contexto");
  expect(contextStart).toBeGreaterThan(0);
  return prompt.slice(0, contextStart);
}

function expectDynamicBlocksAfterContext(prompt: string) {
  const contextStart = prompt.indexOf("# Contexto");
  const dynamicNeedles = [
    "<user_profile name=",
    "\n<business_context>\n",
    "\n<user_memory>\n",
    "<transits week=",
    "\n<impact>\n",
  ];

  for (const needle of dynamicNeedles) {
    const index = prompt.indexOf(needle);
    if (index !== -1) {
      expect(index).toBeGreaterThan(contextStart);
    }
  }
}

describe.each([
  ["v1", buildSystemPrompt],
  ["v2", buildSystemPromptV2],
] as const)("buildSystemPrompt %s cache prefix", (_label, buildPrompt) => {
  it("keeps the full pre-Contexto prefix byte-stable across dynamic inputs", () => {
    const promptA = buildPrompt(BASE_PROFILE, TRANSITS_A);
    const promptB = buildPrompt(OTHER_PROFILE, TRANSITS_B, IMPACT, INTAKE, MEMORY);

    expect(staticPrefix(promptA)).toBe(staticPrefix(promptB));
  });

  it("places dynamic prompt blocks only after static knowledge and # Contexto", () => {
    const prompt = buildPrompt(BASE_PROFILE, TRANSITS_A, IMPACT, INTAKE, MEMORY);

    expect(prompt.indexOf("# Marco de Conocimiento")).toBeGreaterThan(0);
    expect(prompt.indexOf("# Contexto")).toBeGreaterThan(
      prompt.indexOf("# Marco de Conocimiento"),
    );
    expectDynamicBlocksAfterContext(prompt);
  });
});
