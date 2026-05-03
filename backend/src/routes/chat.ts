import type { FastifyInstance } from "fastify";
import {
  CHAT_MODEL,
  hashSystemPrompt,
  runAstralAgent,
  runAstralAgentStream,
  type AgentCallMeta,
  type ChatMessage,
  type LlmUsage,
  type UserProfile,
} from "../agent-service.js";
import {
  deleteChatMessagesFrom,
  getChatMessages,
  getRecentChatMessages,
  getTotalUserMessageCount,
  getUser,
  getUserMessageCount,
  insertLlmCall,
  saveChatMessage,
  setMessageFeedback,
  updateUserMemory,
  type FeedbackThumb,
  type LlmCallRoute,
} from "../db.js";
import { getTransitsCached } from "./transits.js";
import { analyzeTransitImpact } from "../transit-service.js";
import { type AuthenticatedRequest } from "../auth/session.js";
import {
  resolveRequestCurrentUser,
  sendCurrentUserError,
} from "../auth/current-user.js";
import {
  buildChatUsageSnapshot,
  getMessageLimitForPlan,
} from "../chat-limits.js";
import { FLAGS } from "../config/flags.js";
import { calculateCost } from "../llm/pricing.js";
import {
  MEMORY_WRITER_MODEL,
  MEMORY_WRITER_RECENT_MESSAGES_WINDOW,
  runMemoryWriter,
  shouldTriggerMemoryWriter,
} from "../memory-writer.js";
import type { Intake } from "../report/types.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

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
function triggerMemoryWriterAsync(
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
            costUsd: calculateCost(
              MEMORY_WRITER_MODEL,
              result.meta.usage.promptTokens,
              result.meta.usage.completionTokens,
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

async function persistLlmCall(
  app: FastifyInstance,
  userId: string,
  route: LlmCallRoute,
  meta: { usage: LlmUsage; latencyMs: number; systemPrompt: string },
): Promise<void> {
  if (!FLAGS.LLM_TELEMETRY) return;
  try {
    await insertLlmCall({
      userId,
      route,
      model: CHAT_MODEL,
      tokensIn: meta.usage.promptTokens,
      tokensOut: meta.usage.completionTokens,
      costUsd: calculateCost(
        CHAT_MODEL,
        meta.usage.promptTokens,
        meta.usage.completionTokens,
      ),
      latencyMs: meta.latencyMs,
      promptHash: hashSystemPrompt(meta.systemPrompt),
    });
  } catch (err) {
    // Telemetry must never break the user-facing response. Log and move on.
    app.log.warn({ err, route, userId }, "llm_calls insert failed");
  }
}

export async function chatRoutes(app: FastifyInstance) {
  // Transitional contract:
  // - persisted mode derives the user exclusively from the validated session
  // - anonymous mode accepts an inline profile only when no user-owned identity path is requested
  interface ChatBody {
    profile?: UserProfile;
    userId?: string;
    messages: ChatMessage[];
  }

  async function getPersistedChatUsage(
    userId: string,
    plan: "free" | "basic" | "premium",
    now = new Date(),
  ) {
    const used = await getUserMessageCount(userId, now);
    return buildChatUsageSnapshot(plan, used, now);
  }

  app.post<{ Body: ChatBody }>("/chat", async (req, reply) => {
    const { profile: directProfile, userId, messages } = req.body;

    if (!messages?.length) {
      return reply.status(400).send({ error: "Missing messages" });
    }

    const currentUser = await resolveRequestCurrentUser(
      req as AuthenticatedRequest,
      reply,
      userId,
    );

    if (reply.sent) {
      return;
    }

    // Pending users (admin-invited, onboarding incomplete) have a
    // placeholder profile — chat would generate generic content. Block
    // explicitly so the frontend can route them back into onboarding.
    if (
      currentUser.kind === "linked" &&
      currentUser.user.onboarding_status === "pending"
    ) {
      return reply.status(403).send({ error: "onboarding_required" });
    }

    let profile: UserProfile;
    let persistedUserId: string | undefined;
    let userPlan: "free" | "basic" | "premium" | undefined;
    let messageLimit: number | null = null;
    let userIntake: Intake | null = null;
    let userMemory = "";

    if (currentUser.kind === "linked") {
      const user = await getUser(currentUser.user.id);
      if (!user) {
        return reply.status(409).send({
          error: "identity_not_linked",
          provider: currentUser.provider,
          subject: currentUser.subject,
        });
      }
      profile = user.profile as UserProfile;
      persistedUserId = user.id;
      userPlan = user.plan;
      messageLimit = getMessageLimitForPlan(user.plan);
      userIntake = (user.intake as Intake | null) ?? null;
      userMemory = user.memory_md;
    } else if (userId) {
      return sendCurrentUserError(reply, currentUser);
    } else if (directProfile) {
      profile = directProfile;
    } else {
      return reply.status(400).send({ error: "Missing userId or profile" });
    }

    if (persistedUserId && userPlan) {
      const usage = await getPersistedChatUsage(persistedUserId, userPlan);
      if (messageLimit !== null && usage.used >= messageLimit) {
        return reply.status(403).send({
          error: "message_limit_reached",
          ...usage,
        });
      }
    }

    try {
      const transits = await getTransitsCached();
      const impact = analyzeTransitImpact(transits, {
        activatedGates: profile.humanDesign?.activatedGates ?? [],
        definedCenters: profile.humanDesign?.definedCenters ?? [],
      });
      const intakeForChat = FLAGS.CHAT_INTAKE_CONTEXT && userIntake ? userIntake : undefined;
      const memoryForChat = FLAGS.MEMORY_LIVING_DOCUMENT && userMemory ? userMemory : undefined;
      const result = await runAstralAgent(
        profile,
        transits,
        messages,
        OPENAI_KEY,
        impact,
        intakeForChat,
        memoryForChat,
      );
      const replyText = result.content;

      if (persistedUserId) {
        await persistLlmCall(app, persistedUserId, "chat", result);
      }

      // Persist messages if we have a userId
      let userMsgId: number | undefined;
      let assistantMsgId: number | undefined;
      if (persistedUserId) {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg) {
          userMsgId = await saveChatMessage(persistedUserId, lastUserMsg.role, lastUserMsg.content);
        }
        assistantMsgId = await saveChatMessage(persistedUserId, "assistant", replyText);

        triggerMemoryWriterAsync(app, persistedUserId);
      }

      return reply.send({ reply: replyText, transits_used: transits.fetchedAt, userMsgId, assistantMsgId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error(message);
      return reply.status(502).send({ error: message });
    }
  });

  // Streaming chat via SSE
  app.post<{ Body: ChatBody }>("/chat/stream", async (req, reply) => {
    const { profile: directProfile, userId, messages } = req.body;

    if (!messages?.length) {
      return reply.status(400).send({ error: "Missing messages" });
    }

    const currentUser = await resolveRequestCurrentUser(
      req as AuthenticatedRequest,
      reply,
      userId,
    );

    if (reply.sent) {
      return;
    }

    if (
      currentUser.kind === "linked" &&
      currentUser.user.onboarding_status === "pending"
    ) {
      return reply.status(403).send({ error: "onboarding_required" });
    }

    let profile: UserProfile;
    let persistedUserId: string | undefined;
    let userPlan: "free" | "basic" | "premium" | undefined;
    let messageLimit: number | null = null;
    let userIntake: Intake | null = null;
    let userMemory = "";

    if (currentUser.kind === "linked") {
      const user = await getUser(currentUser.user.id);
      if (!user) {
        return reply.status(409).send({
          error: "identity_not_linked",
          provider: currentUser.provider,
          subject: currentUser.subject,
        });
      }
      profile = user.profile as UserProfile;
      persistedUserId = user.id;
      userPlan = user.plan;
      messageLimit = getMessageLimitForPlan(user.plan);
      userIntake = (user.intake as Intake | null) ?? null;
      userMemory = user.memory_md;
    } else if (userId) {
      return sendCurrentUserError(reply, currentUser);
    } else if (directProfile) {
      profile = directProfile;
    } else {
      return reply.status(400).send({ error: "Missing userId or profile" });
    }

    if (persistedUserId && userPlan) {
      const usage = await getPersistedChatUsage(persistedUserId, userPlan);
      if (messageLimit !== null && usage.used >= messageLimit) {
        return reply.status(403).send({
          error: "message_limit_reached",
          ...usage,
        });
      }
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    try {
      const transits = await getTransitsCached();
      const impact = analyzeTransitImpact(transits, {
        activatedGates: profile.humanDesign?.activatedGates ?? [],
        definedCenters: profile.humanDesign?.definedCenters ?? [],
      });
      const intakeForChat = FLAGS.CHAT_INTAKE_CONTEXT && userIntake ? userIntake : undefined;
      const memoryForChat = FLAGS.MEMORY_LIVING_DOCUMENT && userMemory ? userMemory : undefined;
      let fullText = "";
      let captured: AgentCallMeta | null = null;

      for await (const chunk of runAstralAgentStream(
        profile,
        transits,
        messages,
        OPENAI_KEY,
        impact,
        intakeForChat,
        memoryForChat,
        (meta) => { captured = meta; },
      )) {
        fullText += chunk;
        reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      if (persistedUserId && captured) {
        await persistLlmCall(app, persistedUserId, "chat_stream", captured);
      }

      // Persist messages
      let userMsgId: number | undefined;
      let assistantMsgId: number | undefined;
      if (persistedUserId && fullText) {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg) {
          userMsgId = await saveChatMessage(persistedUserId, lastUserMsg.role, lastUserMsg.content);
        }
        assistantMsgId = await saveChatMessage(persistedUserId, "assistant", fullText);

        triggerMemoryWriterAsync(app, persistedUserId);
      }

      // Send done event with transits info and persisted message ids
      reply.raw.write(`data: ${JSON.stringify({ done: true, transits_used: transits.fetchedAt, userMsgId, assistantMsgId })}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error(message);
      reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }

    reply.raw.end();
  });

  // Get chat history for a user
  async function sendChatHistory(
    request: AuthenticatedRequest,
    reply: import("fastify").FastifyReply,
    requestedUserId?: string,
  ) {
    const currentUser = await resolveRequestCurrentUser(request, reply, requestedUserId);

    if (reply.sent) {
      return;
    }

    if (currentUser.kind !== "linked") {
      return sendCurrentUserError(reply, currentUser);
    }

    const user = await getUser(currentUser.user.id);
    if (!user) {
      return reply.status(409).send({
        error: "identity_not_linked",
        provider: currentUser.provider,
        subject: currentUser.subject,
      });
    }

    const messages = await getChatMessages(currentUser.user.id);
    const usage = await getPersistedChatUsage(currentUser.user.id, user.plan);
    return reply.send({ messages, ...usage });
  }

  app.get("/me/messages", async (req, reply) => {
    return sendChatHistory(req as AuthenticatedRequest, reply);
  });

  app.get<{ Params: { userId: string } }>("/users/:userId/messages", async (req, reply) => {
    return sendChatHistory(req as AuthenticatedRequest, reply, req.params.userId);
  });

  // Truncate chat history from a given message ID (for edit feature)
  async function deleteChatHistory(
    request: AuthenticatedRequest,
    reply: import("fastify").FastifyReply,
    fromIdParam: string,
    requestedUserId?: string,
  ) {
    const fromId = parseInt(fromIdParam, 10);
    if (isNaN(fromId) || fromId < 1) {
      return reply.status(400).send({ error: "Missing or invalid fromId query parameter" });
    }

    const currentUser = await resolveRequestCurrentUser(
      request,
      reply,
      requestedUserId,
    );

    if (reply.sent) {
      return;
    }

    if (currentUser.kind !== "linked") {
      return sendCurrentUserError(reply, currentUser);
    }

    const user = await getUser(currentUser.user.id);
    if (!user) {
      return reply.status(409).send({
        error: "identity_not_linked",
        provider: currentUser.provider,
        subject: currentUser.subject,
      });
    }

    const deleted = await deleteChatMessagesFrom(currentUser.user.id, fromId);
    const usage = await getPersistedChatUsage(currentUser.user.id, user.plan);
    return reply.send({ deleted, ...usage });
  }

  app.delete<{ Querystring: { fromId: string } }>("/me/messages", async (req, reply) => {
    return deleteChatHistory(req as AuthenticatedRequest, reply, req.query.fromId);
  });

  app.delete<{ Params: { userId: string }; Querystring: { fromId: string } }>("/users/:userId/messages", async (req, reply) => {
    return deleteChatHistory(
      req as AuthenticatedRequest,
      reply,
      req.query.fromId,
      req.params.userId,
    );
  });

  // Per-message feedback. Only assistant messages owned by the current user
  // can be voted on; non-existent / non-owned / user-role messages return 404
  // because `setMessageFeedback` filters on (id, user_id, role='assistant').
  app.post<{ Params: { id: string }; Body: { thumb?: string; note?: string } }>(
    "/messages/:id/feedback",
    async (req, reply) => {
      const messageId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(messageId) || messageId < 1) {
        return reply.status(400).send({ error: "Invalid message id" });
      }

      const thumb = req.body?.thumb;
      if (thumb !== "up" && thumb !== "down") {
        return reply
          .status(400)
          .send({ error: "Invalid thumb (expected \"up\" or \"down\")" });
      }

      const rawNote = typeof req.body?.note === "string" ? req.body.note : null;
      const note = rawNote ? rawNote.slice(0, 2000) : null;

      const currentUser = await resolveRequestCurrentUser(
        req as AuthenticatedRequest,
        reply,
      );

      if (reply.sent) {
        return;
      }

      if (currentUser.kind !== "linked") {
        return sendCurrentUserError(reply, currentUser);
      }

      const updated = await setMessageFeedback(
        messageId,
        currentUser.user.id,
        thumb as FeedbackThumb,
        note,
      );

      if (!updated) {
        return reply.status(404).send({ error: "Message not found" });
      }

      return reply.send({ ok: true });
    },
  );
}
