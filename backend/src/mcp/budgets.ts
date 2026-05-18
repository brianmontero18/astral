import { countMcpAuditEvents } from "../db.js";
import type { McpPrincipal } from "./auth.js";

export const MCP_TOOL_CALL_COMPLETED_EVENT = "tool_call_completed";

export interface McpToolBudget {
  dailyLimit: number;
  monthlyLimit: number;
}

export type McpBudgetCheckResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      period: "day" | "month";
      limit: number;
      used: number;
    };

function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )).toISOString();
}

function startOfUtcMonth(now: Date): string {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1,
  )).toISOString();
}

export async function checkMcpToolBudget(input: {
  principal: McpPrincipal;
  toolName: string;
  budget?: McpToolBudget;
  now?: Date;
}): Promise<McpBudgetCheckResult> {
  if (!input.budget) {
    return { allowed: true };
  }

  const now = input.now ?? new Date();
  const base = {
    userId: input.principal.userId,
    clientId: input.principal.clientId,
    toolName: input.toolName,
    event: MCP_TOOL_CALL_COMPLETED_EVENT,
    status: "success" as const,
  };

  const [usedToday, usedThisMonth] = await Promise.all([
    countMcpAuditEvents({
      ...base,
      sinceIso: startOfUtcDay(now),
    }),
    countMcpAuditEvents({
      ...base,
      sinceIso: startOfUtcMonth(now),
    }),
  ]);

  if (usedToday >= input.budget.dailyLimit) {
    return {
      allowed: false,
      period: "day",
      limit: input.budget.dailyLimit,
      used: usedToday,
    };
  }

  if (usedThisMonth >= input.budget.monthlyLimit) {
    return {
      allowed: false,
      period: "month",
      limit: input.budget.monthlyLimit,
      used: usedThisMonth,
    };
  }

  return { allowed: true };
}
