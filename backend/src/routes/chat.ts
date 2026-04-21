import type { FastifyInstance } from "fastify";
import { runAstralAgent, runAstralAgentStream, type UserProfile, type ChatMessage } from "../agent-service.js";
import { getUser, saveChatMessage, getChatMessages, getUserMessageCount, deleteChatMessagesFrom } from "../db.js";
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

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

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

    let profile: UserProfile;
    let persistedUserId: string | undefined;
    let userPlan: "free" | "basic" | "premium" | undefined;
    let messageLimit: number | null = null;

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
      const replyText = await runAstralAgent(profile, transits, messages, OPENAI_KEY, impact);

      // Persist messages if we have a userId
      let userMsgId: number | undefined;
      let assistantMsgId: number | undefined;
      if (persistedUserId) {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg) {
          userMsgId = await saveChatMessage(persistedUserId, lastUserMsg.role, lastUserMsg.content);
        }
        assistantMsgId = await saveChatMessage(persistedUserId, "assistant", replyText);
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

    let profile: UserProfile;
    let persistedUserId: string | undefined;
    let userPlan: "free" | "basic" | "premium" | undefined;
    let messageLimit: number | null = null;

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
      let fullText = "";

      for await (const chunk of runAstralAgentStream(profile, transits, messages, OPENAI_KEY, impact)) {
        fullText += chunk;
        reply.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
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
}
