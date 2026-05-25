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

export type ModelRoutingRoute =
  | "chat"
  | "chat_stream"
  | "mcp_ask"
  | "report"
  | "memory_writer";

export type ModelRoutingComplexity = "simple" | "complex";

export type ModelRoutingSignal =
  | "long_message"
  | "multi_step"
  | "cross_domain"
  | "relationship_analysis";

export type ModelRoutingReason =
  | "chat_simple_default"
  | "chat_simple_opt_in"
  | "chat_complex_opt_in"
  | "chat_complex_no_upgrade_configured"
  | "report_default"
  | "report_premium_opt_in"
  | "memory_writer_default"
  | "memory_writer_configured";

export interface ModelRoutingDecision {
  route: ModelRoutingRoute;
  model: string;
  reason: ModelRoutingReason;
  complexity?: ModelRoutingComplexity;
  signals: ModelRoutingSignal[];
}

export interface LlmCallModelRoutingMetadata {
  modelRouting: ModelRoutingDecision;
}

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

export type ContextBudgetSelectionReason =
  | "full_history_fits"
  | "history_hard_cap_omitted"
  | "token_budget_omitted_history"
  | "current_message_dominates"
  | "unknown_model_conservative";

export interface ContextBudgetSelection {
  selectedMessageCount: number;
  omittedMessageCount: number;
  omittedTokenEstimate: number;
  currentMessageTokens: number;
  historyTokenBudget: number;
  selectedHistoryTokens: number;
  reason: ContextBudgetSelectionReason;
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
  modelRouting?: ModelRoutingDecision;
  contextWindowTokens: number | null;
  estimatedInputTokens: number;
  reservedOutputTokens: number;
  estimatedTotalTokens: number;
  /** Fraction of model context window used by estimated total tokens (0..1), or null when unknown. */
  percentUsed: number | null;
  blocks: ContextBudgetBlock[];
  selection: ContextBudgetSelection;
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
  selection: ContextBudgetSelection;
}
