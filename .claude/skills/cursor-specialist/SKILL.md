---
name: cursor-specialist
type: reference
description: Expert on Cursor IDE — rules format, agent modes, composer, MCP, tab completion, configuration. Always validates against official docs before acting.
---

# Cursor Specialist Skill

> **Purpose**: Expert guidance on Cursor IDE — rules, agents, MCP, configuration.
> **Reference**: `~/toolkit/docs/cursor-manual.md` — state of the art snapshot.
> **Invoked by**: user, prompt-factory, architect, or any agent working with Cursor features.

---

## When to Use

- Creating or modifying Cursor rules (`.cursor/rules/*.md`, frontmatter, application modes)
- Configuring MCP servers in Cursor (`.cursor/mcp.json`)
- Setting up custom modes or agent configurations
- Deploying toolkit rules to a project (via `cursor-rules-link.sh`)
- Comparing Cursor vs Claude Code capabilities
- Debugging Cursor agent behavior, tab completion, context issues

## When NOT to Use

- Claude Code features (use `claude-code-specialist`)
- General prompt engineering (use `prompt-certification`)
- Model selection (use `anthropic-models-specialist`)

---

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh cursor`. If stale (exit 1), do a targeted refresh of the section relevant to your current task before proceeding — check the Sources in the manual for that section's official docs. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/cursor-manual.md` for current state of the art
2. **Verify** against official docs before making changes (see Sources in the manual)
3. **Check** detection rules below against the current state
4. **Apply** changes following the manual's documented patterns
5. **Update** the manual if something changed

---

## Detection Rules

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | `.cursorrules` file present | WARNING | Migrate to `.cursor/rules/*.md` — `.cursorrules` is deprecated |
| 2 | Rule with `alwaysApply: true` and `globs` set | WARNING | Redundant: `alwaysApply` ignores globs. Remove one |
| 3 | Rule expecting to affect Tab completion | BLOCKER | Rules do NOT affect Tab — only Agent and Inline Edit |
| 4 | User Rules expecting Inline Edit (Cmd+K) | WARNING | User Rules only apply in Chat Agent, not Inline Edit |
| 5 | MCP using SSE transport | WARNING | SSE deprecated. Switch to Streamable HTTP |
| 6 | `.cursorignore` treated as security boundary | BLOCKER | Best-effort only. Terminal and MCP tools bypass it |
| 7 | Single rule file > 500 lines | WARNING | Split into multiple composable rules |
| 8 | Auto mode rule without `description` | BLOCKER | Intelligent mode needs `description` to decide relevance |

---

## Refresh Mode

**Last refreshed**: 2026-03-05

To update the knowledge snapshot:

1. Read `~/toolkit/docs/cursor-manual.md` — locate the **Sources** section at the bottom
2. Visit each URL in the Sources tables using WebSearch and WebFetch:
   - **Official Docs**: check rules, modes, MCP, models, tab docs for changes
   - **Changelog**: scan for new versions, features, breaking changes
   - **Community**: check Cursor Blog and Forum for patterns
3. Compare findings with current snapshot content:
   - New version? Update version, "Cambios recientes" table
   - New agent modes? Update Agent / Modos section
   - New rule frontmatter fields? Update Rules section
   - MCP changes? Update MCP section
   - Breaking changes? Update detection rules
   - New pain points? Update Known Pain Points table
4. Update changed sections in `~/toolkit/docs/cursor-manual.md`
5. Update the "Last refreshed" date in this skill and in the manual's Snapshot field
6. If detection rules changed, update the table above

**Search queries for refresh**:
- `site:cursor.com/changelog` (new versions)
- `site:cursor.com/docs` (official doc updates)
- `cursor IDE new features 2026` (community coverage)
- `cursor rules format changes 2026` (rules-specific)

---

## Quick Reference

| I want to... | Where to look |
|--------------|--------------|
| Create a rule | Manual -> Rules -> Formato MDC |
| Configure MCP | Manual -> MCP -> Formato JSON |
| Set up custom mode | Manual -> Agent / Modos -> Custom Modes |
| Deploy toolkit rules | `scripts/cursor-rules-link.sh` |
| Ignore files from AI | Manual -> .cursorignore |
| Compare with Claude Code | Manual -> Features + `docs/claude-code-manual.md` |
| Check latest changes | Manual -> Cambios recientes |
