---
name: agentic-design-patterns
type: reference
description: Apply agentic design patterns when designing AI agents, skills, or multi-agent systems. Reference for mapping patterns to IDE primitives.
---

# Agentic Design Patterns Skill

> **Purpose**: Verify agent/skill architecture follows established agentic design patterns.
> **Reference**: `~/toolkit/docs/agentic-design-patterns.md` — full pattern catalog with IDE mappings.
> **Invoked by**: architect, sparring, or any agent designing agent systems.

---

## When to Use

- Designing new agents, skills, or multi-agent workflows
- Reviewing existing agent architecture for missing patterns
- Mapping abstract patterns to concrete IDE primitives
- Evaluating whether a task needs a skill, subagent, or hook

## When NOT to Use

- Implementing application code (use executor, architect skills)
- Reviewing code quality (use pr-reviewer, testing skills)
- One-off prompt writing without reusable structure

---

## Process

1. **Read** `~/toolkit/docs/agentic-design-patterns.md` for the full pattern reference
2. **Check** the agent/skill against the detection rules below
3. **Apply** relevant patterns — wire the correct IDE primitives per target

---

## Detection Rules

| # | Detect | Severity | Pattern to Apply |
|---|--------|----------|------------------|
| 1 | Agent can execute destructive actions without validation gates | BLOCKER | Guardrails |
| 2 | Context lost between sessions, phases, or agent handoffs | BLOCKER | Handoffs |
| 3 | Agent produces output without a verification/self-review step | WARNING | Self-Correction |
| 4 | Complex task in a single prompt without intermediate outputs | WARNING | Prompt Chaining |
| 5 | Single agent handles all request types without dispatching | WARNING | Routing |
| 6 | Agent operates without loading relevant project context | WARNING | Knowledge Retrieval |
| 7 | Long-running workflow with no intermediate save points | WARNING | Checkpoints |
| 8 | Agent jumps to implementation without producing a plan | WARNING | Planning |
| 9 | Sequential processing of independent subtasks | SUGGESTION | Parallelization |
| 10 | Monolithic agent where specialized agents would perform better | SUGGESTION | Multi-Agent |
| 11 | Expensive model/tools used for simple tasks | SUGGESTION | Resource-Aware |

---

## Summary Template

```
### Agentic Design Patterns: {agent/skill name}
- **BLOCKERs**: {count} ({list of #s})
- **WARNINGs**: {count} ({list of #s})
- **SUGGESTIONs**: {count} ({list of #s})
- **Verdict**: {PASS — no blockers / FAIL — blockers found}
```
