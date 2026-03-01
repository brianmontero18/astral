import type { FastifyInstance } from "fastify";
import { runAstralAgent, type UserProfile, type ChatMessage } from "../agent-service.js";
import { getUser, saveChatMessage, getChatMessages } from "../db.js";
import { getTransitsCached } from "./transits.js";

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
      const user = getUser(userId);
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
      const replyText = await runAstralAgent(profile, transits, messages, OPENAI_KEY);

      // Persist messages if we have a userId
      if (userId) {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg) {
          saveChatMessage(userId, lastUserMsg.role, lastUserMsg.content);
        }
        saveChatMessage(userId, "assistant", replyText);
      }

      return reply.send({ reply: replyText, transits_used: transits.fetchedAt });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error(message);
      return reply.status(502).send({ error: message });
    }
  });

  // Get chat history for a user
  app.get<{ Params: { userId: string } }>("/users/:userId/messages", async (req, reply) => {
    const { userId } = req.params;
    const user = getUser(userId);
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }
    const messages = getChatMessages(userId);
    return reply.send({ messages });
  });
}
