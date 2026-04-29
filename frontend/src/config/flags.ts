/**
 * Feature Flags (frontend)
 *
 * Vite exposes env vars prefixed with `VITE_`. Default ON — flip to OFF in
 * `.env.local` for local rollback testing, or in deploy env for prod rollback.
 */

function envBool(key: string, defaultValue: boolean): boolean {
  const raw = import.meta.env[key];
  if (raw == null || raw === "") return defaultValue;
  if (raw === "true" || raw === "1")  return true;
  if (raw === "false" || raw === "0") return false;
  return defaultValue;
}

export const FLAGS = {
  /** Render 👍/👎 buttons under each assistant message. */
  FEEDBACK_BUTTONS: envBool("VITE_FEATURE_FEEDBACK_BUTTONS", true),
} as const;
