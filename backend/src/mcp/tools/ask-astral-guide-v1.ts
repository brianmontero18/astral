import type { FastifyInstance } from "fastify";

import type { ChatMessage, UserProfile } from "../../agent-service.js";
import { getUser } from "../../db.js";
import { runGuideTurn } from "../../services/guide-service.js";
import type { McpPrincipal } from "../auth.js";
import {
  McpToolCallError,
  type McpToolCallResult,
} from "../tool-contract.js";

export const ASK_ASTRAL_GUIDE_TOOL_NAME = "ask_astral_guide_v1";

export interface AskAstralGuideToolContext {
  app: FastifyInstance;
  principal: McpPrincipal;
}

export const askAstralGuideToolDefinition = {
  name: ASK_ASTRAL_GUIDE_TOOL_NAME,
  description:
    "Ask Astral Guide a read-only question using the authenticated user's Astral profile, memory, business context, and current transits.",
  inputSchema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        minLength: 1,
        description: "The question to ask Astral Guide.",
      },
    },
    required: ["question"],
  },
  requiredScopes: ["mcp:ask"],
  budget: {
    dailyLimit: 20,
    monthlyLimit: 100,
  },
} as const;

function readQuestion(args: unknown): string {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "arguments_required",
    });
  }

  const question = (args as { question?: unknown }).question;
  if (typeof question !== "string" || question.trim().length === 0) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "question_required",
    });
  }

  return question.trim();
}

function testModeReply(question: string): McpToolCallResult | null {
  const reply = process.env.MCP_ASK_ASTRAL_GUIDE_TEST_REPLY;
  if (process.env.NODE_ENV !== "test" || !reply) {
    return null;
  }

  return {
    content: [
      {
        type: "text",
        text: reply.replaceAll("{question}", question),
      },
    ],
    structuredContent: {
      transits_used: "test-mode",
    },
  };
}

export async function callAskAstralGuideV1(
  args: unknown,
  context: AskAstralGuideToolContext,
): Promise<McpToolCallResult> {
  const question = readQuestion(args);
  const user = await getUser(context.principal.userId);
  if (!user) {
    throw new McpToolCallError(-32010, "user_not_found");
  }

  const testResult = testModeReply(question);
  if (testResult) {
    return testResult;
  }

  const messages: ChatMessage[] = [{ role: "user", content: question }];
  const result = await runGuideTurn({
    app: context.app,
    profile: user.profile as UserProfile,
    persistedUserId: user.id,
    intake: user.intake,
    memory: user.memory_md,
    messages,
    sideEffectsMode: "mcp_read_only",
  });

  return {
    content: [
      {
        type: "text",
        text: result.reply,
      },
    ],
    structuredContent: {
      transits_used: result.transitsUsed,
    },
  };
}
