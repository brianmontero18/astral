---
name: letta-specialist
type: reference
description: Expert on Letta persistent memory framework. Configures, troubleshoots, and evolves the memory layer. Always validates against official docs before acting.
---

# Letta Specialist Skill

> **Purpose**: Expert guidance on Letta (formerly MemGPT) persistent memory — configuration, troubleshooting, evolution.
> **Reference**: `~/toolkit/docs/letta-manual.md` — user manual and operational guide.
> **Invoked by**: user, architect, or any agent working with the memory layer.

---

## When to Use

- Configuring or troubleshooting Letta server, hooks, or MCP
- Designing memory block structures or archival strategies
- Evaluating new Letta features (sleep-time agents, Learning SDK, memory omni-tool)
- Investigating Ollama embedding issues or version compatibility
- Planning memory consolidation or migration

## When NOT to Use

- General memory architecture decisions (use `memory-architect` skill)
- Application code implementation (use `executor`)
- Non-memory infrastructure work

---

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh letta`. If stale (exit 1), do a targeted refresh of the section relevant to your current task before proceeding — check the Sources in the manual for that section's official docs. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/letta-manual.md` for current setup and operations
2. **Verify** against official Letta docs before making changes (see resources below)
3. **Check** detection rules below against the current state
4. **Test** changes with `~/toolkit/scripts/__tests__/letta-memory.test.sh` (30 integration tests)
5. **Update** the manual if something changed

---

## Detection Rules

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | Letta container not running or unhealthy | BLOCKER | Run `letta-ctl.sh start`. Check `letta-ctl.sh logs` if fails. |
| 2 | Agent `toolkit-memory-v2` not found | BLOCKER | Recreate agent. See `docs/HANDOFF-letta-integration.md` for payload. |
| 3 | Core blocks missing (expected 5) | BLOCKER | Run `letta-ctl.sh memory` to inspect blocks. If missing, recreate agent per `docs/HANDOFF-letta-integration.md`. |
| 4 | Ollama not running or model not pulled | BLOCKER | `brew services start ollama && ollama pull nomic-embed-text` |
| 5 | Hooks not firing on SessionStart | WARNING | Check `config/hooks.json` has `letta-memory.sh` in 3 events. Run `sync-settings.sh`. |
| 6 | MCP disabled (agent can't write during session) | WARNING | Run `mcp-toggle.sh letta on` |
| 7 | Archival entries only contain timestamps (no git context) | WARNING | Update `scripts/hooks/letta-memory.sh` — hooks should call `get_git_context()` |
| 8 | Read-only blocks not set | WARNING | Run `letta-ctl.sh lock-blocks` to protect persona, user_preferences, toolkit_patterns |
| 9 | Letta version not pinned in docker-compose | WARNING | Pin version in `config/docker-compose.letta.yml` (never use `:latest`) |
| 10 | Tests not passing after Letta/Ollama update | BLOCKER | Run `~/toolkit/scripts/__tests__/letta-memory.test.sh` and fix issues before trusting the system |

---

## Self-Check

Before providing the summary below, verify:
1. Server health confirmed (not just "container running"): `letta-ctl.sh health`
2. All 5 core blocks present and non-empty: `letta-ctl.sh memory`
3. Hooks firing (not just configured): test with `CLAUDE_HOOK_EVENT=SessionStart ~/toolkit/scripts/hooks/letta-memory.sh`

---

## Summary Template

```
### Letta Status: {component}
- **Server**: {running/down} (port 8283)
- **Agent**: toolkit-memory-v2 — {healthy/issues}
- **Blocks**: {5/N} ({read-only count} read-only, {writable count} writable)
- **Hooks**: SessionStart={ok/missing} | PreCompact={ok/missing} | Stop={ok/missing}
- **MCP**: {enabled/disabled}
- **Embeddings**: Ollama nomic-embed-text — {running/down}
- **Tests**: {N}/30 passing
- **Issues found**: {list or "none"}
```

---

## Refresh Mode

**Last refreshed**: 2026-03-07

To update the knowledge snapshot:

1. Read `~/toolkit/docs/letta-manual.md` — locate the **Sources** section at the bottom
2. Visit each URL in the Sources tables using WebSearch and FetchUrl:
   - **Official Docs**: check guides, API reference, changelog for new versions or breaking changes
   - **GitHub**: scan open issues for new pain points, regressions, or resolved bugs (especially Ollama compat)
   - **Community**: check Discord, forum, blog for new patterns or known issues
   - **Related**: check Ollama, nomic-embed-text, Learning SDK for upstream changes
3. Compare findings with current snapshot content:
   - New version released? Update setup instructions and version pins
   - New issues discovered? Update "Known Pain Points" table
   - Bug fixed? Move from pain points to resolved, update detection rules
   - New feature (sleep-time agents, memory omni-tool)? Update capabilities section
   - Breaking change? Update detection rules and troubleshooting
4. Update changed sections in `~/toolkit/docs/letta-manual.md`
5. Update the "Last refreshed" date in this skill and in the manual's Snapshot field
6. If detection rules changed, update the table above

**Search queries for refresh**:
- `site:github.com letta-ai/letta` (repo changes, new issues)
- `site:docs.letta.com` (official doc updates)
- `letta memgpt self-hosting 2026` (community content)
- `site:github.com ollama/ollama nomic-embed` (upstream embedding issues)

---

## Official Resources

| Category | Resource | URL | Content |
|----------|----------|-----|---------|
| Official Docs | Documentation | https://docs.letta.com/ | Guides, concepts, quickstart |
| Official Docs | API Reference | https://docs.letta.com/api-reference/overview/ | REST API endpoints |
| Official Docs | Self-hosting Guide | https://docs.letta.com/guides/selfhosting/ | Docker setup, config |
| Official Docs | Memory Guide | https://docs.letta.com/guides/agents/memory/ | Block types, archival |
| GitHub | Main Repo | https://github.com/letta-ai/letta | Source, issues, releases |
| GitHub | Learning SDK | https://github.com/letta-ai/learning-sdk | Sleep-time learning |
| GitHub | AI Memory SDK | https://github.com/letta-ai/ai-memory-sdk | Memory-focused SDK |
| Community | Discord | https://discord.gg/letta | Real-time community support |
| Community | Forum | https://forum.letta.com | Discussions, feature requests |
| Community | Sleep-time Best Practices | https://forum.letta.com/t/sleeptime-agents-for-memory-consolidation-best-practices-guide/154 | Production consolidation patterns |
| Related | MemGPT Paper | https://arxiv.org/abs/2310.08560 | Original research paper |
| Related | A-MAC (Quality Gates) | https://arxiv.org/abs/2603.04549 | Memory admission control |
| Related | FadeMem (Forgetting) | https://arxiv.org/abs/2601.18642 | Differential decay strategies |
| Related | Copilot Memory Architecture | https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/ | JIT verification, citations, TTL |
| Related | DeepLearning.ai Course | https://www.deeplearning.ai/short-courses/llms-as-operating-systems-agent-memory/ | LLMs as OS course |

## Known Pain Points

| Area | Pattern | Reference |
|------|---------|-----------|
| Ollama compatibility | Breaks across Letta versions. Always pin version. v0.16.2 regression fixed before v0.16.4. | GitHub issues #3142, #3143, #2678, #2668 |
| Embedding discovery | Provider-specific quirks. nomic-embed-text is stable. | Issues #3171, #3086 |
| Archival deduplication | No built-in dedup. Use sleep-time agents for consolidation. | Issue #3116, Forum best practices guide |
| File upload embeddings | May bypass Ollama config. Use API direct insert. | Issue #2678 |
| Context rot | Models degrade with polluted context. RecoveryBench quantifies this. | Letta blog: recovery-bench |

## Our Setup

| Component | Value |
|-----------|-------|
| Server | Docker `letta/letta:0.16.4` on port 8283 |
| Container | `toolkit-letta` |
| Embeddings | Ollama `nomic-embed-text` (local, $0) |
| Agent | `toolkit-memory-v2` |
| Blocks | 5 (3 read-only + 2 writable) |
| Hooks | SessionStart (load + clear scratchpad), PreCompact (git context), Stop (git context + scratchpad) |
| CLI | `~/toolkit/scripts/letta-ctl.sh` |
| Tests | `~/toolkit/scripts/__tests__/letta-memory.test.sh` (30 tests) |
| MCP | `~/toolkit/scripts/mcp-toggle.sh letta on/off` |
