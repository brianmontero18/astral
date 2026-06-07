import { getUser } from "../../db.js";
import {
  buildHumanDesignProfileContextPack,
  hasCalculatedBodygraphProfile,
} from "../../bodygraph/profile-context.js";
import type { McpToolBudget } from "../budgets.js";
import {
  McpToolCallError,
  type McpToolCallResult,
} from "../tool-contract.js";
import type { McpToolContext } from "../tools.js";

export const GET_MY_PROFILE_CONTEXT_PACK_TOOL_NAME = "get_my_profile_context_pack_v1";

const READ_HD_SCOPE = "mcp:read_hd";

const PROFILE_CONTEXT_BUDGET: McpToolBudget = {
  dailyLimit: 100,
  monthlyLimit: 500,
};

async function getActiveProfile(userId: string) {
  const user = await getUser(userId);
  if (!user) {
    throw new McpToolCallError(-32010, "user_not_found");
  }
  if (!hasCalculatedBodygraphProfile(user.profile)) {
    throw new McpToolCallError(-32019, "no_active_bodygraph");
  }
  return user.profile;
}

export const getMyProfileContextPackToolDefinition = {
  name: GET_MY_PROFILE_CONTEXT_PACK_TOOL_NAME,
  description:
    "Return the authenticated user's active Astral Human Design profile as structured JSON for external AI context. Use this instead of downloading or interpreting the PDF when the user wants to work with their own HD data.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  outputSchema: {
    type: "object",
    properties: {
      status: { type: "string" },
      model: { type: "string" },
      source: { type: "object" },
      summary: { type: "object" },
      profile: { type: "object" },
    },
    required: ["status", "model", "source", "summary", "profile"],
  },
  requiredScopes: [READ_HD_SCOPE],
  budget: PROFILE_CONTEXT_BUDGET,
  sideEffectsMode: "mcp_read_only",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  _meta: {
    "openai/toolInvocation/invoking": "Leyendo contexto HD de Astral",
    "openai/toolInvocation/invoked": "Contexto HD listo",
  },
} as const;

export async function callGetMyProfileContextPackV1(
  _args: unknown,
  context: McpToolContext,
): Promise<McpToolCallResult> {
  const profile = await getActiveProfile(context.principal.userId);
  const contextPack = buildHumanDesignProfileContextPack(profile);
  const structuredContent: Record<string, unknown> = { ...contextPack };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(structuredContent),
      },
    ],
    structuredContent,
  };
}
