/**
 * Quality Suite builder — Unit tests
 *
 * Verifies that runChatQualityEvals / runReportQualityEvals assemble the right
 * EvalSuite[] and that grounding gates are derived from the verified profile.
 */

import { describe, it, expect } from "vitest";
import type { UserProfile } from "../types/agent.js";
import { runChatQualityEvals, runReportQualityEvals } from "../evals/quality-suite.js";
import { runEvals } from "../evals/prompt-eval.js";

const PROFILE: UserProfile = {
  name: "Pilar",
  humanDesign: {
    type: "Generador",
    strategy: "Responder",
    authority: "Sacral",
    profile: "6/2",
    definition: "Single",
    incarnationCross: "Cruz de Foo",
    notSelfTheme: "Frustración",
    variable: "PRR",
    digestion: "",
    environment: "",
    strongestSense: "",
    channels: [{ id: "20-34", name: "Carisma", circuit: "Integración" }],
    activatedGates: [
      { number: 20, line: 3, planet: "Sol", isPersonality: true },
      { number: 34, line: 1, planet: "Marte", isPersonality: false },
    ],
    definedCenters: ["Sacral", "Throat"],
    undefinedCenters: ["Head", "Ajna"],
  },
};

describe("runChatQualityEvals", () => {
  it("assembles the 8 chat checks without forcing HD mention", () => {
    const names = runChatQualityEvals({
      output: "Texto.",
      userInput: "¿Cómo viene la semana?",
      profile: PROFILE,
    }).map((s) => s.name);

    expect(names).toEqual([
      "no-hallucinated-gates",
      "spanish",
      "uses-business-context",
      "hd-citation-changes-advice",
      "no-generic-advisor-language",
      "emotional-altitude",
      "anti-sycophancy",
      "no-default-report-scaffold",
    ]);
    // HD presence is NOT forced on chat turns (rubric: HD only when it changes advice).
    expect(names).not.toContain("mentions-gates");
    expect(names).not.toContain("mentions-centers");
  });

  it("derives valid gates from the profile so a hallucinated gate fails grounding", () => {
    const suites = runChatQualityEvals({
      output: "Hoy la Puerta 64 te empuja a actuar.", // 64 is neither natal nor in transit
      userInput: "¿Qué hago hoy?",
      profile: PROFILE,
    });
    const { results } = runEvals(suites);
    const grounding = results.find((r) => r.name === "no-hallucinated-gates");
    expect(grounding?.pass).toBe(false);
  });

  it("counts transit gates as valid grounding (no false hallucination on weekly readings)", () => {
    const groundingOf = (transitGates: number[]) => {
      const { results } = runEvals(
        runChatQualityEvals({
          // Gate 17 is NOT natal (profile has 20, 34) — only valid via transit.
          output: "Esta semana Neptuno activa tu Puerta 17, por eso conviene expresar ideas.",
          userInput: "¿Cómo está mi energía esta semana?",
          profile: PROFILE,
          transitGates,
        }),
      );
      return results.find((r) => r.name === "no-hallucinated-gates")?.pass;
    };

    // Without the transit context the natal-only set would flag it (the old bug).
    expect(groundingOf([])).toBe(false);
    // With gate 17 in transit, the same citation is correctly grounded.
    expect(groundingOf([17])).toBe(true);
  });

  it("flags a generic, sycophantic chat answer", () => {
    const suites = runChatQualityEvals({
      output: "Esta semana es propicia. Es una gran oportunidad para vender, relanzá con confianza.",
      userInput: "Quiero relanzar y vender ya.",
      profile: PROFILE,
    });
    const { results } = runEvals(suites);
    const failed = results.filter((r) => !r.pass).map((r) => r.name);
    expect(failed).toContain("no-generic-advisor-language");
    expect(failed).toContain("anti-sycophancy");
  });
});

describe("runReportQualityEvals", () => {
  it("returns only the advisor checks when not legacy format", () => {
    const names = runReportQualityEvals({ output: "Texto.", profile: PROFILE }).map((s) => s.name);
    expect(names).toEqual([
      "spanish",
      "no-hallucinated-gates",
      "no-generic-advisor-language",
      "uses-business-context",
      "hd-citation-changes-advice",
    ]);
  });

  it("adds the legacy structural checks for the weekly 7-section format", () => {
    const names = runReportQualityEvals({ output: "Texto.", profile: PROFILE, legacyFormat: true }).map(
      (s) => s.name,
    );
    expect(names).toContain("legacy-sections");
    expect(names).toContain("legacy-no-pre-text");
    expect(names).toContain("legacy-min-sentences");
    expect(names).toContain("legacy-no-markdown");
    expect(names).toHaveLength(9);
  });
});
