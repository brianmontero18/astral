export type ContextPressureLevel = "elevated" | "high";

export interface ChatContextBudgetSummary {
  model: string;
  provider: "openai" | "anthropic" | "unknown";
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
  blocks: Array<{
    id: string;
    tokens: number;
    /** Fraction of model context window used by this block (0..1), or null when unknown. */
    percentOfWindow: number | null;
  }>;
}

export interface ChatContextPressureWarning {
  level: ContextPressureLevel;
  title: string;
  body: string;
  dismissLabel: string;
}

const ELEVATED_PERCENT_USED = 0.7;
const HIGH_PERCENT_USED = 0.85;
const ELEVATED_HISTORY_SHARE = 0.4;
const HIGH_HISTORY_SHARE = 0.55;
const ELEVATED_HISTORY_TOKENS = 6_000;
const HIGH_HISTORY_TOKENS = 10_000;

const WARNING_COPY: Record<ContextPressureLevel, ChatContextPressureWarning> = {
  elevated: {
    level: "elevated",
    title: "La conversación está creciendo",
    body: "Astral va a priorizar tus mensajes recientes y la memoria guardada para responder mejor.",
    dismissLabel: "Entendido",
  },
  high: {
    level: "high",
    title: "La conversación está muy cargada",
    body: "Astral va a enfocarse en lo más reciente y en tu memoria guardada para cuidar la calidad de la respuesta.",
    dismissLabel: "Seguir así",
  },
};

function getHistoryShare(budget: ChatContextBudgetSummary): number {
  if (budget.used <= 0) {
    return 0;
  }
  return budget.breakdown.history / budget.used;
}

export function getChatContextPressureWarning(
  budget: ChatContextBudgetSummary | null,
): ChatContextPressureWarning | null {
  if (!budget) {
    return null;
  }

  const percentUsed = budget.percentUsed;
  const historyShare = getHistoryShare(budget);
  const historyTokens = budget.breakdown.history;

  const highPressure =
    (percentUsed !== null && percentUsed >= HIGH_PERCENT_USED) ||
    (historyShare >= HIGH_HISTORY_SHARE && historyTokens >= HIGH_HISTORY_TOKENS);

  if (highPressure) {
    return WARNING_COPY.high;
  }

  const elevatedPressure =
    (percentUsed !== null && percentUsed >= ELEVATED_PERCENT_USED) ||
    (historyShare >= ELEVATED_HISTORY_SHARE && historyTokens >= ELEVATED_HISTORY_TOKENS);

  return elevatedPressure ? WARNING_COPY.elevated : null;
}

function getContextPressureRank(level: ContextPressureLevel): number {
  return level === "high" ? 2 : 1;
}

export function shouldShowContextPressureWarning(
  warning: ChatContextPressureWarning | null,
  dismissedLevel: ContextPressureLevel | null,
): boolean {
  if (!warning) {
    return false;
  }

  if (!dismissedLevel) {
    return true;
  }

  return getContextPressureRank(warning.level) > getContextPressureRank(dismissedLevel);
}
