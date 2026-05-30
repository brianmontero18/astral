/**
 * Feature Flags (backend)
 *
 * Each flag is a boolean read from env at module load. Defaults are chosen per
 * feature so rollback remains 1 line of config.
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

  /**
   * Persistent memory layer (Living Document). When ON: chat reads
   * `users.memory_md` and injects it as `<user_memory>`; after every Nth
   * user turn the writer extracts/merges facts into the markdown
   * asynchronously. When OFF the column is ignored on both sides — feature
   * is fully reversible by config.
   */
  MEMORY_LIVING_DOCUMENT: envBool("FEATURE_MEMORY_LIVING_DOCUMENT", true),

  /**
   * Remote MCP surface for external clients. Default OFF while the transport,
   * auth model, tools, budgets, and client compatibility are rolled out slice
   * by slice.
   */
  REMOTE_MCP: envBool("FEATURE_REMOTE_MCP", false),

  /**
   * Post-hoc advisor-quality evals on chat turns (astral-y3c.3). Default OFF.
   * When ON: after the reply is persisted, runs the heuristic eval suite
   * fire-and-forget and stores rows in `eval_results`. Never blocks the user;
   * a failure only logs at warn level. Runs locally — no LLM tokens.
   */
  POST_HOC_EVAL_CHAT: envBool("FEATURE_POST_HOC_EVAL_CHAT", false),

  /**
   * Post-hoc advisor-quality evals on generated reports (astral-y3c.3). Default
   * OFF. Same fire-and-forget contract as POST_HOC_EVAL_CHAT.
   */
  POST_HOC_EVAL_REPORT: envBool("FEATURE_POST_HOC_EVAL_REPORT", false),
} as const;
