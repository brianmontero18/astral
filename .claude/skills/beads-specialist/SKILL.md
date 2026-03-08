---
name: beads-specialist
type: reference
description: Expert on Beads distributed issue tracker for AI coding workflows. Manages tasks, dependencies, and session continuity. Always validates against official docs before acting.
---

# Beads Specialist Skill

> **Purpose**: Expert guidance on Beads — task tracking, dependencies, session continuity for AI agents.
> **Reference**: `~/toolkit/docs/beads-manual.md` — integration guide and daily workflow.
> **Invoked by**: user, executor, sparring, or any agent managing work state.

---

## When to Use

- Creating, updating, or closing tasks during development
- Setting up dependencies between tasks (blocks, parent-child, discovered-from)
- Debugging Beads sync issues, worktree conflicts, or daemon problems
- Planning work breakdown with `bd dep tree`
- Understanding what's ready to work on (`bd ready`)
- Integrating Beads into a new project

## When NOT to Use

- Cognitive memory / remembering facts (use Letta via `letta-specialist`)
- Memory architecture decisions (use `memory-architect`)
- Application code implementation (use `executor`)

---

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh beads`. If stale (exit 1), do a targeted refresh of the section relevant to your current task before proceeding — check the Sources in the manual for that section's official docs. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/beads-manual.md` for integration patterns and daily workflow
2. **Verify** against official Beads docs before making changes (see resources below)
3. **Check** detection rules below against the current state
4. **Test** with `bd doctor` after configuration changes
5. **Sync** with `bd sync` before any git push

---

## Detection Rules

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | `.beads/` not initialized in project | BLOCKER | Run `bd init` in the project root. Choose "chain with existing hooks". |
| 2 | `bd prime` not in SessionStart hook | WARNING | Add `test -d .beads && bd prime \|\| true` to `config/hooks.json` on_session_start. Run `sync-settings.sh`. |
| 3 | Issues created without dependencies | WARNING | Use `bd dep add <child> <parent>` to link related tasks. Use `--parent` on create for hierarchy. |
| 4 | Session ending without `bd sync` | WARNING | Add `bd sync` before `git push` in session close protocol. See AGENTS.md "Landing the Plane". |
| 5 | Beads version outdated (current installed vs latest) | SUGGESTION | Check `bd --version` vs https://github.com/steveyegge/beads/releases. Update: `brew upgrade beads` or `go install`. |
| 6 | Worktree conflicts with daemon | WARNING | Use `--no-daemon` mode in worktrees. All worktrees share the same `.beads/` database. |
| 7 | `bd ready` returns nothing despite open tasks | WARNING | Check blocking dependencies: `bd dep tree <epic-id>`. A task with unresolved blockers won't appear in `bd ready`. |
| 8 | Issues.jsonl empty despite having issues | SUGGESTION | Run `bd sync` to export DB to JSONL. Check `bd doctor` for sync divergence. |

---

## Self-Check

Before providing the summary below, verify:
1. `.beads/` exists and DB is accessible: `bd doctor`
2. No sync divergence: `bd sync` completes without errors
3. Issue counts match reality: `bd list --status=open` count matches summary

---

## Summary Template

```
### Beads Status: {project}
- **Initialized**: {yes/no}
- **Open tasks**: {N} ({M} ready, {K} blocked)
- **Hooks**: SessionStart={ok/missing} | bd sync in close={yes/no}
- **Version**: {installed} (latest: check GitHub releases)
- **Daemon**: {running/stopped}
- **Issues found**: {list or "none"}
```

---

## Refresh Mode

**Last refreshed**: 2026-02-22

To update the knowledge snapshot:

1. Read `~/toolkit/docs/beads-manual.md` — locate the **Sources** section at the bottom
2. Visit each URL in the Sources tables using WebSearch and FetchUrl:
   - **Official Docs**: check docs site, AGENT_INSTRUCTIONS.md, CONFIG.md for new features or changes
   - **GitHub**: scan open issues and discussions for new pain points, regressions, or resolved bugs
   - **Community**: check Steve Yegge's blog posts for new best practices or announcements
   - **Related**: check if new community tools or integrations have appeared
3. Compare findings with current snapshot content:
   - New version released? Update version refs and check for breaking changes
   - New issues discovered? Update "Known Pain Points" table
   - Bug fixed? Move from pain points to resolved, update detection rules
   - New feature (plugins, multi-agent)? Update capabilities and command reference
   - CLI changes? Update command reference table
4. Update changed sections in `~/toolkit/docs/beads-manual.md`
5. Update the "Last refreshed" date in this skill and in the manual's Snapshot field
6. If detection rules changed, update the table above

**Search queries for refresh**:
- `site:github.com steveyegge/beads` (repo changes, new issues, releases)
- `site:steve-yegge.medium.com beads` (author blog posts)
- `beads issue tracker AI agents 2026` (community content)

---

## Official Resources

| Category | Resource | URL | Content |
|----------|----------|-----|---------|
| Official Docs | Documentation | https://steveyegge.github.io/beads/ | Main docs site |
| Official Docs | Agent Instructions | https://github.com/steveyegge/beads/blob/main/AGENT_INSTRUCTIONS.md | How agents should use Beads |
| Official Docs | Config Reference | https://github.com/steveyegge/beads/blob/main/docs/CONFIG.md | Configuration options |
| Official Docs | Troubleshooting | https://github.com/steveyegge/beads/blob/main/docs/TROUBLESHOOTING.md | Common issues and fixes |
| Official Docs | FAQ | https://github.com/steveyegge/beads/blob/main/docs/FAQ.md | Frequently asked questions |
| Official Docs | Plugin Docs | https://github.com/steveyegge/beads/blob/main/docs/PLUGIN.md | Plugin system |
| GitHub | Main Repo | https://github.com/steveyegge/beads | Source, issues, releases |
| GitHub | Discussions | https://github.com/steveyegge/beads/discussions | Community discussions |
| GitHub | Releases | https://github.com/steveyegge/beads/releases | Version changelog |
| GitHub | Community Tools | https://github.com/steveyegge/beads/blob/main/docs/COMMUNITY_TOOLS.md | Third-party integrations |
| Community | Introducing Beads | https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a | Origin story |
| Community | Beads Best Practices | https://steve-yegge.medium.com/beads-best-practices-2db636b9760c | Official best practices |
| Community | Beads Revolution | https://steve-yegge.medium.com/the-beads-revolution-how-i-built-the-todo-system-that-ai-agents-actually-want-to-use-228a5f9be2a9 | Architecture decisions |
| Community | Gas Town (multi-agent) | https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04 | Multi-agent patterns |

## Known Pain Points

| Area | Pattern | Reference |
|------|---------|-----------|
| Worktree + daemon | Daemon doesn't work correctly with git worktrees. Use `--no-daemon`. | TROUBLESHOOTING.md |
| Sandbox restrictions | Claude Code sandbox restricts daemon control. Causes "out of sync" errors. | Discussion #139 |
| Alpha status | API and JSONL format may change before 1.0. Pin behavior, not schema. | FAQ |
| `bd dep tree` broken | v0.55+ may have regression on dep tree command. | Issue #1954 |
| Ephemeral issues | `bd create --ephemeral` can cause UNIQUE constraint failure. | Issue #1962 |

## Specs Detalladas

Cuando un bead necesita más detalle del que cabe en un body (líneas de código, snippets, tablas de análisis), vincular un markdown en `.beads/docs/`:

```
bd create "[TechDebt] Descripcion" -t task -p 3 --body "Resumen...

---
Detalle técnico completo: ~/toolkit/.beads/docs/TD-XXX.md"
```

Usar para: tech debt de PR reviews, refactors complejos, análisis de causa raíz. No usar para tasks simples.

---

## Quick Command Reference

| I want to... | Command |
|--------------|---------|
| See what's ready to work on | `bd ready` |
| Create a task | `bd create "Title" -t task -p 2` |
| Create under an epic | `bd create "Title" --parent <epic-id>` |
| Claim a task | `bd update <id> --claim` |
| Close a task | `bd-close.sh <id>` (enforces handoff gate) |
| See task details | `bd show <id>` |
| List all open | `bd list --status=open` |
| Add dependency | `bd dep add <blocked> <blocker>` |
| View dependency tree | `bd dep tree <id>` |
| Sync before push | `bd sync` |
| Inject context for agent | `bd prime` |
| Run diagnostics | `bd doctor` |
