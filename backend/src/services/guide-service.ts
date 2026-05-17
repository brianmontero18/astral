import type { FastifyInstance } from "fastify";

import {
  hashSystemPrompt,
  runAstralAgent,
  runAstralAgentStream,
  type AgentCallMeta,
  type ChatMessage,
  type UserProfile,
} from "../agent-service.js";
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
import {
  getTransitsForChat,
  type ParsedTransitChatContext,
} from "./guide-transits.js";
import { persistGuideLlmCall } from "./guide-telemetry.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

/**
 * Cap on how many turns of conversation history travel back to the LLM per
 * request. `users.memory_md` carries the persistent facts across the gap,
 * so cutting older turns trims tokens without losing identity context.
 *
 * Default 60 (≈30 user/assistant pairs). Set via sparring + architect
 * deliberation 2026-05-16: bumped from 30 → 60 to push the cliff from
 * ~5 weeks of intensive use to ~10 weeks. The marginal cost is ~$0.11/mo
 * in the current beta (10 users), justified by zero observed cases of
 * truncation in production. Counter below tracks when the cap is hit so
 * we can decide on compaction (B/C/D) only if real data demands it.
 * See `docs/architecture/refactor-2026-05-decisions.md`.
 */
const CHAT_HISTORY_MAX = Number(process.env.CHAT_HISTORY_TURNS) || 60;

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
}

export interface RunGuideTurnResult {
  reply: string;
  transitsUsed: string;
  userMsgId?: number;
  assistantMsgId?: number;
}

export type StreamGuideChunkHandler = (chunk: string) => void;

function truncateChatHistory<T>(
  messages: T[],
  app?: FastifyInstance,
  userId?: string,
): T[] {
  if (messages.length <= CHAT_HISTORY_MAX) {
    return messages;
  }
  // Observability counter: log every truncation so we can query
  // `chat_history_truncated` events in prod. When this fires consistently,
  // re-open the compaction discussion with real data instead of speculation.
  app?.log.info(
    { userId, total: messages.length, cap: CHAT_HISTORY_MAX },
    "chat_history_truncated",
  );
  return messages.slice(-CHAT_HISTORY_MAX);
}

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

      const result = await runMemoryWriter(user.memory_md, recent, OPENAI_KEY);

      if (FLAGS.LLM_TELEMETRY) {
        try {
          await insertLlmCall({
            userId,
            route: "memory_writer",
            model: MEMORY_WRITER_MODEL,
            tokensIn: result.meta.usage.promptTokens,
            tokensOut: result.meta.usage.completionTokens,
            cachedTokens: result.meta.usage.cachedTokens ?? 0,
            costUsd: calculateCost(
              MEMORY_WRITER_MODEL,
              result.meta.usage.promptTokens,
              result.meta.usage.completionTokens,
              { cachedInputTokens: result.meta.usage.cachedTokens ?? 0 },
            ),
            latencyMs: result.meta.latencyMs,
            promptHash: hashSystemPrompt(result.meta.systemPrompt),
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
  const transits = await getTransitsForChat(input.transitContext);
  const impact = analyzeTransitImpact(transits, {
    activatedGates: input.profile.humanDesign?.activatedGates ?? [],
    definedCenters: input.profile.humanDesign?.definedCenters ?? [],
  });
  const intakeForChat = FLAGS.CHAT_INTAKE_CONTEXT && input.intake ? input.intake : undefined;
  const memoryForChat = FLAGS.MEMORY_LIVING_DOCUMENT && input.memory ? input.memory : undefined;
  const runAgent = FLAGS.CHAT_USE_TOOLS ? runAstralAgentV2 : runAstralAgent;
  const result = await runAgent(
    input.profile,
    transits,
    truncateChatHistory(input.messages, input.app, input.persistedUserId),
    OPENAI_KEY,
    impact,
    intakeForChat,
    memoryForChat,
  );

  if (input.persistedUserId) {
    await persistGuideLlmCall(input.app, input.persistedUserId, "chat", result);
  }

  const persisted = await persistGuideTurnMessages({
    app: input.app,
    persistedUserId: input.persistedUserId,
    messages: input.messages,
    replyText: result.content,
  });

  return {
    reply: result.content,
    transitsUsed: transits.fetchedAt,
    ...persisted,
  };
}

export async function streamGuideTurn(
  input: RunGuideTurnInput,
  onChunk: StreamGuideChunkHandler,
): Promise<Omit<RunGuideTurnResult, "reply">> {
  const transits = await getTransitsForChat(input.transitContext);
  const impact = analyzeTransitImpact(transits, {
    activatedGates: input.profile.humanDesign?.activatedGates ?? [],
    definedCenters: input.profile.humanDesign?.definedCenters ?? [],
  });
  const intakeForChat = FLAGS.CHAT_INTAKE_CONTEXT && input.intake ? input.intake : undefined;
  const memoryForChat = FLAGS.MEMORY_LIVING_DOCUMENT && input.memory ? input.memory : undefined;
  let fullText = "";
  let captured: AgentCallMeta | null = null;

  const runAgentStream = FLAGS.CHAT_USE_TOOLS
    ? runAstralAgentStreamV2
    : runAstralAgentStream;

  for await (const chunk of runAgentStream(
    input.profile,
    transits,
    truncateChatHistory(input.messages, input.app, input.persistedUserId),
    OPENAI_KEY,
    impact,
    intakeForChat,
    memoryForChat,
    (meta) => { captured = meta; },
  )) {
    fullText += chunk;
    onChunk(chunk);
  }

  if (input.persistedUserId && captured) {
    await persistGuideLlmCall(input.app, input.persistedUserId, "chat_stream", captured);
  }

  const persisted = await persistGuideTurnMessages({
    app: input.app,
    persistedUserId: input.persistedUserId,
    messages: input.messages,
    replyText: fullText,
    requireReplyText: true,
  });

  return {
    transitsUsed: transits.fetchedAt,
    ...persisted,
  };
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
