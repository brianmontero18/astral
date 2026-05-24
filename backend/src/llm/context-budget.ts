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
  ContextBudgetSelection,
  ContextBudgetSelectionReason,
  ContextBudgetSnapshot,
} from "../types/context-budget.js";
import { hdTools } from "../hd-tools/index.js";
import { buildSystemPromptV2Blocks } from "../agent-service-v2-prompt.js";
import {
  getChatModelContextSpec,
  getDefaultReservedOutputTokens,
} from "./model-registry.js";

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

export const DEFAULT_CHAT_HISTORY_HARD_CAP_MESSAGES = 200;

interface ModelContextSpec {
  provider: ContextBudgetProvider;
  contextWindowTokens: number | null;
}

interface EstimateContextBudgetInput {
  model: string;
  promptBlocks: readonly ContextBudgetPromptBlock[];
  messages: readonly ChatMessage[];
  toolsSchemaText: string;
  reservedOutputTokens?: number;
  historyMessageHardCap?: number;
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
  historyMessageHardCap?: number;
}

export interface SelectedChatContextBudget {
  messages: ChatMessage[];
  snapshot: ContextBudgetSnapshot;
  fitsWithinContextWindow: boolean;
}

export class ChatContextWindowExceededError extends Error {
  readonly code = "context_window_exceeded";
  readonly statusCode = 413;
  readonly contextBudget: ContextBudgetSnapshot;

  constructor(contextBudget: ContextBudgetSnapshot) {
    super(
      "Este mensaje es demasiado extenso para responderlo bien en una sola consulta. Dividilo en partes mas chicas para que Astral pueda leerlo completo.",
    );
    this.name = "ChatContextWindowExceededError";
    this.contextBudget = contextBudget;
  }
}

const encoder = getEncoding("o200k_base");

function tokenCount(text: string): number {
  if (!text) return 0;
  return encoder.encode(text).length;
}

function getModelContextSpec(model: string): ModelContextSpec {
  const spec = getChatModelContextSpec(model);
  if (!spec) {
    return {
      provider: "unknown",
      contextWindowTokens: null,
    };
  }
  return {
    provider: spec.provider,
    contextWindowTokens: spec.contextWindowTokens,
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

function messageTokenCount(message: ChatMessage): number {
  return tokenCount(`${message.role}: ${message.content}`);
}

function messagesTokenCount(messages: readonly ChatMessage[]): number {
  return messages.reduce((total, message) => total + messageTokenCount(message), 0);
}

interface JsonSchemaSerializable {
  toJSONSchema: () => unknown;
}

function hasJsonSchemaSerializer(inputSchema: unknown): inputSchema is JsonSchemaSerializable {
  if (typeof inputSchema !== "object" || inputSchema === null) return false;
  const candidate = inputSchema as { toJSONSchema?: unknown };
  return typeof candidate.toJSONSchema === "function";
}

function serializeInputSchemaForBudget(inputSchema: unknown): string {
  if (hasJsonSchemaSerializer(inputSchema)) {
    return JSON.stringify(inputSchema.toJSONSchema());
  }
  return JSON.stringify(inputSchema) ?? String(inputSchema);
}

export function buildHdToolsSchemaBudgetText(): string {
  return Object.entries(hdTools)
    .map(([name, definition]) => {
      const description = typeof definition.description === "string"
        ? definition.description
        : "";
      return `${name}\n${description}\n${serializeInputSchemaForBudget(definition.inputSchema)}`;
    })
    .join("\n\n");
}

function promptTokenById(
  promptBlocks: readonly ContextBudgetPromptBlock[],
): Record<Extract<ContextBudgetBlockId, ContextBudgetPromptBlock["id"]>, number> {
  return {
    system_static: findPromptBlockTokens(promptBlocks, "system_static"),
    profile: findPromptBlockTokens(promptBlocks, "profile"),
    intake: findPromptBlockTokens(promptBlocks, "intake"),
    memory: findPromptBlockTokens(promptBlocks, "memory"),
    transits: findPromptBlockTokens(promptBlocks, "transits"),
    impact: findPromptBlockTokens(promptBlocks, "impact"),
  };
}

function buildBlocks(
  tokenById: Record<ContextBudgetBlockId, number>,
  contextWindowTokens: number | null,
): ContextBudgetBlock[] {
  return CONTEXT_BUDGET_BLOCK_IDS.map((id) => ({
    id,
    tokens: tokenById[id],
    percentOfWindow: percentOfWindow(tokenById[id], contextWindowTokens),
  }));
}

function historyHardCap(input: EstimateContextBudgetInput): number {
  const configured = input.historyMessageHardCap ?? DEFAULT_CHAT_HISTORY_HARD_CAP_MESSAGES;
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : DEFAULT_CHAT_HISTORY_HARD_CAP_MESSAGES;
}

function buildSnapshot(input: {
  model: string;
  provider: ContextBudgetProvider;
  contextWindowTokens: number | null;
  tokenById: Record<ContextBudgetBlockId, number>;
  reservedOutputTokens: number;
  selection: ContextBudgetSelection;
}): ContextBudgetSnapshot {
  const estimatedInputTokens =
    input.tokenById.system_static +
    input.tokenById.profile +
    input.tokenById.intake +
    input.tokenById.memory +
    input.tokenById.transits +
    input.tokenById.impact +
    input.tokenById.tools_schema +
    input.tokenById.history +
    input.tokenById.current_message;
  const estimatedTotalTokens = estimatedInputTokens + input.reservedOutputTokens;

  return {
    model: input.model,
    provider: input.provider,
    contextWindowTokens: input.contextWindowTokens,
    estimatedInputTokens,
    reservedOutputTokens: input.reservedOutputTokens,
    estimatedTotalTokens,
    percentUsed: percentOfWindow(estimatedTotalTokens, input.contextWindowTokens),
    blocks: buildBlocks(input.tokenById, input.contextWindowTokens),
    selection: input.selection,
  };
}

export function selectChatContextForBudget(
  input: EstimateContextBudgetInput,
): SelectedChatContextBudget {
  const spec = getModelContextSpec(input.model);
  const { history, currentMessage } = splitHistoryAndCurrentMessage(input.messages);
  const cappedHistory = history.slice(-historyHardCap(input));
  const currentMessageTokens = currentMessage ? tokenCount(currentMessage.content) : 0;
  const reservedOutputTokens =
    input.reservedOutputTokens ?? getDefaultReservedOutputTokens(input.model);
  const promptTokens = promptTokenById(input.promptBlocks);
  const toolsSchemaTokens = tokenCount(input.toolsSchemaText);
  const staticInputTokens =
    promptTokens.system_static +
    promptTokens.profile +
    promptTokens.intake +
    promptTokens.memory +
    promptTokens.transits +
    promptTokens.impact +
    toolsSchemaTokens +
    currentMessageTokens;

  if (spec.contextWindowTokens === null) {
    const selectedMessages = currentMessage ? [currentMessage] : [];
    const selection: ContextBudgetSelection = {
      selectedMessageCount: selectedMessages.length,
      omittedMessageCount: history.length,
      omittedTokenEstimate: messagesTokenCount(history),
      currentMessageTokens,
      historyTokenBudget: 0,
      selectedHistoryTokens: 0,
      reason: "unknown_model_conservative",
    };
    const tokenById: Record<ContextBudgetBlockId, number> = {
      ...promptTokens,
      tools_schema: toolsSchemaTokens,
      history: 0,
      current_message: currentMessageTokens,
      response: reservedOutputTokens,
    };
    return {
      messages: selectedMessages,
      snapshot: buildSnapshot({
        model: input.model,
        provider: spec.provider,
        contextWindowTokens: spec.contextWindowTokens,
        tokenById,
        reservedOutputTokens,
        selection,
      }),
      fitsWithinContextWindow: true,
    };
  }

  const historyTokenBudget = Math.max(
    0,
    spec.contextWindowTokens - staticInputTokens - reservedOutputTokens,
  );
  const selectedHistory: ChatMessage[] = [];
  let selectedHistoryTokens = 0;

  for (let index = cappedHistory.length - 1; index >= 0; index -= 1) {
    const message = cappedHistory[index];
    if (!message) continue;
    const messageTokens = messageTokenCount(message);
    if (selectedHistoryTokens + messageTokens > historyTokenBudget) {
      break;
    }
    selectedHistory.unshift(message);
    selectedHistoryTokens += messageTokens;
  }

  const selectedMessages = currentMessage
    ? [...selectedHistory, currentMessage]
    : selectedHistory;
  const omittedMessageCount = history.length - selectedHistory.length;
  const omittedHistory = history.slice(0, omittedMessageCount);
  const omittedByHardCap = history.length - cappedHistory.length;
  const reason: ContextBudgetSelectionReason =
    staticInputTokens + reservedOutputTokens > spec.contextWindowTokens && currentMessage
      ? "current_message_dominates"
      : omittedMessageCount === 0
        ? "full_history_fits"
        : omittedByHardCap > 0 && selectedHistory.length === cappedHistory.length
          ? "history_hard_cap_omitted"
        : currentMessageTokens > historyTokenBudget
          ? "current_message_dominates"
          : "token_budget_omitted_history";
  const selection: ContextBudgetSelection = {
    selectedMessageCount: selectedMessages.length,
    omittedMessageCount,
    omittedTokenEstimate: messagesTokenCount(omittedHistory),
    currentMessageTokens,
    historyTokenBudget,
    selectedHistoryTokens,
    reason,
  };
  const tokenById: Record<ContextBudgetBlockId, number> = {
    ...promptTokens,
    tools_schema: toolsSchemaTokens,
    history: selectedHistoryTokens,
    current_message: currentMessageTokens,
    response: reservedOutputTokens,
  };
  const snapshot = buildSnapshot({
    model: input.model,
    provider: spec.provider,
    contextWindowTokens: spec.contextWindowTokens,
    tokenById,
    reservedOutputTokens,
    selection,
  });

  return {
    messages: selectedMessages,
    snapshot,
    fitsWithinContextWindow:
      snapshot.estimatedTotalTokens <= spec.contextWindowTokens,
  };
}

export function estimateContextBudget(
  input: EstimateContextBudgetInput,
): ContextBudgetSnapshot {
  return selectChatContextForBudget(input).snapshot;
}

export function estimateChatContextBudget(
  input: EstimateChatContextBudgetInput,
): ContextBudgetSnapshot {
  return selectChatContextForChatBudget(input).snapshot;
}

export function selectChatContextForChatBudget(
  input: EstimateChatContextBudgetInput,
): SelectedChatContextBudget {
  return selectChatContextForBudget({
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
    historyMessageHardCap: input.historyMessageHardCap,
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
    selection: snapshot.selection,
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
