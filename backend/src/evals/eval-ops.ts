/**
 * Pure helpers for the eval ops scripts (seed corpus export + degradation alert).
 *
 * Kept separate from the prod-audits scripts so they can be unit-tested without
 * loading prod-env / connecting to Turso. The scripts wire these to prod I/O.
 *
 * Human labeling is NOT here: it goes through the app's admin write path
 * (POST /admin/users/:id/messages/:messageId/label → setHumanEvalLabel), per the
 * prod-audits convention against reusable write scripts.
 */

import type { EvalPassRateRow } from "../db.js";

// ─── Seed corpus ───────────────────────────────────────────────────────────────

export interface SeedConversationEntry {
  assistantMsgId: number;
  userId: string;
  name: string | null;
  email: string | null;
  userInput: string | null;
  output: string;
  intake: unknown;
  memory: string | null;
  createdAt: string;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function safeParseJson(value: unknown): unknown {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Maps a raw seed query row (assistant turn + preceding user msg + user fields). */
export function mapSeedRow(row: Record<string, unknown>): SeedConversationEntry {
  return {
    assistantMsgId: Number(row.assistant_id),
    userId: String(row.user_id),
    name: asString(row.name),
    email: asString(row.email),
    userInput: asString(row.user_content),
    output: String(row.assistant_content ?? ""),
    intake: safeParseJson(row.intake),
    memory: asString(row.memory_md),
    createdAt: String(row.created_at ?? ""),
  };
}

// ─── Degradation alert ───────────────────────────────────────────────────────

export const DEFAULT_PASSRATE_THRESHOLD = 0.7;

/** Resolves a threshold from a raw string; falls back when missing/invalid. Clamped to [0,1]. */
export function resolvePassRateThreshold(
  raw: string | undefined,
  fallback = DEFAULT_PASSRATE_THRESHOLD,
): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

/** Evals below the threshold (only those with at least one sample). */
export function findDegradedEvals(
  rows: EvalPassRateRow[],
  threshold: number,
): EvalPassRateRow[] {
  return rows.filter((r) => r.total > 0 && r.passRate < threshold);
}
