---
name: anthropic-models-specialist
type: reference
description: Expert on Anthropic Claude models — IDs, context windows, pricing, capabilities, rate limits, deprecation. Use when choosing models, configuring API calls, or debugging model-specific behavior.
---

# Anthropic Models Specialist Skill

> **Purpose**: Expert guidance on Claude model selection, capabilities, pricing, and API configuration.
> **Reference**: `~/toolkit/docs/anthropic-models-manual.md` — state of the art snapshot.
> **Invoked by**: user, prompt-factory, architect, or any agent making model decisions.

---

## When to Use

- Choosing between Opus, Sonnet, Haiku for a task
- Configuring API parameters (effort, thinking, output tokens)
- Checking pricing, rate limits, or context window sizes
- Verifying model IDs for API calls or Claude Code `--model` flag
- Debugging model-specific behavior (prefill, adaptive thinking, etc.)
- Checking deprecation schedule before using a model ID

## When NOT to Use

- Claude Code IDE features (use `claude-code-specialist`)
- Cursor IDE features (use `cursor-specialist`)
- Prompt engineering technique (use `prompt-certification`)

---

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh anthropic-models`. If stale (exit 1), do a targeted refresh of the section relevant to your current task before proceeding — check the Sources in the manual for that section's official docs. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/anthropic-models-manual.md` for current state of the art
2. **Verify** against official docs for any pricing/capability claims (see Sources)
3. **Check** detection rules below against the current usage
4. **Recommend** the right model based on the guidance table
5. **Update** the manual if something changed

---

## Detection Rules

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | Using retired model ID (e.g., `claude-3-opus`, `claude-3-7-sonnet`) | BLOCKER | Model retired. Switch to current equivalent |
| 2 | Using `claude-3-haiku-20240307` | WARNING | Deprecated Feb 19, retires Apr 20 2026. Migrate to `claude-haiku-4-5` |
| 3 | Setting `budget_tokens` on Opus/Sonnet 4.6 | WARNING | Deprecated. Use effort parameter (`low`/`medium`/`high`/`max`) or adaptive thinking |
| 4 | Using `thinking: {type: "enabled"}` on 4.6 models | WARNING | Deprecated on 4.6. Adaptive thinking enabled automatically |
| 5 | Using `output_format` parameter | WARNING | Deprecated. Use `output_config.format` |
| 6 | Prefilling assistant message with Opus 4.6 | BLOCKER | Returns 400 error. Use structured outputs or system prompts |
| 7 | Requesting 1M context without Tier 4 | BLOCKER | 1M beta requires Tier 4 org + beta header |
| 8 | Using Haiku for complex reasoning/coding | WARNING | Haiku 4.5 lacks adaptive thinking. Use Sonnet 4.6 minimum |
| 9 | Opus 4.6 for high-volume classification | WARNING | Overkill. Use Haiku 4.5 (5x cheaper, faster) |
| 10 | Not using prompt caching for repeated context | SUGGESTION | 90% savings on cache hits. Enable for RAG, long system prompts |

---

## Refresh Mode

**Last refreshed**: 2026-03-05

To update the knowledge snapshot:

1. Read `~/toolkit/docs/anthropic-models-manual.md` — locate the **Sources** section
2. Visit each URL in the Sources tables using WebSearch and WebFetch:
   - **Models overview**: check for new models, retired models
   - **Pricing**: verify current per-token costs
   - **Rate limits**: check tier changes
   - **Deprecations**: update retirement schedule
   - **Blog**: check for new model announcements
3. Compare findings with current snapshot content:
   - New model released? Add to models table, update "Recomendados"
   - Price change? Update pricing tables
   - Model deprecated/retired? Move between tables
   - New capability? Update capabilities matrix
   - Rate limit change? Update rate limits table
4. Update changed sections in `~/toolkit/docs/anthropic-models-manual.md`
5. Update "Last refreshed" date in this skill and manual
6. If detection rules changed, update the table above

**Search queries for refresh**:
- `site:anthropic.com/news claude model` (new model announcements)
- `site:platform.claude.com/docs models` (official docs updates)
- `anthropic claude new model 2026` (coverage)
- `claude API pricing changes 2026` (pricing updates)

---

## Quick Reference

| I want to... | Where to look |
|--------------|--------------|
| Choose a model | Manual -> Guia de seleccion |
| Get model ID for API | Manual -> Modelos actuales -> Model ID |
| Check pricing | Manual -> Pricing |
| Check context limits | Manual -> Context Windows y Output |
| See what features a model has | Manual -> Capabilities por modelo |
| Check rate limits | Manual -> Rate Limits por Tier |
| See deprecation dates | Manual -> Legacy / Retirados |
| Check what's new in 4.6 | Manual -> Novedades Claude 4.6 |
