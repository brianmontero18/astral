export type ContextBudgetBlockId =
  | "system_static"
  | "profile"
  | "intake"
  | "memory"
  | "transits"
  | "impact"
  | "tools_schema"
  | "history"
  | "current_message"
  | "response";

export type ContextBudgetProvider = "openai" | "anthropic" | "unknown";

export interface ContextBudgetPromptBlock {
  id: Extract<
    ContextBudgetBlockId,
    "system_static" | "profile" | "intake" | "memory" | "transits" | "impact"
  >;
  content: string;
}

export interface ContextBudgetBlock {
  id: ContextBudgetBlockId;
  tokens: number;
  /** Fraction of model context window used by this block (0..1), or null when unknown. */
  percentOfWindow: number | null;
}

export interface ContextBudgetPostCall {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  calibrationRatio: number | null;
}

export interface ContextBudgetSnapshot {
  model: string;
  provider: ContextBudgetProvider;
  contextWindowTokens: number | null;
  estimatedInputTokens: number;
  reservedOutputTokens: number;
  estimatedTotalTokens: number;
  /** Fraction of model context window used by estimated total tokens (0..1), or null when unknown. */
  percentUsed: number | null;
  blocks: ContextBudgetBlock[];
  postCall?: ContextBudgetPostCall;
}

export interface ContextBudgetClientSummary {
  model: string;
  provider: ContextBudgetProvider;
  used: number;
  limit: number | null;
  /** Fraction of model context window used (0..1), or null when unknown. */
  percentUsed: number | null;
  breakdown: {
    system: number;
    memory: number;
    history: number;
    tools: number;
    response: number;
  };
  blocks: ContextBudgetBlock[];
}
