import type { FastifyInstance } from "fastify";

import {
  CHAT_MODEL,
  CHAT_COMPLEX_MODEL,
  CHAT_SIMPLE_MODEL,
  hashSystemPrompt,
} from "../llm/model-config.js";
import { selectChatModel, selectMemoryWriterModel } from "../llm/model-routing.js";
import {
  ChatContextWindowExceededError,
  DEFAULT_CHAT_HISTORY_HARD_CAP_MESSAGES,
  selectChatContextForChatBudget,
  type SelectedChatContextBudget,
} from "../llm/context-budget.js";
import {
  type AgentCallMeta,
  type ChatMessage,
  type UserProfile,
} from "../types/agent.js";
import {
  runAstralAgentV2,
  runAstralAgentStreamV2,
} from "../agent-service-v2.js";
import {
  getRecentChatMessages,
  getTotalUserMessageCount,
  getUser,
  insertLlmCall,
  saveChatMessage,
  updateUserMemory,
} from "../db.js";
import { FLAGS } from "../config/flags.js";
import { calculateCost } from "../llm/pricing.js";
import {
  MEMORY_WRITER_MODEL,
  MEMORY_WRITER_RECENT_MESSAGES_WINDOW,
  runMemoryWriter,
  shouldTriggerMemoryWriter,
} from "../memory-writer.js";
import { analyzeTransitImpact } from "../transit-service.js";
import type { Intake } from "../report/types.js";
import type { ContextBudgetSnapshot, ModelRoutingRoute } from "../types/context-budget.js";
import {
  getTransitsForChat,
  type ParsedTransitChatContext,
} from "./guide-transits.js";
import { persistGuideLlmCall } from "./guide-telemetry.js";
import { beginGuideTurn } from "./user-operation-locks.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

function configuredChatHistoryHardCap(): number {
  const configured = Number(process.env.CHAT_HISTORY_TURNS);
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : DEFAULT_CHAT_HISTORY_HARD_CAP_MESSAGES;
}

export const CHAT_HISTORY_HARD_CAP = configuredChatHistoryHardCap();

export interface GuideTurnUserContext {
  profile: UserProfile;
  persistedUserId?: string;
  intake?: Intake | null;
  memory?: string;
}

export interface RunGuideTurnInput extends GuideTurnUserContext {
  app: FastifyInstance;
  messages: ChatMessage[];
  transitContext?: ParsedTransitChatContext;
  sideEffectsMode?: "web_persisted" | "mcp_read_only";
}

export interface RunGuideTurnResult {
  reply: string;
  transitsUsed: string;
  userMsgId?: number;
  assistantMsgId?: number;
}

export type StreamGuideChunkHandler = (chunk: string) => void;

async function buildGuideSelectedContext(
  input: GuideTurnUserContext & {
    app?: FastifyInstance;
    messages: ChatMessage[];
    transitContext?: ParsedTransitChatContext;
    route?: Extract<ModelRoutingRoute, "chat" | "chat_stream" | "mcp_ask">;
  },
): Promise<{
  transits: Awaited<ReturnType<typeof getTransitsForChat>>;
  impact: ReturnType<typeof analyzeTransitImpact>;
  intakeForChat?: Intake;
  memoryForChat?: string;
  selected: SelectedChatContextBudget;
}> {
  const transits = await getTransitsForChat(input.transitContext);
  const impact = analyzeTransitImpact(transits, {
    activatedGates: input.profile.humanDesign?.activatedGates ?? [],
    definedCenters: input.profile.humanDesign?.definedCenters ?? [],
  });
  const modelRouting = selectChatModel({
    route: input.route ?? "chat",
    messages: input.messages,
    defaultModel: CHAT_MODEL,
    simpleModel: CHAT_SIMPLE_MODEL,
    complexModel: CHAT_COMPLEX_MODEL,
  });
  const intakeForChat = FLAGS.CHAT_INTAKE_CONTEXT && input.intake ? input.intake : undefined;
  const memoryForChat = FLAGS.MEMORY_LIVING_DOCUMENT && input.memory ? input.memory : undefined;
  const selected = selectChatContextForChatBudget({
    model: modelRouting.model,
    profile: input.profile,
    transits,
    messages: input.messages,
    impact,
    intake: intakeForChat,
    memory: memoryForChat,
    historyMessageHardCap: CHAT_HISTORY_HARD_CAP,
  });
  const selectedWithRouting: SelectedChatContextBudget = {
    ...selected,
    snapshot: {
      ...selected.snapshot,
      modelRouting,
    },
  };

  if (input.app && selectedWithRouting.snapshot.selection.reason === "unknown_model_conservative") {
    input.app.log.warn(
      {
        model: selectedWithRouting.snapshot.model,
        userId: input.persistedUserId,
      },
      "chat_context_unknown_model",
    );
  }

  if (input.app && selectedWithRouting.snapshot.selection.omittedMessageCount > 0) {
    input.app.log.info(
      {
        userId: input.persistedUserId,
        reason: selectedWithRouting.snapshot.selection.reason,
        selected: selectedWithRouting.snapshot.selection.selectedMessageCount,
        omitted: selectedWithRouting.snapshot.selection.omittedMessageCount,
        historyTokenBudget: selectedWithRouting.snapshot.selection.historyTokenBudget,
      },
      "chat_context_history_selected",
    );
  }

  return {
    transits,
    impact,
    intakeForChat,
    memoryForChat,
    selected: selectedWithRouting,
  };
}

export async function buildGuideContextBudgetSnapshot(
  input: GuideTurnUserContext & {
    messages: ChatMessage[];
    transitContext?: ParsedTransitChatContext;
  },
): Promise<ContextBudgetSnapshot> {
  const context = await buildGuideSelectedContext(input);
  return context.selected.snapshot;
}

function assertGuideContextFits(selected: SelectedChatContextBudget): void {
  if (!selected.fitsWithinContextWindow) {
    throw new ChatContextWindowExceededError(selected.snapshot);
  }
}

export { ChatContextWindowExceededError };

/**
 * Fire-and-forget memory writer trigger.
 *
 * Called after the chat response is sent + persisted. Awaits nothing — the
 * user already has their reply. Failures are logged at warn level but never
 * propagate.
 *
 * Memory is re-read inside the closure (not captured at the call site) so a
 * fast follow-up turn can't feed the writer a snapshot that pre-dates the
 * previous writer's commit.
 */
function triggerGuideMemoryWriterAsync(
  app: FastifyInstance,
  userId: string,
): void {
  if (!FLAGS.MEMORY_LIVING_DOCUMENT) return;

  void (async () => {
    try {
      const total = await getTotalUserMessageCount(userId);
      if (!shouldTriggerMemoryWriter(total)) return;

      const user = await getUser(userId);
      if (!user) return;

      const recent = await getRecentChatMessages(userId, MEMORY_WRITER_RECENT_MESSAGES_WINDOW);
      if (recent.length === 0) return;

      const modelRouting = selectMemoryWriterModel({
        defaultModel: CHAT_MODEL,
        configuredModel: MEMORY_WRITER_MODEL,
      });
      const result = await runMemoryWriter(user.memory_md, recent, OPENAI_KEY, {
        model: modelRouting.model,
      });

      if (FLAGS.LLM_TELEMETRY) {
        try {
          await insertLlmCall({
            userId,
            route: "memory_writer",
            model: modelRouting.model,
            tokensIn: result.meta.usage.promptTokens,
            tokensOut: result.meta.usage.completionTokens,
            cachedTokens: result.meta.usage.cachedTokens ?? 0,
            costUsd: calculateCost(
              modelRouting.model,
              result.meta.usage.promptTokens,
              result.meta.usage.completionTokens,
              { cachedInputTokens: result.meta.usage.cachedTokens ?? 0 },
            ),
            latencyMs: result.meta.latencyMs,
            promptHash: hashSystemPrompt(result.meta.systemPrompt),
            contextBreakdown: { modelRouting },
          });
        } catch (err) {
          app.log.warn({ err, userId }, "memory writer telemetry insert failed");
        }
      }

      if (!result.noop) {
        await updateUserMemory(userId, result.memory);
      }
    } catch (err) {
      app.log.warn({ err, userId }, "memory writer run failed");
    }
  })();
}

export async function runGuideTurn(
  input: RunGuideTurnInput,
): Promise<RunGuideTurnResult> {
  const releaseGuideTurn = beginGuideTurn(input.persistedUserId);
  try {
    const sideEffectsMode = input.sideEffectsMode ?? "web_persisted";
    const route = sideEffectsMode === "mcp_read_only" ? "mcp_ask" : "chat";
    const context = await buildGuideSelectedContext({ ...input, route });
    assertGuideContextFits(context.selected);
    const result = await runAstralAgentV2(
      input.profile,
      context.transits,
      context.selected.messages,
      OPENAI_KEY,
      context.impact,
      context.intakeForChat,
      context.memoryForChat,
      context.selected.snapshot,
      { model: context.selected.snapshot.model },
    );

    if (input.persistedUserId) {
      await persistGuideLlmCall(
        input.app,
        input.persistedUserId,
        route,
        {
          ...result,
          model: context.selected.snapshot.model,
          contextBudget: result.contextBudget ?? context.selected.snapshot,
        },
      );
    }

    if (sideEffectsMode === "mcp_read_only") {
      return {
        reply: result.content,
        transitsUsed: context.transits.fetchedAt,
      };
    }

    const persisted = await persistGuideTurnMessages({
      app: input.app,
      persistedUserId: input.persistedUserId,
      messages: input.messages,
      replyText: result.content,
    });

    return {
      reply: result.content,
      transitsUsed: context.transits.fetchedAt,
      ...persisted,
    };
  } finally {
    releaseGuideTurn();
  }
}

export async function streamGuideTurn(
  input: RunGuideTurnInput,
  onChunk: StreamGuideChunkHandler,
): Promise<Omit<RunGuideTurnResult, "reply">> {
  const releaseGuideTurn = beginGuideTurn(input.persistedUserId);
  try {
    const context = await buildGuideSelectedContext({ ...input, route: "chat_stream" });
    assertGuideContextFits(context.selected);
    let fullText = "";
    const captured: { meta?: AgentCallMeta } = {};

    for await (const chunk of runAstralAgentStreamV2(
      input.profile,
      context.transits,
      context.selected.messages,
      OPENAI_KEY,
      context.impact,
      context.intakeForChat,
      context.memoryForChat,
      (meta) => { captured.meta = meta; },
      context.selected.snapshot,
      { model: context.selected.snapshot.model },
    )) {
      fullText += chunk;
      onChunk(chunk);
    }

    if (input.persistedUserId && captured.meta) {
      await persistGuideLlmCall(input.app, input.persistedUserId, "chat_stream", {
        ...captured.meta,
        model: context.selected.snapshot.model,
        contextBudget: captured.meta.contextBudget ?? context.selected.snapshot,
      });
    }

    const persisted = await persistGuideTurnMessages({
      app: input.app,
      persistedUserId: input.persistedUserId,
      messages: input.messages,
      replyText: fullText,
      requireReplyText: true,
    });

    return {
      transitsUsed: context.transits.fetchedAt,
      ...persisted,
    };
  } finally {
    releaseGuideTurn();
  }
}

async function persistGuideTurnMessages(input: {
  app: FastifyInstance;
  persistedUserId?: string;
  messages: ChatMessage[];
  replyText: string;
  requireReplyText?: boolean;
}): Promise<{ userMsgId?: number; assistantMsgId?: number }> {
  if (!input.persistedUserId || (input.requireReplyText && !input.replyText)) {
    return {};
  }

  const lastUserMsg = input.messages[input.messages.length - 1];
  const userMsgId = lastUserMsg
    ? await saveChatMessage(input.persistedUserId, lastUserMsg.role, lastUserMsg.content)
    : undefined;
  const assistantMsgId = await saveChatMessage(input.persistedUserId, "assistant", input.replyText);

  triggerGuideMemoryWriterAsync(input.app, input.persistedUserId);

  return { userMsgId, assistantMsgId };
}
