/**
 * LLM Pricing
 *
 * Central pricing table for cost calculation across all LLM call-sites.
 * Update when models are added or vendor pricing changes.
 *
 * Prices are in USD per 1M tokens.
 */

interface ModelPricing {
  inputPerMillion: number;
  cachedInputPerMillion?: number;
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  "gpt-4o-mini": { inputPerMillion: 0.15, cachedInputPerMillion: 0.075, outputPerMillion: 0.60 },
  "gpt-4o":      { inputPerMillion: 2.50, cachedInputPerMillion: 1.25, outputPerMillion: 10.00 },
  "gpt-5.4-mini": { inputPerMillion: 0.75, cachedInputPerMillion: 0.075, outputPerMillion: 4.50 },
  "gpt-5.4-nano": { inputPerMillion: 0.20, cachedInputPerMillion: 0.020, outputPerMillion: 1.25 },
  "gpt-5.4": { inputPerMillion: 2.50, cachedInputPerMillion: 0.25, outputPerMillion: 15.00 },
};

interface CostOptions {
  cachedInputTokens?: number;
}

export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
  options: CostOptions = {},
): number {
  const pricing = PRICING[model];
  if (!pricing) {
    // Unknown model — return 0 so an unrecognized name never produces fake cost.
    // The call-site should still log `model` so we can extend the table.
    return 0;
  }
  const cachedInputTokens = Math.min(
    Math.max(options.cachedInputTokens ?? 0, 0),
    Math.max(tokensIn, 0),
  );
  const normalInputTokens = Math.max(tokensIn - cachedInputTokens, 0);
  const cachedInputPerMillion =
    pricing.cachedInputPerMillion ?? pricing.inputPerMillion;

  return (
    (normalInputTokens * pricing.inputPerMillion +
     cachedInputTokens * cachedInputPerMillion +
     tokensOut         * pricing.outputPerMillion) / 1_000_000
  );
}

export function isKnownModel(model: string): boolean {
  return model in PRICING;
}
