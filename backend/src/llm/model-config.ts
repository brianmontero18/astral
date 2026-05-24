import { createHash } from "node:crypto";

export const CHAT_MODEL = process.env.CHAT_MODEL ?? "gpt-4o-mini";

export function hashSystemPrompt(systemPrompt: string): string {
  return createHash("sha256").update(systemPrompt).digest("hex").slice(0, 16);
}
