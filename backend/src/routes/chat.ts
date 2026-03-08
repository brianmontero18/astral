import type { FastifyInstance } from "fastify";
import { runAstralAgent, runAstralAgentStream, type UserProfile, type ChatMessage } from "../agent-service.js";
import { getUser, saveChatMessage, getChatMessages } from "../db.js";
import { getTransitsCached } from "./transits.js";
import { analyzeTransitImpact } from "../transit-service.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

export async function chatRoutes(app: FastifyInstance) {
  // Legacy: accepts { profile, messages } directly
  // New: accepts { userId, messages } and loads profile from DB
  interface ChatBody {
    profile?: UserProfile;
    userId?: string;
    messages: ChatMessage[];
  }

  app.post<{ Body: ChatBody }>("/chat", async (req, reply) => {
    const { profile: directProfile, userId, messages } = req.body;

    if (!messages?.length) {
      return reply.status(400).send({ error: "Missing messages" });
    }

    let profile: UserProfile;

    if (userId) {
      const user = await getUser(userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      profile = user.profile as UserProfile;
    } else if (directProfile) {
      profile = directProfile;
    } else {
      return reply.status(400).send({ error: "Missing userId or profile" });
    }

    try {
      const transits = await getTransitsCached();
      const impact = analyzeTransitImpact(transits, {
        activatedGates: profile.humanDesign?.activatedGates ?? [],
        definedCenters: profile.humanDesign?.definedCenters ?? [],
      });
      const replyText = await runAstralAgent(profile, transits, messages, OPENAI_KEY, impact);

      // Persist messages if we have a userId
      if (userId) {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg) {
          await saveChatMessage(userId, lastUserMsg.role, lastUserMsg.content);
        }
        await saveChatMessage(userId, "assistant", replyText);
      }

      return reply.send({ reply: replyText, transits_used: transits.fetchedAt });
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

    let profile: UserProfile;

    if (userId) {
      const user = await getUser(userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      profile = user.profile as UserProfile;
    } else if (directProfile) {
      profile = directProfile;
    } else {
      return reply.status(400).send({ error: "Missing userId or profile" });
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

      // Send done event with transits info
      reply.raw.write(`data: ${JSON.stringify({ done: true, transits_used: transits.fetchedAt })}\n\n`);

      // Persist messages
      if (userId && fullText) {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg) {
          await saveChatMessage(userId, lastUserMsg.role, lastUserMsg.content);
        }
        await saveChatMessage(userId, "assistant", fullText);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error(message);
      reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }

    reply.raw.end();
  });

  // Get chat history for a user
  app.get<{ Params: { userId: string } }>("/users/:userId/messages", async (req, reply) => {
    const { userId } = req.params;
    const user = await getUser(userId);
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }
    const messages = await getChatMessages(userId);
    return reply.send({ messages });
  });
}
