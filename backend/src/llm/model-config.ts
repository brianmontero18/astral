import { createHash } from "node:crypto";

export const CHAT_MODEL = process.env.CHAT_MODEL ?? "gpt-4o-mini";
export const CHAT_SIMPLE_MODEL = process.env.CHAT_SIMPLE_MODEL ?? CHAT_MODEL;
export const CHAT_COMPLEX_MODEL = process.env.CHAT_COMPLEX_MODEL ?? CHAT_MODEL;

export const REPORT_MODEL = process.env.REPORT_MODEL ?? "gpt-4o-mini";
export const REPORT_PREMIUM_MODEL = process.env.REPORT_PREMIUM_MODEL ?? REPORT_MODEL;

export function hashSystemPrompt(systemPrompt: string): string {
  return createHash("sha256").update(systemPrompt).digest("hex").slice(0, 16);
}
