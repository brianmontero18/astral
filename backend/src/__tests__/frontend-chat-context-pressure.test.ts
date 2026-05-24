import { describe, expect, it } from "vitest";

import {
  getChatContextPressureWarning,
  shouldShowContextPressureWarning,
  type ChatContextBudgetSummary,
} from "../../../frontend/src/chat-context-pressure";

const baseBudget: ChatContextBudgetSummary = {
  model: "gpt-4o-mini",
  provider: "openai",
  used: 10_000,
  limit: 128_000,
  percentUsed: 0.08,
  breakdown: {
    system: 7_000,
    memory: 500,
    history: 1_000,
    tools: 1_000,
    response: 500,
  },
  blocks: [],
};

describe("frontend chat context pressure helpers", () => {
  it("does not warn when context budget is healthy", () => {
    expect(getChatContextPressureWarning(baseBudget)).toBeNull();
  });

  it("warns from measured context-window pressure, not message count heuristics", () => {
    const warning = getChatContextPressureWarning({
      ...baseBudget,
      used: 90_000,
      percentUsed: 0.72,
      breakdown: {
        ...baseBudget.breakdown,
        history: 12_000,
      },
    });

    expect(warning).toEqual({
      level: "elevated",
      title: "La conversación está creciendo",
      body: "Astral va a priorizar tus mensajes recientes y la memoria guardada para responder mejor.",
      dismissLabel: "Entendido",
    });
  });

  it("warns when history dominates a known or unknown context window", () => {
    const warning = getChatContextPressureWarning({
      ...baseBudget,
      limit: null,
      percentUsed: null,
      used: 18_000,
      breakdown: {
        ...baseBudget.breakdown,
        history: 8_500,
      },
    });

    expect(warning?.level).toBe("elevated");
  });

  it("keeps a dismissed warning hidden until pressure intensifies", () => {
    const elevated = getChatContextPressureWarning({
      ...baseBudget,
      percentUsed: 0.74,
    });
    const high = getChatContextPressureWarning({
      ...baseBudget,
      percentUsed: 0.88,
    });

    expect(shouldShowContextPressureWarning(elevated, null)).toBe(true);
    expect(shouldShowContextPressureWarning(elevated, "elevated")).toBe(false);
    expect(shouldShowContextPressureWarning(high, "elevated")).toBe(true);
  });
});

describe("frontend chat context pressure copy", () => {
  it("returns safe awareness copy without destructive compact actions", () => {
    const warning = getChatContextPressureWarning({
      ...baseBudget,
      percentUsed: 0.74,
    });

    expect(warning).not.toBeNull();
    const visibleCopy = `${warning!.title} ${warning!.body} ${warning!.dismissLabel}`;

    expect(visibleCopy).toContain("La conversación está creciendo");
    expect(visibleCopy).toContain("memoria guardada");
    expect(visibleCopy).toContain("Entendido");
    expect(visibleCopy).not.toContain("Compactar");
    expect(visibleCopy).not.toContain("Borrar");
  });
});
