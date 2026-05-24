import { describe, expect, it } from "vitest";

import {
  CONTEXT_BUDGET_BLOCK_IDS,
  estimateContextBudget,
  summarizeContextBudgetForClient,
} from "../llm/context-budget.js";
import type { ChatMessage } from "../types/agent.js";

const promptBlocks = [
  { id: "system_static", content: "Static role, rules and HD knowledge." },
  { id: "profile", content: "<user_profile>Generator profile</user_profile>" },
  { id: "intake", content: "<business_context>premium services</business_context>" },
  { id: "memory", content: "<user_memory>She sells retreats.</user_memory>" },
  { id: "transits", content: "<transits><planet name=\"Sun\" /></transits>" },
  { id: "impact", content: "<impact><personal_channels /></impact>" },
] as const;

const messages: ChatMessage[] = [
  { role: "user", content: "Mensaje anterior" },
  { role: "assistant", content: "Respuesta anterior" },
  { role: "user", content: "Mensaje actual" },
];

describe("estimateContextBudget", () => {
  it("returns a stable canonical block breakdown for OpenAI chat context", () => {
    const snapshot = estimateContextBudget({
      model: "gpt-4o-mini",
      promptBlocks,
      messages,
      toolsSchemaText: "findChannelByGates gateA gateB getCenterForGate gate",
      reservedOutputTokens: 256,
    });

    expect(snapshot.model).toBe("gpt-4o-mini");
    expect(snapshot.provider).toBe("openai");
    expect(snapshot.contextWindowTokens).toBe(128000);
    expect(snapshot.blocks.map((block) => block.id)).toEqual(CONTEXT_BUDGET_BLOCK_IDS);
    expect(snapshot.estimatedTotalTokens).toBe(
      snapshot.estimatedInputTokens + snapshot.reservedOutputTokens,
    );
    expect(snapshot.blocks.find((block) => block.id === "history")?.tokens).toBeGreaterThan(0);
    expect(snapshot.blocks.find((block) => block.id === "current_message")?.tokens).toBeGreaterThan(0);
    expect(snapshot.blocks.find((block) => block.id === "tools_schema")?.tokens).toBeGreaterThan(0);
    expect(snapshot.blocks.find((block) => block.id === "response")?.tokens).toBe(256);
  });

  it("does not invent percentages for unknown model context windows", () => {
    const snapshot = estimateContextBudget({
      model: "future-model",
      promptBlocks,
      messages,
      toolsSchemaText: "tools",
      reservedOutputTokens: 128,
    });

    expect(snapshot.provider).toBe("unknown");
    expect(snapshot.contextWindowTokens).toBeNull();
    expect(snapshot.percentUsed).toBeNull();
    expect(snapshot.blocks.every((block) => block.percentOfWindow === null)).toBe(true);
  });
});

describe("summarizeContextBudgetForClient", () => {
  it("collapses canonical blocks into the stable endpoint breakdown", () => {
    const snapshot = estimateContextBudget({
      model: "gpt-4o-mini",
      promptBlocks,
      messages,
      toolsSchemaText: "findChannelByGates gateA gateB",
      reservedOutputTokens: 512,
    });

    const summary = summarizeContextBudgetForClient(snapshot);

    expect(summary.used).toBe(snapshot.estimatedTotalTokens);
    expect(summary.limit).toBe(128000);
    expect(summary.breakdown.system).toBeGreaterThan(0);
    expect(summary.breakdown.memory).toBeGreaterThan(0);
    expect(summary.breakdown.history).toBeGreaterThan(0);
    expect(summary.breakdown.tools).toBeGreaterThan(0);
    expect(summary.breakdown.response).toBe(512);
    expect(summary.blocks).toHaveLength(CONTEXT_BUDGET_BLOCK_IDS.length);
  });
});
