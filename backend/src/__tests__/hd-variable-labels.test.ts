/**
 * Tests para hd-variable-labels — los 13 labels semánticos del Variable Wheel
 * según Genetic Matrix Foundation Chart.
 *
 * Validados contra Agos Faedda (1988-12-28 06:13 UTC), única ground truth
 * disponible al 2026-05-17. Cuando llegue 2do chart con motivation != Fear,
 * agregar tests para Trajectory pairs no-Fear.
 */
import { describe, expect, it } from "vitest";
import { computeVariableLabels } from "../hd-variable-labels.js";
import { calculateBodygraph } from "../bodygraph/calculate.js";

// Ground truth: Agos's measured Variables (from astral-7w2 + Swiss Eph).
const AGOS_VARIABLES = {
  digestion:   { orientation: "left" as const,  color: 2, tone: 1, base: 1 },
  awareness:   { orientation: "left" as const,  color: 1, tone: 2, base: 1 },
  environment: { orientation: "right" as const, color: 4, tone: 5, base: 1 },
  perspective: { orientation: "left" as const,  color: 6, tone: 3, base: 1 },
};

describe("computeVariableLabels", () => {
  describe("Agos ground truth (13/13 labels validated against Foundation Chart)", () => {
    const labels = computeVariableLabels(AGOS_VARIABLES);

    it("Brain: digestion.tone=1 (left) → Active", () => {
      expect(labels.brain).toBe("Active");
    });

    it("Determination: digestion (color=2 Taste, tone=1 left) → Open", () => {
      expect(labels.determination).toBe("Open");
      expect(labels.determinationCategory).toBe("Taste");
    });

    it("Cognition: awareness.color=1 → Smell", () => {
      expect(labels.cognition).toBe("Smell");
    });

    it("Environment: environment.color=4 → Mountains", () => {
      expect(labels.environment).toBe("Mountains");
      expect(labels.environmentDetail).toBe("Mountains - Passive");
    });

    it("Environment Style: environment.tone=5 (right) → Observer", () => {
      expect(labels.environmentStyle).toBe("Observer");
    });

    it("Personality: awareness.tone=2 (left) → Strategic", () => {
      expect(labels.personality).toBe("Strategic");
    });

    it("Motivation: awareness.color=1 → Fear", () => {
      expect(labels.motivation).toBe("Fear");
    });

    it("Sense: awareness.tone=2 → Uncertainty", () => {
      expect(labels.sense).toBe("Uncertainty");
    });

    it("Trajectory: motivation Fear (color=1) + left tone (≤3) → Communalist", () => {
      expect(labels.trajectory).toBe("Communalist");
    });

    it("View Perspective: perspective.tone=3 (left) → Focused", () => {
      expect(labels.viewPerspective).toBe("Focused");
    });

    it("View: perspective.color=6 → Personal", () => {
      expect(labels.view).toBe("Personal");
    });

    it("Transferred Motivation: awareness.color=1 (Fear) → +3 mod 6 = 4 → Need", () => {
      expect(labels.transferredMotivation).toBe("Need");
    });

    it("Transferred View: perspective.color=6 (Personal) → +3 mod 6 = 3 → Power", () => {
      expect(labels.transferredView).toBe("Power");
    });
  });

  describe("orientation cutoff (tone 1-3 = left, 4-6 = right)", () => {
    const baseVars = {
      digestion:   { orientation: "left" as const,  color: 1, tone: 1, base: 1 },
      awareness:   { orientation: "left" as const,  color: 1, tone: 1, base: 1 },
      environment: { orientation: "left" as const,  color: 1, tone: 1, base: 1 },
      perspective: { orientation: "left" as const,  color: 1, tone: 1, base: 1 },
    };

    it("Brain flips at tone=4 (digestion)", () => {
      expect(computeVariableLabels({ ...baseVars, digestion: { ...baseVars.digestion, tone: 3 } }).brain).toBe("Active");
      expect(computeVariableLabels({ ...baseVars, digestion: { ...baseVars.digestion, tone: 4 } }).brain).toBe("Passive");
    });

    it("Personality flips at tone=4 (awareness)", () => {
      expect(computeVariableLabels({ ...baseVars, awareness: { ...baseVars.awareness, tone: 3 } }).personality).toBe("Strategic");
      expect(computeVariableLabels({ ...baseVars, awareness: { ...baseVars.awareness, tone: 4 } }).personality).toBe("Receptive");
    });

    it("Environment Style flips at tone=4", () => {
      expect(computeVariableLabels({ ...baseVars, environment: { ...baseVars.environment, tone: 3 } }).environmentStyle).toBe("Observed");
      expect(computeVariableLabels({ ...baseVars, environment: { ...baseVars.environment, tone: 4 } }).environmentStyle).toBe("Observer");
    });

    it("View Perspective flips at tone=4", () => {
      expect(computeVariableLabels({ ...baseVars, perspective: { ...baseVars.perspective, tone: 3 } }).viewPerspective).toBe("Focused");
      expect(computeVariableLabels({ ...baseVars, perspective: { ...baseVars.perspective, tone: 4 } }).viewPerspective).toBe("Peripheral");
    });
  });

  describe("transference pairs (color +3 mod 6)", () => {
    it("Motivation transference: Fear↔Need, Hope↔Guilt, Desire↔Innocence", () => {
      const make = (color: number) => ({
        ...AGOS_VARIABLES,
        awareness: { ...AGOS_VARIABLES.awareness, color },
      });
      expect(computeVariableLabels(make(1)).transferredMotivation).toBe("Need");
      expect(computeVariableLabels(make(4)).transferredMotivation).toBe("Fear");
      expect(computeVariableLabels(make(2)).transferredMotivation).toBe("Guilt");
      expect(computeVariableLabels(make(5)).transferredMotivation).toBe("Hope");
      expect(computeVariableLabels(make(3)).transferredMotivation).toBe("Innocence");
      expect(computeVariableLabels(make(6)).transferredMotivation).toBe("Desire");
    });

    it("View transference: Survival↔Wanting, Possibility↔Probability, Power↔Personal", () => {
      const make = (color: number) => ({
        ...AGOS_VARIABLES,
        perspective: { ...AGOS_VARIABLES.perspective, color },
      });
      expect(computeVariableLabels(make(1)).transferredView).toBe("Wanting");
      expect(computeVariableLabels(make(4)).transferredView).toBe("Survival");
      expect(computeVariableLabels(make(2)).transferredView).toBe("Probability");
      expect(computeVariableLabels(make(5)).transferredView).toBe("Possibility");
      expect(computeVariableLabels(make(3)).transferredView).toBe("Personal");
      expect(computeVariableLabels(make(6)).transferredView).toBe("Power");
    });
  });

  describe("invalid inputs", () => {
    it("returns empty strings for out-of-range color/tone", () => {
      const bad = {
        digestion:   { orientation: "left" as const,  color: 0, tone: 7, base: 1 },
        awareness:   { orientation: "left" as const,  color: 99, tone: -1, base: 1 },
        environment: { orientation: "left" as const,  color: 0, tone: 0, base: 1 },
        perspective: { orientation: "left" as const,  color: 7, tone: 0, base: 1 },
      };
      const labels = computeVariableLabels(bad);
      expect(labels.cognition).toBe("");
      expect(labels.motivation).toBe("");
      expect(labels.environment).toBe("");
      expect(labels.view).toBe("");
    });
  });
});

describe("calculateBodygraph populates variableLabels", () => {
  it("Agos: all 13 labels match Foundation Chart", async () => {
    const profile = await calculateBodygraph({
      date: "1988-12-28",
      time: "06:13",
      timezoneOffsetHours: 0,
    });
    const labels = profile.humanDesign.variableLabels;
    expect(labels).toBeDefined();
    expect(labels!.brain).toBe("Active");
    expect(labels!.determination).toBe("Open");
    expect(labels!.cognition).toBe("Smell");
    expect(labels!.environment).toBe("Mountains");
    expect(labels!.environmentDetail).toBe("Mountains - Passive");
    expect(labels!.environmentStyle).toBe("Observer");
    expect(labels!.personality).toBe("Strategic");
    expect(labels!.motivation).toBe("Fear");
    expect(labels!.sense).toBe("Uncertainty");
    expect(labels!.trajectory).toBe("Communalist");
    expect(labels!.viewPerspective).toBe("Focused");
    expect(labels!.view).toBe("Personal");
    expect(labels!.transferredMotivation).toBe("Need");
    expect(labels!.transferredView).toBe("Power");
  });
});
