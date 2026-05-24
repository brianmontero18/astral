import type { FastifyInstance, FastifyReply } from "fastify";
import type {
  ChatMessage,
  UserProfile,
} from "../types/agent.js";
import {
  deleteChatMessagesFrom,
  getChatMessages,
  getUser,
  getUserMessageCount,
  setMessageFeedback,
  type FeedbackThumb,
} from "../db.js";
import { type AuthenticatedRequest } from "../auth/session.js";
import {
  resolveRequestCurrentUser,
  sendCurrentUserError,
} from "../auth/current-user.js";
import {
  buildChatUsageSnapshot,
  getMessageLimitForPlan,
} from "../chat-limits.js";
import {
  ChatContextWindowExceededError,
  buildGuideContextBudgetSnapshot,
  runGuideTurn,
  streamGuideTurn,
} from "../services/guide-service.js";
import { summarizeContextBudgetForClient } from "../llm/context-budget.js";
import {
  parseTransitChatContext,
  type TransitChatContext,
} from "../services/guide-transits.js";
import type { Intake } from "../report/types.js";

export async function chatRoutes(app: FastifyInstance) {
  // Transitional contract:
  // - persisted mode derives the user exclusively from the validated session
  // - anonymous mode accepts an inline profile only when no user-owned identity path is requested
  interface ChatBody {
    profile?: UserProfile;
    userId?: string;
    messages: ChatMessage[];
    transitContext?: TransitChatContext;
  }

  async function getPersistedChatUsage(
    userId: string,
    plan: "free" | "basic" | "premium",
    now = new Date(),
  ) {
    const used = await getUserMessageCount(userId, now);
    return buildChatUsageSnapshot(plan, used, now);
  }

  function isAgentChatRole(role: string): role is ChatMessage["role"] {
    return role === "user" || role === "assistant";
  }

  function toAgentChatMessages(
    messages: Array<{ role: string; content: string }>,
  ): ChatMessage[] {
    return messages
      .filter((message): message is ChatMessage => isAgentChatRole(message.role))
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
  }

  app.post<{ Body: ChatBody }>("/chat", async (req, reply) => {
    const { profile: directProfile, userId, messages } = req.body;

    if (!messages?.length) {
      return reply.status(400).send({ error: "Missing messages" });
    }

    const transitContext = parseTransitChatContext(req.body.transitContext);
    if (transitContext.error) {
      return reply.status(400).send({ error: transitContext.error });
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
      const result = await runGuideTurn({
        app,
        profile,
        persistedUserId,
        intake: userIntake,
        memory: userMemory,
        messages,
        transitContext: transitContext.context,
      });
      return reply.send({
        reply: result.reply,
        transits_used: result.transitsUsed,
        userMsgId: result.userMsgId,
        assistantMsgId: result.assistantMsgId,
      });
    } catch (err) {
      if (err instanceof ChatContextWindowExceededError) {
        return reply.status(err.statusCode).send({
          error: err.code,
          message: err.message,
          contextBudget: summarizeContextBudgetForClient(err.contextBudget),
        });
      }
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

    const transitContext = parseTransitChatContext(req.body.transitContext);
    if (transitContext.error) {
      return reply.status(400).send({ error: transitContext.error });
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
      const result = await streamGuideTurn(
        {
          app,
          profile,
          persistedUserId,
          intake: userIntake,
          memory: userMemory,
          messages,
          transitContext: transitContext.context,
        },
        (chunk) => {
          reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        },
      );

      // Send done event with transits info and persisted message ids
      reply.raw.write(`data: ${JSON.stringify({
        done: true,
        transits_used: result.transitsUsed,
        userMsgId: result.userMsgId,
        assistantMsgId: result.assistantMsgId,
      })}\n\n`);
    } catch (err) {
      if (err instanceof ChatContextWindowExceededError) {
        reply.raw.write(`data: ${JSON.stringify({
          error: err.code,
          message: err.message,
          contextBudget: summarizeContextBudgetForClient(err.contextBudget),
        })}\n\n`);
        reply.raw.end();
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      app.log.error(message);
      reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }

    reply.raw.end();
  });

  // Get chat history for a user
  async function sendChatHistory(
    request: AuthenticatedRequest,
    reply: FastifyReply,
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

  app.get("/me/chat/context-budget", async (req, reply) => {
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

    const user = await getUser(currentUser.user.id);
    if (!user) {
      return reply.status(409).send({
        error: "identity_not_linked",
        provider: currentUser.provider,
        subject: currentUser.subject,
      });
    }

    if (user.onboarding_status === "pending") {
      return reply.status(403).send({ error: "onboarding_required" });
    }

    const messages = toAgentChatMessages(await getChatMessages(currentUser.user.id));
    const snapshot = await buildGuideContextBudgetSnapshot({
      profile: user.profile as UserProfile,
      persistedUserId: user.id,
      intake: (user.intake as Intake | null) ?? null,
      memory: user.memory_md,
      messages,
    });

    return reply.send(summarizeContextBudgetForClient(snapshot));
  });

  app.get<{ Params: { userId: string } }>("/users/:userId/messages", async (req, reply) => {
    return sendChatHistory(req as AuthenticatedRequest, reply, req.params.userId);
  });

  // Truncate chat history from a given message ID (for edit feature)
  async function deleteChatHistory(
    request: AuthenticatedRequest,
    reply: FastifyReply,
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
