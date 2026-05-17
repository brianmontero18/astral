import {
  findChannelByGates,
  findChannelsByGate,
  type HdChannel,
} from "../../hd-channels.js";
import { GATE_TO_CENTER } from "../../hd-gates.js";
import type { McpToolBudget } from "../budgets.js";
import {
  McpToolCallError,
  type McpToolCallResult,
} from "../tool-contract.js";

export const FIND_CHANNEL_BY_GATES_TOOL_NAME = "find_channel_by_gates_v1";
export const FIND_CHANNELS_BY_GATE_TOOL_NAME = "find_channels_by_gate_v1";
export const GET_CENTER_FOR_GATE_TOOL_NAME = "get_center_for_gate_v1";

const HD_READ_SCOPE = "mcp:read_hd";

const DETERMINISTIC_HD_TOOL_BUDGET: McpToolBudget = {
  dailyLimit: 100,
  monthlyLimit: 500,
};

const gateProperty = {
  type: "integer",
  minimum: 1,
  maximum: 64,
  description: "Human Design gate number from 1 to 64.",
} as const;

function serializeChannel(channel: HdChannel) {
  return {
    id: channel.id,
    name: channel.name,
    gates: [...channel.gates],
    circuit: channel.circuit,
    subCircuit: channel.subCircuit,
  };
}

function toolResult(structuredContent: Record<string, unknown>): McpToolCallResult {
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

function readArgsObject(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "arguments_required",
    });
  }

  return args as Record<string, unknown>;
}

function readGate(args: unknown, param: string): number {
  const value = readArgsObject(args)[param];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "gate_required",
      param,
    });
  }

  if (value < 1 || value > 64) {
    throw new McpToolCallError(-32602, "Invalid params", {
      reason: "gate_out_of_range",
      param,
    });
  }

  return value;
}

export const findChannelByGatesToolDefinition = {
  name: FIND_CHANNEL_BY_GATES_TOOL_NAME,
  description:
    "Find the canonical Human Design channel that connects two gates. Returns null when the gates do not form a channel.",
  inputSchema: {
    type: "object",
    properties: {
      gateA: gateProperty,
      gateB: gateProperty,
    },
    required: ["gateA", "gateB"],
  },
  requiredScopes: [HD_READ_SCOPE],
  budget: DETERMINISTIC_HD_TOOL_BUDGET,
} as const;

export const findChannelsByGateToolDefinition = {
  name: FIND_CHANNELS_BY_GATE_TOOL_NAME,
  description:
    "List every canonical Human Design channel that contains one gate.",
  inputSchema: {
    type: "object",
    properties: {
      gate: gateProperty,
    },
    required: ["gate"],
  },
  requiredScopes: [HD_READ_SCOPE],
  budget: DETERMINISTIC_HD_TOOL_BUDGET,
} as const;

export const getCenterForGateToolDefinition = {
  name: GET_CENTER_FOR_GATE_TOOL_NAME,
  description:
    "Return the canonical Human Design center for one gate.",
  inputSchema: {
    type: "object",
    properties: {
      gate: gateProperty,
    },
    required: ["gate"],
  },
  requiredScopes: [HD_READ_SCOPE],
  budget: DETERMINISTIC_HD_TOOL_BUDGET,
} as const;

export async function callFindChannelByGatesV1(
  args: unknown,
): Promise<McpToolCallResult> {
  const gateA = readGate(args, "gateA");
  const gateB = readGate(args, "gateB");
  const channel = findChannelByGates(gateA, gateB);

  return toolResult({
    channel: channel ? serializeChannel(channel) : null,
  });
}

export async function callFindChannelsByGateV1(
  args: unknown,
): Promise<McpToolCallResult> {
  const gate = readGate(args, "gate");
  const channels = findChannelsByGate(gate).map(serializeChannel);

  return toolResult({
    gate,
    channels,
  });
}

export async function callGetCenterForGateV1(
  args: unknown,
): Promise<McpToolCallResult> {
  const gate = readGate(args, "gate");

  return toolResult({
    gate,
    center: GATE_TO_CENTER[gate] ?? null,
  });
}
