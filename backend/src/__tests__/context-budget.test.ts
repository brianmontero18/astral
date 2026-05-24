import { describe, expect, it } from "vitest";

import {
  buildHdToolsSchemaBudgetText,
  CONTEXT_BUDGET_BLOCK_IDS,
  estimateContextBudget,
  selectChatContextForBudget,
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
  it("serializes HD tool schemas with argument names instead of object placeholders", () => {
    const schemaText = buildHdToolsSchemaBudgetText();

    expect(schemaText).toContain("findChannelByGates");
    expect(schemaText).toContain("gateA");
    expect(schemaText).toContain("gateB");
    expect(schemaText).not.toContain("[object Object]");
  });

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

  it("uses the larger OpenAI context window for GPT-5.4 eval candidates", () => {
    const snapshot = estimateContextBudget({
      model: "gpt-5.4-mini",
      promptBlocks,
      messages,
      toolsSchemaText: "findChannelByGates gateA gateB getCenterForGate gate",
      reservedOutputTokens: 256,
    });

    expect(snapshot.provider).toBe("openai");
    expect(snapshot.contextWindowTokens).toBe(400_000);
    expect(snapshot.selection.reason).toBe("full_history_fits");
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

describe("selectChatContextForBudget", () => {
  it("keeps more than the legacy 60 messages when they fit the model budget", () => {
    const longSmallHistory: ChatMessage[] = [
      ...Array.from({ length: 70 }, (_, index) => ({
        role: index % 2 === 0 ? "user" as const : "assistant" as const,
        content: `short-${index + 1}`,
      })),
      { role: "user", content: "current short question" },
    ];

    const selected = selectChatContextForBudget({
      model: "gpt-4o-mini",
      promptBlocks,
      messages: longSmallHistory,
      toolsSchemaText: "tools",
      reservedOutputTokens: 256,
    });

    expect(selected.fitsWithinContextWindow).toBe(true);
    expect(selected.messages).toHaveLength(71);
    expect(selected.snapshot.selection).toMatchObject({
      selectedMessageCount: 71,
      omittedMessageCount: 0,
      reason: "full_history_fits",
    });
  });

  it("omits complete older messages by token budget without splitting messages", () => {
    const messagesThatCannotAllFit: ChatMessage[] = [
      ...Array.from({ length: 6 }, (_, index) => ({
        role: index % 2 === 0 ? "user" as const : "assistant" as const,
        content: `history-${index + 1} ${"detalle ".repeat(20)}`,
      })),
      { role: "user", content: "current question" },
    ];

    const selected = selectChatContextForBudget({
      model: "gpt-4o-mini",
      promptBlocks,
      messages: messagesThatCannotAllFit,
      toolsSchemaText: "tools",
      reservedOutputTokens: 127_900,
    });

    expect(selected.fitsWithinContextWindow).toBe(true);
    expect(selected.messages.at(-1)).toEqual({ role: "user", content: "current question" });
    expect(selected.messages.length).toBeLessThan(messagesThatCannotAllFit.length);
    expect(selected.messages.every((message) => messagesThatCannotAllFit.includes(message))).toBe(true);
    expect(selected.snapshot.selection.omittedMessageCount).toBeGreaterThan(0);
    expect(selected.snapshot.selection.omittedTokenEstimate).toBeGreaterThan(0);
    expect(selected.snapshot.selection.reason).toBe("token_budget_omitted_history");
  });

  it("reports hard-cap omissions separately from token-budget omissions", () => {
    const selected = selectChatContextForBudget({
      model: "gpt-4o-mini",
      promptBlocks,
      messages: [
        { role: "user", content: "oldest" },
        { role: "assistant", content: "older" },
        { role: "user", content: "recent" },
        { role: "assistant", content: "latest" },
        { role: "user", content: "current question" },
      ],
      toolsSchemaText: "tools",
      reservedOutputTokens: 256,
      historyMessageHardCap: 2,
    });

    expect(selected.fitsWithinContextWindow).toBe(true);
    expect(selected.messages).toEqual([
      { role: "user", content: "recent" },
      { role: "assistant", content: "latest" },
      { role: "user", content: "current question" },
    ]);
    expect(selected.snapshot.selection).toMatchObject({
      selectedMessageCount: 3,
      omittedMessageCount: 2,
      reason: "history_hard_cap_omitted",
    });
    expect(selected.snapshot.selection.omittedTokenEstimate).toBeGreaterThan(0);
  });

  it("rejects a current message that cannot fit even without history", () => {
    const selected = selectChatContextForBudget({
      model: "gpt-4o-mini",
      promptBlocks,
      messages: [{ role: "user", content: "x ".repeat(140_000) }],
      toolsSchemaText: "tools",
      reservedOutputTokens: 256,
    });

    expect(selected.fitsWithinContextWindow).toBe(false);
    expect(selected.snapshot.selection).toMatchObject({
      selectedMessageCount: 1,
      omittedMessageCount: 0,
      reason: "current_message_dominates",
    });
    expect(selected.snapshot.percentUsed).toBeGreaterThan(1);
  });

  it("uses conservative current-message-only selection for unknown models", () => {
    const selected = selectChatContextForBudget({
      model: "future-model",
      promptBlocks,
      messages,
      toolsSchemaText: "tools",
      reservedOutputTokens: 128,
    });

    expect(selected.fitsWithinContextWindow).toBe(true);
    expect(selected.messages).toEqual([{ role: "user", content: "Mensaje actual" }]);
    expect(selected.snapshot.provider).toBe("unknown");
    expect(selected.snapshot.percentUsed).toBeNull();
    expect(selected.snapshot.selection).toMatchObject({
      selectedMessageCount: 1,
      omittedMessageCount: 2,
      reason: "unknown_model_conservative",
    });
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
    expect(summary.selection).toMatchObject({
      selectedMessageCount: 3,
      omittedMessageCount: 0,
      reason: "full_history_fits",
    });
  });
});
