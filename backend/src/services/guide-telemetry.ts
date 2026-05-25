import type { FastifyInstance } from "fastify";

import {
  CHAT_MODEL,
  hashSystemPrompt,
} from "../llm/model-config.js";
import type { LlmUsage } from "../types/agent.js";
import { attachContextBudgetPostCall } from "../llm/context-budget.js";
import type { ContextBudgetSnapshot } from "../types/context-budget.js";
import {
  insertLlmCall,
  type LlmCallRoute,
} from "../db.js";
import { FLAGS } from "../config/flags.js";
import { calculateCost } from "../llm/pricing.js";

interface PersistGuideLlmCallMeta {
  model?: string;
  usage: LlmUsage;
  latencyMs: number;
  systemPrompt: string;
  contextBudget?: ContextBudgetSnapshot;
  toolCalls?: string[];
}

export async function persistGuideLlmCall(
  app: FastifyInstance,
  userId: string,
  route: LlmCallRoute,
  meta: PersistGuideLlmCallMeta,
): Promise<void> {
  if (!FLAGS.LLM_TELEMETRY) return;

  try {
    const model = meta.model ?? meta.contextBudget?.model ?? CHAT_MODEL;
    await insertLlmCall({
      userId,
      route,
      model,
      tokensIn: meta.usage.promptTokens,
      tokensOut: meta.usage.completionTokens,
      cachedTokens: meta.usage.cachedTokens ?? 0,
      costUsd: calculateCost(
        model,
        meta.usage.promptTokens,
        meta.usage.completionTokens,
        { cachedInputTokens: meta.usage.cachedTokens ?? 0 },
      ),
      latencyMs: meta.latencyMs,
      promptHash: hashSystemPrompt(meta.systemPrompt),
      toolCalls: meta.toolCalls,
      contextBreakdown: meta.contextBudget
        ? attachContextBudgetPostCall(meta.contextBudget, meta.usage)
        : undefined,
    });
  } catch (err) {
    // Telemetry must never break the user-facing response. Log and move on.
    app.log.warn({ err, route, userId }, "llm_calls insert failed");
  }
}
