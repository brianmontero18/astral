/**
 * Memory Reader — Unit tests for `<user_memory>` injection in buildSystemPrompt.
 *
 * Same shape as intake-in-chat.test.ts: pure-function tests on the prompt
 * builder, no DB / no LLM. Verifies presence/absence of the block, position
 * relative to the surrounding sections, and the rule mention in
 * "## Reglas de datos" that tells the LLM how to use the memory.
 */

import { describe, it, expect } from "vitest";
import { buildSystemPrompt, hashSystemPrompt, type UserProfile } from "../agent-service.js";
import type { WeeklyTransits } from "../transit-service.js";

const PROFILE: UserProfile = {
  name: "Camila",
  humanDesign: {
    type: "Generador Manifestante",
    strategy: "Responder e informar",
    authority: "Sacral",
    profile: "3/5",
    definition: "Single",
    incarnationCross: "Cruz de la Esfinge",
    notSelfTheme: "Frustración",
    variable: "PLR",
    digestion: "",
    environment: "",
    strongestSense: "",
    channels: [],
    activatedGates: [],
    definedCenters: ["Sacral"],
    undefinedCenters: ["Head"],
  },
};

const TRANSITS: WeeklyTransits = {
  fetchedAt: "2026-04-27T00:00:00.000Z",
  weekRange: "Apr 27 – May 3, 2026",
  planets: [],
  activatedChannels: [],
};

const SAMPLE_MEMORY = `## Identidad
- Coach somática para mujeres emprendedoras

## Negocio
- Lanza programa premium en mayo
- Trabaja desde casa con dos hijxs pequeñxs`;

describe("buildSystemPrompt — user_memory injection", () => {
  it("omits <user_memory> when memory is undefined", () => {
    const prompt = buildSystemPrompt(PROFILE, TRANSITS);
    expect(prompt).not.toContain("<user_memory>");
    expect(prompt).not.toContain("hechos verificados sobre la persona");
  });

  it("omits <user_memory> when memory is an empty string", () => {
    const prompt = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, "");
    expect(prompt).not.toContain("<user_memory>");
    expect(prompt).not.toContain("hechos verificados sobre la persona");
  });

  it("omits <user_memory> when memory is whitespace only", () => {
    const prompt = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, "  \n\n  ");
    expect(prompt).not.toContain("<user_memory>");
  });

  it("injects <user_memory> with the markdown body when memory is non-empty", () => {
    const prompt = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, SAMPLE_MEMORY);
    expect(prompt).toContain("<user_memory>");
    expect(prompt).toContain("</user_memory>");
    expect(prompt).toContain("Coach somática para mujeres emprendedoras");
    expect(prompt).toContain("Lanza programa premium en mayo");
  });

  it("includes the rule mentioning <user_memory> in '## Reglas de datos' only when present", () => {
    const without = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, "");
    const withMem = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, SAMPLE_MEMORY);
    expect(without).not.toContain("hechos verificados sobre la persona");
    expect(withMem).toContain("hechos verificados sobre la persona");
  });

  it("places </user_memory> after </user_profile> and before <transits week=", () => {
    const prompt = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, SAMPLE_MEMORY);
    // The rule text in "## Reglas de datos" mentions `<user_memory>` as a
    // literal string too; anchor on tag forms that ONLY appear in the
    // emitted block (closing tag and attributed transits opening).
    const profileEnd = prompt.indexOf("</user_profile>");
    const memoryEnd = prompt.indexOf("</user_memory>");
    const transitsStart = prompt.indexOf("<transits week=");
    expect(profileEnd).toBeGreaterThan(0);
    expect(memoryEnd).toBeGreaterThan(profileEnd);
    expect(transitsStart).toBeGreaterThan(memoryEnd);
  });

  it("places </user_memory> AFTER </business_context> when both are present", () => {
    const prompt = buildSystemPrompt(
      PROFILE,
      TRANSITS,
      undefined,
      { actividad: "Coach" },
      SAMPLE_MEMORY,
    );
    const businessEnd = prompt.indexOf("</business_context>");
    const memoryEnd = prompt.indexOf("</user_memory>");
    expect(businessEnd).toBeGreaterThan(0);
    expect(memoryEnd).toBeGreaterThan(businessEnd);
  });

  it("trims leading/trailing whitespace inside the emitted block", () => {
    const prompt = buildSystemPrompt(
      PROFILE,
      TRANSITS,
      undefined,
      undefined,
      "   \n\n## A\n- foo\n\n   ",
    );
    // The opening tag should be immediately followed by the trimmed content,
    // not a whitespace gap. Match `<user_memory>\n## A` (no extra blanks).
    expect(prompt).toContain("<user_memory>\n## A");
  });
});

describe("buildSystemPrompt + hashSystemPrompt — memory cache discipline", () => {
  it("produces a different hash when memory content changes", () => {
    const promptA = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, "## A\n- foo");
    const promptB = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, "## A\n- bar");
    expect(hashSystemPrompt(promptA)).not.toBe(hashSystemPrompt(promptB));
  });

  it("produces the SAME hash for byte-identical memory inputs (no hidden timestamps)", () => {
    // The cache-friendly promise of the memory block: identical inputs must
    // yield identical prompts, otherwise we'd be silently cache-busting on
    // every chat turn.
    const promptA = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, SAMPLE_MEMORY);
    const promptB = buildSystemPrompt(PROFILE, TRANSITS, undefined, undefined, SAMPLE_MEMORY);
    expect(hashSystemPrompt(promptA)).toBe(hashSystemPrompt(promptB));
  });
});
