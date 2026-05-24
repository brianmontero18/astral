import type { ContextBudgetProvider } from "../types/context-budget.js";

export type ChatContextTokenizer =
  | "o200k_base"
  | "anthropic_count_tokens"
  | "provider_reported";

export interface ChatModelContextSpec {
  model: string;
  provider: Exclude<ContextBudgetProvider, "unknown">;
  contextWindowTokens: number;
  maxOutputTokens: number;
  tokenizer: ChatContextTokenizer;
  defaultResponseReserveTokens: number;
  defaultToolLoopReserveTokens: number;
  safetyMarginTokens: number;
}

const OPENAI_CONTEXT_WINDOW_TOKENS = 128_000;
const OPENAI_MAX_OUTPUT_TOKENS = 16_384;
const OPENAI_GPT_5_MINI_CONTEXT_WINDOW_TOKENS = 400_000;
const OPENAI_GPT_5_CONTEXT_WINDOW_TOKENS = 1_050_000;
const OPENAI_GPT_5_MAX_OUTPUT_TOKENS = 128_000;

const OPENAI_DEFAULT_SPEC = {
  provider: "openai",
  contextWindowTokens: OPENAI_CONTEXT_WINDOW_TOKENS,
  maxOutputTokens: OPENAI_MAX_OUTPUT_TOKENS,
  tokenizer: "o200k_base",
  defaultResponseReserveTokens: 1_024,
  defaultToolLoopReserveTokens: 1_024,
  safetyMarginTokens: 1_024,
} satisfies Omit<ChatModelContextSpec, "model">;

const CHAT_MODEL_CONTEXT_SPECS: Record<string, ChatModelContextSpec> = {
  "gpt-4o": {
    model: "gpt-4o",
    ...OPENAI_DEFAULT_SPEC,
  },
  "gpt-4o-mini": {
    model: "gpt-4o-mini",
    ...OPENAI_DEFAULT_SPEC,
  },
  "gpt-5.4-mini": {
    model: "gpt-5.4-mini",
    ...OPENAI_DEFAULT_SPEC,
    contextWindowTokens: OPENAI_GPT_5_MINI_CONTEXT_WINDOW_TOKENS,
    maxOutputTokens: OPENAI_GPT_5_MAX_OUTPUT_TOKENS,
  },
  "gpt-5.4-nano": {
    model: "gpt-5.4-nano",
    ...OPENAI_DEFAULT_SPEC,
    contextWindowTokens: OPENAI_GPT_5_MINI_CONTEXT_WINDOW_TOKENS,
    maxOutputTokens: OPENAI_GPT_5_MAX_OUTPUT_TOKENS,
  },
  "gpt-5.4": {
    model: "gpt-5.4",
    ...OPENAI_DEFAULT_SPEC,
    contextWindowTokens: OPENAI_GPT_5_CONTEXT_WINDOW_TOKENS,
    maxOutputTokens: OPENAI_GPT_5_MAX_OUTPUT_TOKENS,
  },
};

export function getChatModelContextSpec(model: string): ChatModelContextSpec | null {
  return CHAT_MODEL_CONTEXT_SPECS[model] ?? null;
}

export function getDefaultReservedOutputTokens(model: string): number {
  const spec = getChatModelContextSpec(model);
  if (!spec) return 1_024;
  return (
    spec.defaultResponseReserveTokens +
    spec.defaultToolLoopReserveTokens +
    spec.safetyMarginTokens
  );
}
