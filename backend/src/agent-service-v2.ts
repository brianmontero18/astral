/**
 * Canonical chat agent — Vercel AI SDK + deterministic HD tools.
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
import { CHAT_MODEL } from "./llm/model-config.js";
import {
  buildHdToolsSchemaBudgetText,
  ChatContextWindowExceededError,
  selectChatContextForBudget,
} from "./llm/context-budget.js";
import {
  type AgentCallMeta,
  type AgentResult,
  type AgentStreamCompleteHandler,
  type ChatMessage,
  type LlmUsage,
  type UserProfile,
} from "./types/agent.js";
import { hdTools } from "./hd-tools/index.js";
import { buildSystemPromptV2Blocks } from "./agent-service-v2-prompt.js";
import type { ContextBudgetSnapshot } from "./types/context-budget.js";

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

interface AgentModelOptions {
  model?: string;
}

/**
 * Non-streaming variant for `/api/chat` and read-only MCP asks.
 */
export async function runAstralAgentV2(
  profile: UserProfile,
  transits: WeeklyTransits,
  messages: ChatMessage[],
  openaiKey: string,
  impact?: TransitImpact,
  intake?: Intake,
  memory?: string,
  preselectedContextBudget?: ContextBudgetSnapshot,
  options: AgentModelOptions = {},
): Promise<AgentResult> {
  const model = options.model ?? CHAT_MODEL;
  const promptBlocks = buildSystemPromptV2Blocks(profile, transits, impact, intake, memory);
  const systemPrompt = promptBlocks.map((block) => block.content).join("");
  const selected = preselectedContextBudget
    ? { messages, snapshot: preselectedContextBudget, fitsWithinContextWindow: true }
    : selectChatContextForBudget({
      model,
      promptBlocks,
      messages,
      toolsSchemaText: buildHdToolsSchemaBudgetText(),
    });
  if (!selected.fitsWithinContextWindow) {
    throw new ChatContextWindowExceededError(selected.snapshot);
  }
  const modelMessages = selected.messages.map((m) => ({ role: m.role, content: m.content }));
  const contextBudget = selected.snapshot;
  const openai = createOpenAIProvider(openaiKey);
  const start = Date.now();

  const result = await generateText({
    model: openai(model),
    system: systemPrompt,
    messages: modelMessages,
    tools: hdTools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });

  const latencyMs = Date.now() - start;
  const usage = mapUsage(result.totalUsage ?? result.usage);

  return {
    content: result.text,
    usage,
    latencyMs,
    systemPrompt,
    contextBudget,
    ...getToolCallMetaFromSteps(result.steps),
  };
}

/**
 * Streaming variant for `/api/chat/stream`.
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
  preselectedContextBudget?: ContextBudgetSnapshot,
  options: AgentModelOptions = {},
): AsyncGenerator<string> {
  const model = options.model ?? CHAT_MODEL;
  const promptBlocks = buildSystemPromptV2Blocks(profile, transits, impact, intake, memory);
  const systemPrompt = promptBlocks.map((block) => block.content).join("");
  const selected = preselectedContextBudget
    ? { messages, snapshot: preselectedContextBudget, fitsWithinContextWindow: true }
    : selectChatContextForBudget({
      model,
      promptBlocks,
      messages,
      toolsSchemaText: buildHdToolsSchemaBudgetText(),
    });
  if (!selected.fitsWithinContextWindow) {
    throw new ChatContextWindowExceededError(selected.snapshot);
  }
  const modelMessages = selected.messages.map((m) => ({ role: m.role, content: m.content }));
  const contextBudget = selected.snapshot;
  const openai = createOpenAIProvider(openaiKey);
  const start = Date.now();

  const result = streamText({
    model: openai(model),
    system: systemPrompt,
    messages: modelMessages,
    tools: hdTools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });

  let completed = false;
  const finish = async () => {
    if (completed) return;
    completed = true;
    const usage = mapUsage(await (result.totalUsage ?? result.usage));
    const meta: AgentCallMeta = {
      usage,
      latencyMs: Date.now() - start,
      systemPrompt,
      contextBudget,
      ...getToolCallMetaFromSteps(await result.steps),
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

function getToolCallMetaFromSteps(
  steps: Array<{ toolCalls: Array<{ toolName: string }> }>,
): Pick<AgentCallMeta, "toolCalls" | "toolsUsed"> {
  const toolCalls = steps.flatMap((step) => step.toolCalls.map((call) => call.toolName));
  if (toolCalls.length === 0) {
    return {};
  }
  return {
    toolCalls,
    toolsUsed: [...new Set(toolCalls)],
  };
}
