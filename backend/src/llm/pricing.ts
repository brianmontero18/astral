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
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  "gpt-4o":      { inputPerMillion: 2.50, outputPerMillion: 10.00 },
};

export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const pricing = PRICING[model];
  if (!pricing) {
    // Unknown model — return 0 so an unrecognized name never produces fake cost.
    // The call-site should still log `model` so we can extend the table.
    return 0;
  }
  return (
    (tokensIn  * pricing.inputPerMillion +
     tokensOut * pricing.outputPerMillion) / 1_000_000
  );
}

export function isKnownModel(model: string): boolean {
  return model in PRICING;
}
