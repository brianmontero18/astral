import type { FastifyInstance } from "fastify";

import type { McpPrincipal } from "./auth.js";
import type { McpToolBudget } from "./budgets.js";
import {
  askAstralGuideToolDefinition,
  callAskAstralGuideV1,
} from "./tools/ask-astral-guide-v1.js";
import {
  callFindChannelByGatesV1,
  callFindChannelsByGateV1,
  callGetCenterForGateV1,
  findChannelByGatesToolDefinition,
  findChannelsByGateToolDefinition,
  getCenterForGateToolDefinition,
} from "./tools/hd-deterministic-v1.js";
import {
  McpToolCallError,
  type McpToolCallResult,
} from "./tool-contract.js";

export { McpToolCallError };

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredScopes: ReadonlyArray<string>;
  budget?: McpToolBudget;
  call(args: unknown, context: McpToolContext): Promise<McpToolCallResult>;
}

export interface McpToolContext {
  app: FastifyInstance;
  principal: McpPrincipal;
}

const MCP_TOOLS: McpToolDefinition[] = [
  {
    ...askAstralGuideToolDefinition,
    call: callAskAstralGuideV1,
  },
  {
    ...findChannelByGatesToolDefinition,
    call: callFindChannelByGatesV1,
  },
  {
    ...findChannelsByGateToolDefinition,
    call: callFindChannelsByGateV1,
  },
  {
    ...getCenterForGateToolDefinition,
    call: callGetCenterForGateV1,
  },
];

export function allMcpTools(): ReadonlyArray<McpToolDefinition> {
  return MCP_TOOLS;
}

export function findMcpTool(name: string): McpToolDefinition | null {
  return MCP_TOOLS.find((tool) => tool.name === name) ?? null;
}

export function serializeMcpTool(tool: McpToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  };
}
