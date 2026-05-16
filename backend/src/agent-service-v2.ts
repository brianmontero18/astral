/**
 * Agent Service v2 — Vercel AI SDK + HD tools.
 *
 * Versión paralela al `agent-service.ts` legacy (fetch directo a OpenAI).
 * Misma interfaz pública (`runAstralAgentV2`, `runAstralAgentStreamV2`) para
 * que el route handler pueda elegir entre v1 y v2 via FLAGS.CHAT_USE_TOOLS
 * sin rewriting.
 *
 * En esta etapa el prompt v2 ya obliga a consultar tools para relaciones
 * puerta-canal y puerta-centro. La ruta sigue siendo paralela y reversible:
 * v1 queda como default legacy; v2 se activa con FEATURE_CHAT_USE_TOOLS.
 */

import {
  generateText,
  stepCountIs,
  streamText,
  type LanguageModelUsage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import type { WeeklyTransits, TransitImpact } from "./transit-service.js";
import type { Intake } from "./report/types.js";
import {
  CHAT_MODEL,
  type AgentCallMeta,
  type AgentResult,
  type AgentStreamCompleteHandler,
  type ChatMessage,
  type LlmUsage,
  type UserProfile,
} from "./agent-service.js";
import { hdTools } from "./hd-tools/index.js";
import { buildSystemPromptV2 } from "./agent-service-v2-prompt.js";

/**
 * Maximum number of agent loop steps. One step = one LLM call (initial draft
 * or follow-up after tool results). With 5 HD tools registered we expect 1-3
 * tool calls per turn in practice. 5 is a safe ceiling — runaway loops bail
 * out instead of consuming tokens.
 */
const MAX_AGENT_STEPS = 5;

function createOpenAIProvider(openaiKey: string) {
  return createOpenAI({ apiKey: openaiKey });
}

/**
 * Non-streaming variant. Mirrors `runAstralAgent` from v1.
 *
 * Returns the final text after the tool loop converges (or after
 * MAX_AGENT_STEPS — whichever comes first).
 */
export async function runAstralAgentV2(
  profile: UserProfile,
  transits: WeeklyTransits,
  messages: ChatMessage[],
  openaiKey: string,
  impact?: TransitImpact,
  intake?: Intake,
  memory?: string,
): Promise<AgentResult> {
  const systemPrompt = buildSystemPromptV2(profile, transits, impact, intake, memory);
  const openai = createOpenAIProvider(openaiKey);
  const start = Date.now();

  const result = await generateText({
    model: openai(CHAT_MODEL),
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: hdTools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });

  const latencyMs = Date.now() - start;
  const usage = mapUsage(result.usage);

  return {
    content: result.text,
    usage,
    latencyMs,
    systemPrompt,
    toolsUsed: getToolsUsedFromSteps(result.steps),
  };
}

/**
 * Streaming variant. Mirrors `runAstralAgentStream` from v1.
 *
 * Yields plain text chunks (compatible with the existing SSE wire format on
 * `/api/chat/stream`). Tool calls are handled internally by the AI SDK loop
 * — the client only sees the final natural-language text. After the loop
 * completes, `onComplete` fires with usage + latency for telemetry.
 */
export async function* runAstralAgentStreamV2(
  profile: UserProfile,
  transits: WeeklyTransits,
  messages: ChatMessage[],
  openaiKey: string,
  impact?: TransitImpact,
  intake?: Intake,
  memory?: string,
  onComplete?: AgentStreamCompleteHandler,
): AsyncGenerator<string> {
  const systemPrompt = buildSystemPromptV2(profile, transits, impact, intake, memory);
  const openai = createOpenAIProvider(openaiKey);
  const start = Date.now();

  const result = streamText({
    model: openai(CHAT_MODEL),
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: hdTools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });

  let completed = false;
  const finish = async () => {
    if (completed) return;
    completed = true;
    const usage = mapUsage(await result.usage);
    const meta: AgentCallMeta = {
      usage,
      latencyMs: Date.now() - start,
      systemPrompt,
      toolsUsed: getToolsUsedFromSteps(await result.steps),
    };
    onComplete?.(meta);
  };

  try {
    for await (const chunk of result.textStream) {
      if (chunk) yield chunk;
    }
  } finally {
    await finish();
  }
}

/**
 * Maps the Vercel AI SDK usage shape into our internal `LlmUsage`. The SDK
 * normalizes provider-specific token names so we work in one vocabulary; we
 * preserve `cachedTokens` (read via `cachedInputTokens` exposed by the
 * OpenAI provider) for the cache-hit telemetry introduced in Fase 1.
 *
 * Any field can be `undefined` if the provider failed to report it — we
 * coalesce to 0 to keep telemetry consistent with the v1 path.
 */
function mapUsage(usage: LanguageModelUsage): LlmUsage {
  return {
    promptTokens: usage.inputTokens ?? 0,
    completionTokens: usage.outputTokens ?? 0,
    cachedTokens:
      usage.inputTokenDetails.cacheReadTokens ??
      usage.cachedInputTokens ??
      0,
  };
}

function getToolsUsedFromSteps(
  steps: Array<{ toolCalls: Array<{ toolName: string }> }>,
): string[] {
  return [...new Set(
    steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
  )];
}
