import { calculateCost } from "../llm/pricing.js";

export type OpenAiLiveEvalRoute =
  | "chat_stream"
  | "chat"
  | "mcp_ask"
  | "report"
  | "memory_writer"
  | "transcribe";

export interface OpenAiLiveEvalPlan {
  routes: OpenAiLiveEvalRoute[];
  modelsByRoute: Record<OpenAiLiveEvalRoute, string[]>;
  maxModelCalls: number;
  maxEstimatedCostUsd: number;
  audioFixturePath?: string;
}

interface BuildOpenAiLiveEvalPlanInput {
  includeTranscribe: boolean;
  audioFixturePath?: string;
}

interface LiveEvalConsentInput {
  confirmed: boolean;
  maxCostUsd?: number;
}

const CHAT_ROUTES: OpenAiLiveEvalRoute[] = ["chat_stream", "chat", "mcp_ask"];
const CHAT_MODELS = ["gpt-4o-mini", "gpt-5.4-mini"] as const;
const REPORT_MODELS = ["gpt-4o-mini", "gpt-5.4-mini", "gpt-5.4"] as const;
const MEMORY_WRITER_MODELS = ["gpt-4o-mini", "gpt-5.4-nano"] as const;
const TRANSCRIBE_MODELS = ["whisper-1", "gpt-4o-mini-transcribe"] as const;

const CHAT_FIXTURE_COUNT = 8;
const REPORT_CALLS_PER_MODEL = 3;
const MEMORY_WRITER_FIXTURE_COUNT = 5;

function roundUsd(amount: number): number {
  return Math.ceil(amount * 100) / 100;
}

function estimateTextModelCost(
  model: string,
  calls: number,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
): number {
  return calls * calculateCost(model, inputTokens, outputTokens, { cachedInputTokens });
}

function estimatePlanCost(includeTranscribe: boolean): number {
  const chatCallsPerModel = CHAT_ROUTES.length * CHAT_FIXTURE_COUNT;
  const reportCallsPerModel = REPORT_CALLS_PER_MODEL;
  const memoryCallsPerModel = MEMORY_WRITER_FIXTURE_COUNT;

  const textCost =
    estimateTextModelCost("gpt-4o-mini", chatCallsPerModel, 13_000, 600, 8_000) +
    estimateTextModelCost("gpt-5.4-mini", chatCallsPerModel, 13_000, 600, 8_000) +
    estimateTextModelCost("gpt-4o-mini", reportCallsPerModel, 6_000, 1_500) +
    estimateTextModelCost("gpt-5.4-mini", reportCallsPerModel, 6_000, 1_500) +
    estimateTextModelCost("gpt-5.4", reportCallsPerModel, 6_000, 1_500) +
    estimateTextModelCost("gpt-4o-mini", memoryCallsPerModel, 1_500, 300) +
    estimateTextModelCost("gpt-5.4-nano", memoryCallsPerModel, 1_500, 300);

  const transcribeBuffer = includeTranscribe ? 0.05 : 0;
  return roundUsd((textCost + transcribeBuffer) * 2);
}

export function buildOpenAiLiveEvalPlan(
  input: BuildOpenAiLiveEvalPlanInput,
): OpenAiLiveEvalPlan {
  const includeTranscribe = input.includeTranscribe && Boolean(input.audioFixturePath);
  const routes: OpenAiLiveEvalRoute[] = includeTranscribe
    ? [...CHAT_ROUTES, "report", "memory_writer", "transcribe"]
    : [...CHAT_ROUTES, "report", "memory_writer"];
  const modelsByRoute: Record<OpenAiLiveEvalRoute, string[]> = {
    chat_stream: [...CHAT_MODELS],
    chat: [...CHAT_MODELS],
    mcp_ask: [...CHAT_MODELS],
    report: [...REPORT_MODELS],
    memory_writer: [...MEMORY_WRITER_MODELS],
    transcribe: includeTranscribe ? [...TRANSCRIBE_MODELS] : [],
  };
  const chatCalls = CHAT_ROUTES.length * CHAT_MODELS.length * CHAT_FIXTURE_COUNT;
  const reportCalls = REPORT_MODELS.length * REPORT_CALLS_PER_MODEL;
  const memoryCalls = MEMORY_WRITER_MODELS.length * MEMORY_WRITER_FIXTURE_COUNT;
  const transcribeCalls = includeTranscribe ? TRANSCRIBE_MODELS.length : 0;

  return {
    routes,
    modelsByRoute,
    maxModelCalls: chatCalls + reportCalls + memoryCalls + transcribeCalls,
    maxEstimatedCostUsd: estimatePlanCost(includeTranscribe),
    ...(includeTranscribe ? { audioFixturePath: input.audioFixturePath } : {}),
  };
}

export function requireLiveEvalConsent(
  plan: OpenAiLiveEvalPlan,
  input: LiveEvalConsentInput,
): void {
  if (!input.confirmed) {
    throw new Error("Live eval requires explicit founder consent before spending provider tokens.");
  }
  if (input.maxCostUsd === undefined || !Number.isFinite(input.maxCostUsd)) {
    throw new Error("Live eval requires an explicit finite USD cap.");
  }
  if (input.maxCostUsd !== undefined && input.maxCostUsd < plan.maxEstimatedCostUsd) {
    throw new Error(
      `Live eval cap USD ${input.maxCostUsd} is below estimated cap USD ${plan.maxEstimatedCostUsd}.`,
    );
  }
}

export function formatConsentRequest(plan: OpenAiLiveEvalPlan): string {
  const routeLines = plan.routes
    .map((route) => `- ${route}: ${plan.modelsByRoute[route].join(", ")}`)
    .join("\n");
  const audioLine = plan.audioFixturePath
    ? `\nAudio fixture consentido: ${plan.audioFixturePath}`
    : "\nTranscribe queda omitido hasta tener audio consentido/no sensible.";

  return [
    "NO ejecutar sin consentimiento explicito.",
    "",
    "Modelos por route:",
    routeLines,
    audioLine,
    "",
    `Llamadas maximas a modelos: ${plan.maxModelCalls}`,
    `Cap recomendado: USD ${plan.maxEstimatedCostUsd.toFixed(2)}`,
  ].join("\n");
}
