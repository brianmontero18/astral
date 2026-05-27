/**
 * Prompt cache discipline.
 *
 * OpenAI's automatic prompt cache only helps when the prefix is byte-stable.
 * These tests lock the contract that everything before `# Contexto` is static
 * and all per-user/per-turn blocks come after it.
 */

import { describe, expect, it } from "vitest";
import { buildSystemPromptV2 } from "../agent-service-v2-prompt.js";
import type { Intake } from "../report/types.js";
import type { UserProfile } from "../types/agent.js";
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

describe("buildSystemPromptV2 cache prefix", () => {
  it("keeps the full pre-Contexto prefix byte-stable across dynamic inputs", () => {
    const promptA = buildSystemPromptV2(BASE_PROFILE, TRANSITS_A);
    const promptB = buildSystemPromptV2(OTHER_PROFILE, TRANSITS_B, IMPACT, INTAKE, MEMORY);

    expect(staticPrefix(promptA)).toBe(staticPrefix(promptB));
  });

  it("places dynamic prompt blocks only after static knowledge and # Contexto", () => {
    const prompt = buildSystemPromptV2(BASE_PROFILE, TRANSITS_A, IMPACT, INTAKE, MEMORY);

    expect(prompt.indexOf("# Marco de Conocimiento")).toBeGreaterThan(0);
    expect(prompt.indexOf("# Contexto")).toBeGreaterThan(
      prompt.indexOf("# Marco de Conocimiento"),
    );
    expectDynamicBlocksAfterContext(prompt);
  });
});

describe("buildSystemPromptV2 output policy", () => {
  it("does not force the legacy 7-section weekly report scaffold in chat", () => {
    const prompt = buildSystemPromptV2(BASE_PROFILE, TRANSITS_A);

    expect(prompt).not.toContain("# Formato de salida — Reporte semanal");
    expect(prompt).not.toContain("respondé con exactamente estas 7 secciones");
    expect(prompt).not.toContain("🔭 PANORAMA GENERAL");
    expect(prompt).not.toContain("⚡ ENERGÍA & CUERPO");
    expect(prompt).not.toContain("💼 TRABAJO & CREATIVIDAD");
    expect(prompt).not.toContain("❤️ VÍNCULOS & AMOR");
    expect(prompt).not.toContain("📣 COMUNICACIÓN & MARCA");
    expect(prompt).not.toContain("🧭 ESTRATEGIA DE LA SEMANA");
    expect(prompt).not.toContain("⚠️ PUNTOS DE ATENCIÓN");
  });

  it("states the production policy for normal chat and explicit reports", () => {
    const prompt = buildSystemPromptV2(BASE_PROFILE, TRANSITS_A);

    expect(prompt).toContain("Chat normal: respondé directo");
    expect(prompt).toContain("sin secciones fijas");
    expect(prompt).toContain("Cuando pidan un informe completo");
    expect(prompt).toContain("pestaña Informe");
    expect(prompt).toContain("No uses la plantilla fija de 7 secciones");
  });
});

describe("buildSystemPromptV2 tool-compliance hints", () => {
  it("normalizes known transit channel names to ids without leaking the label", () => {
    const transits: WeeklyTransits = {
      ...TRANSITS_A,
      activatedChannels: ["Canal de Inspiración"],
    };

    const prompt = buildSystemPromptV2(BASE_PROFILE, transits);

    expect(prompt).toContain("<activated_channel_ids>1-8</activated_channel_ids>");
    expect(prompt).not.toContain("<activated_channels>");
    expect(prompt).not.toContain("Canal de Inspiración");
  });

  it("does not leak channel names from dynamic context as ready-to-use facts", () => {
    const profile: UserProfile = {
      ...BASE_PROFILE,
      humanDesign: {
        ...BASE_PROFILE.humanDesign,
        channels: [{ id: "1-8", name: "LEAK_NATAL_CHANNEL", circuit: "Individual" }],
      },
    };
    const transits: WeeklyTransits = {
      ...TRANSITS_A,
      activatedChannels: ["LEAK_TRANSIT_CHANNEL"],
    };
    const impact: TransitImpact = {
      ...IMPACT,
      personalChannels: [
        {
          channelId: "1-8",
          channelName: "LEAK_IMPACT_CHANNEL",
          userGate: 1,
          transitGate: 8,
          transitPlanet: "Sol",
        },
      ],
    };

    const prompt = buildSystemPromptV2(profile, transits, impact);

    expect(prompt).not.toContain("LEAK_NATAL_CHANNEL");
    expect(prompt).not.toContain("LEAK_TRANSIT_CHANNEL");
    expect(prompt).not.toContain("LEAK_IMPACT_CHANNEL");
    expect(prompt).toContain("<natal_channel_ids>1-8</natal_channel_ids>");
    expect(prompt).toContain("<activated_channel_ids>—</activated_channel_ids>");
    expect(prompt).toContain("channel_id=\"1-8\"");
    expect(prompt).toContain("contexto dinámico indica relevancia");
  });
});
