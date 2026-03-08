---
name: memory-architect
type: reference
description: Design and evaluate memory systems for AI agents. Applies the 4-type memory taxonomy (working, semantic, procedural, episodic) to real architectures.
---

# Memory Architect Skill

> **Purpose**: Design, evaluate, and evolve memory architectures for AI agent systems.
> **Reference**: `~/toolkit/docs/memory-architecture.md` — foundational architecture document.
> **Invoked by**: user, architect, sparring, or any agent designing memory systems.

---

## When to Use

- Designing memory architecture for a new project or agent system
- Evaluating if the current memory model covers all needs
- Deciding what to remember vs what to forget
- Planning memory consolidation strategies
- Comparing memory tools (Letta vs Mem0 vs file-based vs custom)
- Reviewing cross-session or cross-agent memory patterns

## When NOT to Use

- Letta-specific configuration or troubleshooting (use `letta-specialist`)
- Application code implementation
- Task tracking questions (use Beads directly)

---

## Process

1. **Read** `~/toolkit/docs/memory-architecture.md` for the taxonomy and protocol
2. **Classify** the need using the 4-type model below
3. **Map** to the correct system (AGENTS.md, Letta, Beads, Skills/Rules)
4. **Validate** against the memory protocol (what goes where)
5. **Research** current best practices if the domain is evolving

---

## The 4 Memory Types (Quick Reference)

| Type | What it stores | Duration | Example |
|------|---------------|----------|---------|
| **Working** | Current task context | Session | The file you're editing now |
| **Semantic** | Facts, preferences, decisions | Persistent | "PRs van en español" |
| **Procedural** | How to do things | Persistent | Skills, rules, scripts |
| **Episodic** | Past experiences | Persistent | "Last deploy failed because..." |

### Decision flow

```
¿Qué tipo de información es?

  Algo que estoy pensando ahora     → Working (no hacer nada, el IDE lo maneja)
  Un hecho o preferencia            → Semantic (Letta core block)
  Cómo hacer algo                   → Procedural (skill o rule)
  Algo que pasó / que aprendí       → Episodic (Letta archival)
  Una tarea pendiente               → Beads (no es memoria, es tracking)
```

---

## Detection Rules

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | No hay memoria semántica cargada al inicio de sesión | BLOCKER | Run `letta-ctl.sh status`. Confirm `config/hooks.json` has `letta-memory.sh` in `on_session_start`. Run `sync-settings.sh` to push hooks to IDE. |
| 2 | Decisiones importantes no se persisten entre sesiones | WARNING | Enable Letta MCP: `mcp-toggle.sh letta on`. Agent writes to `session_scratchpad` during session; Stop hook captures to archival. |
| 3 | Memoria episódica solo tiene timestamps, no contenido | WARNING | Update `scripts/hooks/letta-memory.sh` to call `get_git_context()` in PreCompact/Stop handlers. See current implementation for reference. |
| 4 | MCP de Letta deshabilitado — agente no puede escribir | WARNING | Run `mcp-toggle.sh letta on`. Confirm `config/mcp.json` has `letta.disabled: false`. |
| 5 | Duplicación entre MEMORY.md y Letta core blocks | SUGGESTION | Edit MEMORY.md: keep only ~20 lines of fallback essentials. Move detailed content to Letta blocks via `letta-ctl.sh` API. Test fallback: `mcp-toggle.sh letta off`, start new session, confirm MEMORY.md loads. |
| 6 | Memoria creciendo sin consolidación | SUGGESTION | Read `docs/letta-manual.md` section "Sleep-time agents". Add sleep-time config to `config/docker-compose.letta.yml`. Test with `letta-ctl.sh restart`. |
| 7 | Experiencias pasadas no son buscables semánticamente | WARNING | Run `curl localhost:11434/api/tags` (Ollama must be running). Run `letta-ctl.sh archival` to confirm entries exist. If empty, trigger a session stop to populate. |

---

## Summary Template

```
### Memory Architecture: {system/project}
- **Working memory**: {handled by IDE natively / custom}
- **Semantic memory**: {Letta core blocks — N blocks, M read-only / gaps}
- **Procedural memory**: {N skills, M rules / gaps}
- **Episodic memory**: {Letta archival — enriched hooks / timestamps only / not configured}
- **Cross-session**: {hooks active on SessionStart+Stop / MCP only / not configured}
- **Verdict**: {PASS — all 4 types covered | FAIL — missing: X, Y}
```

---

## Self-Check

Before providing the summary above, verify:
1. All 4 memory types were evaluated (not just the ones that work)
2. Cross-IDE compatibility was considered (hooks vs MCP availability)
3. Memory safety was assessed (read-only blocks, no code storage, archival as hints)

---

## Research References

### Taxonomía

- *Memory in the Age of AI Agents* — arXiv Survey (2025) — https://arxiv.org/abs/2512.13564
- *A-MEM: Agentic Memory* — NeurIPS (2025) — https://arxiv.org/abs/2502.12110
- *Rethinking Memory Mechanisms of Foundation Agents* (2026) — https://arxiv.org/html/2602.06052v3
- LangChain: Memory for Agents — https://blog.langchain.com/memory-for-agents/

### Quality Gates y Admisión

- *A-MAC: Adaptive Memory Admission Control* (2026) — https://arxiv.org/abs/2603.04549
- OpenAI Agents SDK: Context Personalization — https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization/
- GitHub Copilot Memory Architecture — https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/

### Patrones de producción

- Anthropic: Effective Context Engineering — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic: Long-Running Agent Harnesses — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Manus: Context Engineering — https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- AWS: AgentCore Long-Term Memory — https://aws.amazon.com/blogs/machine-learning/building-smarter-ai-agents-agentcore-long-term-memory-deep-dive/
- O'Reilly: Memory Engineering for Multi-Agent Systems — https://www.oreilly.com/radar/why-multi-agent-systems-need-memory-engineering/

### Herramientas

- Letta: Agent Memory — https://www.letta.com/blog/agent-memory
- Letta: RecoveryBench (context rot) — https://www.letta.com/blog/recovery-bench
- Mem0: Research Paper — https://arxiv.org/abs/2504.19413
- Weaviate: Context Engineering — https://weaviate.io/blog/context-engineering

### Consolidación y olvido

- *FadeMem: Teaching AI Agents to Forget* (2026) — https://arxiv.org/abs/2601.18642
- Letta: Sleep-time Compute — https://www.letta.com/blog/sleep-time-compute
- Letta Forum: Sleep-time Best Practices — https://forum.letta.com/t/sleeptime-agents-for-memory-consolidation-best-practices-guide/154
