import type { AppUserPlan } from "./types";

export function getAccessibleReportTier(
  plan: AppUserPlan,
): "free" | "premium" {
  return plan === "premium" ? "premium" : "free";
}
