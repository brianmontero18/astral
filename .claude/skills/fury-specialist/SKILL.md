---
name: fury-specialist
type: reference
description: Expert on MercadoLibre Fury platform — CLI, deployments, scopes, versions, monitoring, networking, auth. Use when working with Fury infrastructure, deployments, or troubleshooting.
---

# Fury Specialist Skill

> **Purpose**: Expert guidance on Fury platform — deployments, CLI, scopes, monitoring, auth.
> **Reference**: `~/toolkit/docs/fury-manual.md` — state of the art snapshot.
> **MCP**: `fury-ai-data-ragaas` — RAG over Fury internal docs.
> **Invoked by**: user, executor, architect, or any agent working with Fury infrastructure.

---

## When to Use

- Creating versions and understanding deployment workflow (agents observe, humans deploy)
- Troubleshooting deployment issues (states, rollbacks)
- Configuring feature flags for manos
- Understanding Fury CLI commands and output parsing
- Diagnosing instance issues (logs, networking, resources)
- Configuring auth (Tiger Token, Odin, Authorization Policies)
- Understanding the release pipeline

## When NOT to Use

- Frontend code/components (use `nordic-specialist`)
- Feature flag experimentation design (use `feature-flags-specialist`)
- General infra unrelated to Fury

---

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh fury`. If stale (exit 1), query `mcp__fury-ai-data-ragaas__search_knowledge` for the relevant topic. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/fury-manual.md` for CLI reference, deployment patterns, gotchas
2. **Consult MCP** (`fury-ai-data-ragaas`) for topics not covered in the manual (see Gaps section)
3. **Check** detection rules below against current actions
4. **Apply** changes following documented patterns
5. **Update** the manual if something changed

---

## Detection Rules

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | Agent attempting to run `fury-deploy.sh` or `fury deployments create` | BLOCKER | Agents MUST NOT deploy. Only humans deploy. |
| 2 | Version name > 20 chars or with uppercase | BLOCKER | Must be <20 chars, lowercase, no `v` prefix |
| 3 | Parsing Fury CLI output without ANSI stripping | WARNING | CLI outputs ANSI codes + NBSP (U+00A0). Strip before parsing |
| 4 | Using `fury run` for local dev | WARNING | Deprecated. Use `fury bash` or `fury execute` |
| 5 | Feature not behind feature flag | BLOCKER | All new features MUST be behind flags before merge to develop |
| 6 | Feature flag without `manos-` prefix | WARNING | Flag names must use `manos-` prefix |
| 7 | Trying to create existing version name | BLOCKER | Check `fury list-versions` first. Same name = collision error |
| 8 | Accessing Fury services without VPN | BLOCKER | All Fury MCPs and internal APIs require MeLi VPN |
| 9 | Deploying to prod without staging validation | BLOCKER | Always validate in staging first. Release cadence: weekly Tuesdays |

---

## Refresh Mode

**Last refreshed**: 2026-03-07

To update the knowledge snapshot:

1. Query `mcp__fury-ai-data-ragaas__search_knowledge` for each gap listed in the manual
2. Run `fury --help` and check for new commands/plugins
3. Check `fury info` for updated plugin versions
4. Compare findings with `~/toolkit/docs/fury-manual.md`
5. Update changed sections
6. Update "Last refreshed" date

---

## Quick Reference

| I want to... | Where to look |
|--------------|--------------|
| Deploy a version | Manual -> Deployments (but agents can't deploy!) |
| Check deployment status | `fury list-infra` |
| See logs | `fury logs SCOPE [-m N]` |
| Create a version | `fury create-version VERSION [--no-tests]` |
| Get Tiger Token | `fury get-token` |
| Check instance health | `fury command top/ps/netstat/df` |
| Understand release pipeline | Manual -> Release Pipeline |
| Parse CLI output safely | Manual -> Known Gotchas (#2, #3) |
