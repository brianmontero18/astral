import { describe, expect, it } from "vitest";
import { calculateCost } from "../llm/pricing.js";

describe("calculateCost", () => {
  it("keeps the existing 3-argument full-price calculation", () => {
    expect(calculateCost("gpt-4o-mini", 200, 100)).toBeCloseTo(0.00009, 8);
  });

  it("charges cached input tokens at the cached-input rate", () => {
    const cost = calculateCost("gpt-4o-mini", 1000, 100, {
      cachedInputTokens: 600,
    });

    // 400 normal input @ $0.15/M + 600 cached input @ $0.075/M
    // + 100 output @ $0.60/M = $0.000165.
    expect(cost).toBeCloseTo(0.000165, 8);
  });

  it("clamps cached input tokens to the input total", () => {
    const cost = calculateCost("gpt-4o-mini", 100, 0, {
      cachedInputTokens: 500,
    });

    expect(cost).toBeCloseTo(0.0000075, 8);
  });

  it("returns 0 for unknown models even with cache details", () => {
    expect(calculateCost("unknown-model", 1000, 100, {
      cachedInputTokens: 900,
    })).toBe(0);
  });
});
