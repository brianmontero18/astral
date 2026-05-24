import { getEncoding } from "js-tiktoken";

import type { Intake } from "../report/types.js";
import type { TransitImpact, WeeklyTransits } from "../transit-service.js";
import type { ChatMessage, LlmUsage } from "../types/agent.js";
import type { UserProfile } from "../types/agent.js";
import type {
  ContextBudgetBlock,
  ContextBudgetBlockId,
  ContextBudgetClientSummary,
  ContextBudgetPostCall,
  ContextBudgetPromptBlock,
  ContextBudgetProvider,
  ContextBudgetSnapshot,
} from "../types/context-budget.js";
import { hdTools } from "../hd-tools/index.js";
import { buildSystemPromptV2Blocks } from "../agent-service-v2-prompt.js";

export const CONTEXT_BUDGET_BLOCK_IDS: ContextBudgetBlockId[] = [
  "system_static",
  "profile",
  "intake",
  "memory",
  "transits",
  "impact",
  "tools_schema",
  "history",
  "current_message",
  "response",
];

const DEFAULT_RESERVED_OUTPUT_TOKENS = 1024;
const OPENAI_CONTEXT_WINDOW_TOKENS = 128000;

interface ModelContextSpec {
  provider: ContextBudgetProvider;
  contextWindowTokens: number | null;
}

const MODEL_CONTEXT_SPECS: Record<string, ModelContextSpec> = {
  "gpt-4o": {
    provider: "openai",
    contextWindowTokens: OPENAI_CONTEXT_WINDOW_TOKENS,
  },
  "gpt-4o-mini": {
    provider: "openai",
    contextWindowTokens: OPENAI_CONTEXT_WINDOW_TOKENS,
  },
};

interface EstimateContextBudgetInput {
  model: string;
  promptBlocks: readonly ContextBudgetPromptBlock[];
  messages: readonly ChatMessage[];
  toolsSchemaText: string;
  reservedOutputTokens?: number;
}

interface EstimateChatContextBudgetInput {
  model: string;
  profile: UserProfile;
  transits: WeeklyTransits;
  messages: readonly ChatMessage[];
  impact?: TransitImpact;
  intake?: Intake;
  memory?: string;
  reservedOutputTokens?: number;
}

const encoder = getEncoding("o200k_base");

function tokenCount(text: string): number {
  if (!text) return 0;
  return encoder.encode(text).length;
}

function getModelContextSpec(model: string): ModelContextSpec {
  return MODEL_CONTEXT_SPECS[model] ?? {
    provider: "unknown",
    contextWindowTokens: null,
  };
}

function percentOfWindow(tokens: number, contextWindowTokens: number | null): number | null {
  if (!contextWindowTokens) return null;
  return tokens / contextWindowTokens;
}

function findPromptBlockTokens(
  promptBlocks: readonly ContextBudgetPromptBlock[],
  id: ContextBudgetPromptBlock["id"],
): number {
  return tokenCount(promptBlocks.find((block) => block.id === id)?.content ?? "");
}

function splitHistoryAndCurrentMessage(messages: readonly ChatMessage[]): {
  history: readonly ChatMessage[];
  currentMessage: ChatMessage | null;
} {
  const last = messages.at(-1);
  if (!last || last.role !== "user") {
    return { history: messages, currentMessage: null };
  }
  return {
    history: messages.slice(0, -1),
    currentMessage: last,
  };
}

function serializeMessagesForBudget(messages: readonly ChatMessage[]): string {
  return messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
}

export function buildHdToolsSchemaBudgetText(): string {
  return Object.entries(hdTools)
    .map(([name, definition]) => {
      const description = typeof definition.description === "string"
        ? definition.description
        : "";
      return `${name}\n${description}\n${String(definition.inputSchema)}`;
    })
    .join("\n\n");
}

export function estimateContextBudget(
  input: EstimateContextBudgetInput,
): ContextBudgetSnapshot {
  const spec = getModelContextSpec(input.model);
  const { history, currentMessage } = splitHistoryAndCurrentMessage(input.messages);
  const reservedOutputTokens = input.reservedOutputTokens ?? DEFAULT_RESERVED_OUTPUT_TOKENS;

  const tokenById: Record<ContextBudgetBlockId, number> = {
    system_static: findPromptBlockTokens(input.promptBlocks, "system_static"),
    profile: findPromptBlockTokens(input.promptBlocks, "profile"),
    intake: findPromptBlockTokens(input.promptBlocks, "intake"),
    memory: findPromptBlockTokens(input.promptBlocks, "memory"),
    transits: findPromptBlockTokens(input.promptBlocks, "transits"),
    impact: findPromptBlockTokens(input.promptBlocks, "impact"),
    tools_schema: tokenCount(input.toolsSchemaText),
    history: tokenCount(serializeMessagesForBudget(history)),
    current_message: currentMessage ? tokenCount(currentMessage.content) : 0,
    response: reservedOutputTokens,
  };

  const estimatedInputTokens =
    tokenById.system_static +
    tokenById.profile +
    tokenById.intake +
    tokenById.memory +
    tokenById.transits +
    tokenById.impact +
    tokenById.tools_schema +
    tokenById.history +
    tokenById.current_message;
  const estimatedTotalTokens = estimatedInputTokens + reservedOutputTokens;

  const blocks: ContextBudgetBlock[] = CONTEXT_BUDGET_BLOCK_IDS.map((id) => ({
    id,
    tokens: tokenById[id],
    percentOfWindow: percentOfWindow(tokenById[id], spec.contextWindowTokens),
  }));

  return {
    model: input.model,
    provider: spec.provider,
    contextWindowTokens: spec.contextWindowTokens,
    estimatedInputTokens,
    reservedOutputTokens,
    estimatedTotalTokens,
    percentUsed: percentOfWindow(estimatedTotalTokens, spec.contextWindowTokens),
    blocks,
  };
}

export function estimateChatContextBudget(
  input: EstimateChatContextBudgetInput,
): ContextBudgetSnapshot {
  return estimateContextBudget({
    model: input.model,
    promptBlocks: buildSystemPromptV2Blocks(
      input.profile,
      input.transits,
      input.impact,
      input.intake,
      input.memory,
    ),
    messages: input.messages,
    toolsSchemaText: buildHdToolsSchemaBudgetText(),
    reservedOutputTokens: input.reservedOutputTokens,
  });
}

function blockTokens(snapshot: ContextBudgetSnapshot, id: ContextBudgetBlockId): number {
  return snapshot.blocks.find((block) => block.id === id)?.tokens ?? 0;
}

export function summarizeContextBudgetForClient(
  snapshot: ContextBudgetSnapshot,
): ContextBudgetClientSummary {
  return {
    model: snapshot.model,
    provider: snapshot.provider,
    used: snapshot.estimatedTotalTokens,
    limit: snapshot.contextWindowTokens,
    percentUsed: snapshot.percentUsed,
    breakdown: {
      system:
        blockTokens(snapshot, "system_static") +
        blockTokens(snapshot, "profile") +
        blockTokens(snapshot, "intake") +
        blockTokens(snapshot, "transits") +
        blockTokens(snapshot, "impact"),
      memory: blockTokens(snapshot, "memory"),
      history:
        blockTokens(snapshot, "history") +
        blockTokens(snapshot, "current_message"),
      tools: blockTokens(snapshot, "tools_schema"),
      response: blockTokens(snapshot, "response"),
    },
    blocks: snapshot.blocks,
  };
}

export function attachContextBudgetPostCall(
  snapshot: ContextBudgetSnapshot,
  usage: LlmUsage,
): ContextBudgetSnapshot {
  const inputTokens = usage.promptTokens;
  const postCall: ContextBudgetPostCall = {
    inputTokens,
    outputTokens: usage.completionTokens,
    cachedInputTokens: usage.cachedTokens ?? 0,
    calibrationRatio:
      snapshot.estimatedInputTokens > 0
        ? inputTokens / snapshot.estimatedInputTokens
        : null,
  };
  return { ...snapshot, postCall };
}
