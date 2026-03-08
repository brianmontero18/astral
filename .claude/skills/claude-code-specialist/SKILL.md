---
name: claude-code-specialist
type: reference
description: Expert on Claude Code IDE — skills format, hooks API, subagents, MCP, CLI, settings. Always validates against official docs before acting.
---

# Claude Code Specialist Skill

> **Purpose**: Expert guidance on Claude Code — skills, hooks, subagents, MCP, configuration, CLI.
> **Reference**: `~/toolkit/docs/claude-code-manual.md` — state of the art snapshot.
> **Invoked by**: user, prompt-factory, architect, or any agent working with Claude Code features.

---

## When to Use

- Creating or modifying skills (SKILL.md format, frontmatter fields)
- Configuring hooks (events, matchers, handler types)
- Setting up MCP servers (transports, scopes, Tool Search)
- Creating subagents (frontmatter, model selection, tool restrictions)
- Configuring CLAUDE.md, settings, permissions
- CLI flags and environment variables
- Debugging Claude Code behavior (compaction, memory, flickering)

## When NOT to Use

- General prompt engineering (use `prompt-certification` skill)
- Memory architecture decisions (use `memory-architect` skill)
- Letta-specific issues (use `letta-specialist`)

---

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh claude-code`. If stale (exit 1), do a targeted refresh of the section relevant to your current task before proceeding — check the Sources in the manual for that section's official docs. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/claude-code-manual.md` for current state of the art
2. **Verify** against official docs before making changes (see Sources in the manual)
3. **Check** detection rules below against the current state
4. **Apply** changes following the manual's documented patterns
5. **Update** the manual if something changed

---

## Detection Rules

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | Skill description missing "when to use" trigger phrases | WARNING | Add trigger phrases per Anthropic guide: "Use when..." |
| 2 | Skill frontmatter using fields not in official spec | BLOCKER | Check manual → Skills → Campos de frontmatter |
| 3 | Hook using event not in the 18 documented events | BLOCKER | Check manual → Hooks → Eventos disponibles |
| 4 | MCP configured with SSE transport | WARNING | SSE is deprecated. Switch to HTTP (Streamable HTTP) |
| 5 | Subagent trying to spawn other subagents | BLOCKER | Not supported. Redesign as skill composition |
| 6 | CLAUDE.md over 200 lines | WARNING | Split into `.claude/rules/` directory or use `@import` |
| 7 | Skills in `node_modules` or gitignored directories | BLOCKER | Security fix v2.1.69 — nested skill discovery blocked for gitignored dirs |
| 8 | Using Opus 4 or 4.1 model names | BLOCKER | Removed in v2.1.68. Use `opus` (resolves to 4.6) |
| 9 | Hook command without timeout consideration | SUGGESTION | Default is 600s for command hooks. Set explicit timeout for long-running hooks |
| 10 | `((var++))` with `set -e` in hook scripts | BLOCKER | Bash arithmetic evaluating to 0 is falsy. Use `var=$((var + 1))` |

---

## Refresh Mode

**Last refreshed**: 2026-03-05

To update the knowledge snapshot:

1. Read `~/toolkit/docs/claude-code-manual.md` — locate the **Sources** section at the bottom
2. Visit each URL in the Sources tables using WebSearch and FetchUrl:
   - **Official Docs**: check skills, hooks, MCP, subagents, settings, CLI docs for changes
   - **GitHub**: scan releases for new versions, top issues for new pain points
   - **Community**: check Anthropic Engineering blog for new patterns
3. Compare findings with current snapshot content:
   - New version released? Update version, "Cambios recientes" table
   - New hook events? Update the 18-event table
   - New skill frontmatter fields? Update Skills → Campos de frontmatter
   - New CLI flags? Update CLI section
   - Breaking changes? Update detection rules
   - New pain points? Update Known Pain Points table
4. Update changed sections in `~/toolkit/docs/claude-code-manual.md`
5. Update the "Last refreshed" date in this skill and in the manual's Snapshot/Version fields
6. If detection rules changed, update the table above

**Search queries for refresh**:
- `site:github.com anthropics/claude-code releases` (new versions)
- `site:code.claude.com/docs` (official doc updates)
- `claude code new features 2026` (community coverage)
- `site:anthropic.com/engineering` (engineering blog posts)

---

## Self-Check

Before providing the summary below, verify:
1. Manual exists and is readable: `ls ~/toolkit/docs/claude-code-manual.md`
2. Installed version matches snapshot: `claude --version` vs manual header
3. Hook events in manual match installed version's capabilities

---

## Summary Template

```
### Claude Code Status
- **Installed**: v{version}
- **Snapshot**: {manual snapshot date}
- **Stale**: {yes/no — compare dates}
- **Skills**: {N} personal + {M} project
- **Hooks**: {configured events}
- **MCPs**: {N} configured ({M} enabled)
- **Issues found**: {list or "none"}
```

---

## Quick Reference

| I want to... | Where to look |
|--------------|--------------|
| Create a skill | Manual → Skills → Formato SKILL.md |
| Add a hook | Manual → Hooks → Eventos disponibles |
| Configure MCP | Manual → MCP → Scopes de config |
| Create a subagent | Manual → Subagents → Frontmatter |
| Check CLI flags | Manual → CLI → Flags principales |
| See known issues | Manual → Known Pain Points |
| Check latest changes | Manual → Cambios recientes |
