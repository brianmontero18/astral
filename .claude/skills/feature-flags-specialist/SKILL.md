---
name: feature-flags-specialist
type: reference
description: Expert on MeLi Feature Flags — frontend-feature-flags SDK, rollout strategies, flag lifecycle, manos integration patterns. Use when adding, evaluating, or cleaning up feature flags.
---

# Feature Flags Specialist Skill

> **Purpose**: Expert guidance on MeLi feature flags — SDK usage, rollout, override patterns, cleanup.
> **Reference**: `~/toolkit/docs/feature-flags-manual.md` — state of the art snapshot.
> **MCP**: `fury-ai-data-ragaas` — RAG sobre docs internas de feature flags.

## When to Use

- Adding a new feature flag to a page/component
- Evaluating flags in getServerSideProps
- Setting up header or config overrides for testing
- Deciding between feature flags vs config service vs experiments
- Cleaning up flags after successful rollout
- Debugging flag evaluation (wrong values, targeting issues)

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh feature-flags`. If stale (exit 1), do a targeted refresh of the section relevant to your current task — query the RAG via `fury-ai-data-ragaas` for updates. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/feature-flags-manual.md` for current patterns and architecture
2. **Check** detection rules below against the current code
3. **Verify** against manos codebase patterns (services/featureFlags/, app/contexts/)
4. **Apply** the correct pattern from the manual
5. **Remind** about cleanup — every flag added must eventually be removed

## Detection Rules

| # | Signal | Action |
|---|--------|--------|
| 1 | Import from `frontend-feature-flags` | Verify SDK usage matches manual patterns |
| 2 | `getFeatureFlags()` call | Check flag names, override priority, error handling |
| 3 | `FeatureFlagsProvider` or `FeatureFlagsContext` | Verify context pattern matches manual |
| 4 | `x-manos-feature-flag` header reference | Document as testing override, not production |
| 5 | `featureFlags.overrides` in config | Verify used for permanent env-specific flags only |
| 6 | New `getServerSideProps` file | Check if feature flags are needed for the page |
| 7 | `EvaluationContext` usage | Verify req is passed for user context |
| 8 | Conditional rendering based on flag | Ensure flag has cleanup plan |
| 9 | Discussion of "toggle", "rollout", "canary" | Suggest feature flags if appropriate |
| 10 | Discussion of "permanent config", "env setting" | Redirect to Config Service, NOT flags |
| 11 | Flag code without cleanup comment/task | Warn about tech debt, recommend cleanup ticket |

## Anti-patterns

| Don't | Do instead |
|-------|-----------|
| Create flag for permanent configuration | Use Config Service |
| Leave flags after 100% rollout | Clean up code + archive flag |
| Instantiate FeatureFlagService per request | Use singleton pattern |
| Use flags for secrets | Use node-melitk-secrets |
| Hardcode flag values in code | Use config overrides or header overrides |

## Refresh Mode

| Field | Value |
|-------|-------|
| Frequency | weekly |
| Source | fury-ai-data-ragaas RAG |
| Manual | `docs/feature-flags-manual.md` |
| Last refreshed | 2026-03-07 |
