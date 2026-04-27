/**
 * Feature Flags (backend)
 *
 * Each flag is a boolean read from env at module load. Default ON — flip to OFF
 * via env var for rollback in 1 line of config.
 *
 * Pattern: FEATURE_<NAME> = "true" | "false". Anything not "true"/"1" with a
 * default of true keeps the flag on; "false"/"0" turns it off.
 */

function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw == null || raw === "") return defaultValue;
  if (raw === "true" || raw === "1")  return true;
  if (raw === "false" || raw === "0") return false;
  return defaultValue;
}

export const FLAGS = {
  /** Inject `users.intake` into the chat system prompt. */
  CHAT_INTAKE_CONTEXT: envBool("FEATURE_CHAT_INTAKE_CONTEXT", true),

  /** Persist per-call telemetry rows in `llm_calls`. */
  LLM_TELEMETRY: envBool("FEATURE_LLM_TELEMETRY", true),
} as const;
