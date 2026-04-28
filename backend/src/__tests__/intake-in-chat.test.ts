/**
 * Intake-in-chat — Unit tests
 *
 * Verifies that buildSystemPrompt injects the <business_context> block
 * exclusively when the intake has at least one populated field.
 */

import { describe, it, expect } from "vitest";
import { buildSystemPrompt, hashSystemPrompt, type UserProfile } from "../agent-service.js";
import type { WeeklyTransits } from "../transit-service.js";
import type { Intake } from "../report/types.js";

const PROFILE: UserProfile = {
  name: "Daniela",
  humanDesign: {
    type: "Generador",
    strategy: "Responder",
    authority: "Sacral",
    profile: "5/1",
    definition: "Single",
    incarnationCross: "Cruz de Foo",
    notSelfTheme: "Frustración",
    variable: "PRR",
    digestion: "",
    environment: "",
    strongestSense: "",
    channels: [{ id: "20-34", name: "Carisma", circuit: "Integración" }],
    activatedGates: [{ number: 20, line: 3, planet: "Sol", isPersonality: true }],
    definedCenters: ["Sacral", "Throat"],
    undefinedCenters: ["Head"],
  },
};

const TRANSITS: WeeklyTransits = {
  fetchedAt: "2026-04-20T00:00:00.000Z",
  weekRange: "Apr 20 – Apr 26, 2026",
  planets: [],
  activatedChannels: [],
};

describe("buildSystemPrompt — business_context injection", () => {
  it("does not inject <business_context> when intake is undefined", () => {
    const prompt = buildSystemPrompt(PROFILE, TRANSITS);
    expect(prompt).not.toContain("<business_context>");
    expect(prompt).not.toContain("integrá la actividad");
  });

  it("does not inject <business_context> when intake has no populated fields", () => {
    const intake: Intake = { actividad: "", objetivos: "", desafios: "" };
    const prompt = buildSystemPrompt(PROFILE, TRANSITS, undefined, intake);
    expect(prompt).not.toContain("<business_context>");
    expect(prompt).not.toContain("integrá la actividad");
  });

  it("injects all fields when the intake is fully populated", () => {
    const intake: Intake = {
      actividad: "Coach de mujeres emprendedoras",
      objetivos: "Lanzar curso premium en mayo",
      desafios: "Crear contenido sin sentirme drenada",
    };
    const prompt = buildSystemPrompt(PROFILE, TRANSITS, undefined, intake);
    expect(prompt).toContain("<business_context>");
    expect(prompt).toContain("<actividad>Coach de mujeres emprendedoras</actividad>");
    expect(prompt).toContain("<objetivos>Lanzar curso premium en mayo</objetivos>");
    expect(prompt).toContain("<desafios>Crear contenido sin sentirme drenada</desafios>");
    expect(prompt).toContain("integrá la actividad");
  });

  it("injects only the populated fields when the intake is partial", () => {
    const intake: Intake = { actividad: "Doula", objetivos: "" };
    const prompt = buildSystemPrompt(PROFILE, TRANSITS, undefined, intake);
    expect(prompt).toContain("<business_context>");
    expect(prompt).toContain("<actividad>Doula</actividad>");
    expect(prompt).not.toContain("<objetivos>");
    expect(prompt).not.toContain("<desafios>");
  });

  it("places <business_context> between </user_profile> and <transits>", () => {
    const intake: Intake = { actividad: "X" };
    const prompt = buildSystemPrompt(PROFILE, TRANSITS, undefined, intake);
    // The "Reglas de datos" section mentions `<business_context>` and
    // `<transits>` as plain text references. Anchor on tag forms that appear
    // ONLY in the actual emitted blocks: the `</…>` closing tag and the
    // `<transits week=` opening with attribute.
    const profileEnd = prompt.indexOf("</user_profile>");
    const businessEnd = prompt.indexOf("</business_context>");
    const transitsStart = prompt.indexOf("<transits week=");
    expect(profileEnd).toBeGreaterThan(0);
    expect(businessEnd).toBeGreaterThan(profileEnd);
    expect(transitsStart).toBeGreaterThan(businessEnd);
  });
});

describe("hashSystemPrompt", () => {
  it("returns a 16-char lowercase hex string", () => {
    expect(hashSystemPrompt("hello world")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashSystemPrompt("test")).toBe(hashSystemPrompt("test"));
  });

  it("differs across distinct inputs", () => {
    expect(hashSystemPrompt("a")).not.toBe(hashSystemPrompt("b"));
  });

  it("changes when the intake content changes", () => {
    const promptA = buildSystemPrompt(PROFILE, TRANSITS, undefined, { actividad: "A" });
    const promptB = buildSystemPrompt(PROFILE, TRANSITS, undefined, { actividad: "B" });
    expect(hashSystemPrompt(promptA)).not.toBe(hashSystemPrompt(promptB));
  });
});
