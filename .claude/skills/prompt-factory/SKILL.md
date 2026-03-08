---
name: prompt-factory
description: "Design and produce agent, skill, workflow, rule, hook, or tool definitions that comply with toolkit prompt engineering principles and IDE taxonomy. Use when creating new agentic artifacts."
argument-hint: "<type> <purpose> — type: agent|skill|workflow|rule|hook|tool. purpose: what it should do"
disable-model-invocation: true
---

# Prompt Factory

> **Purpose**: Produce new agentic artifacts that pass certification and follow toolkit conventions.
> **Source of truth**: `~/toolkit/docs/prompt-engineering-principles.md`, `~/toolkit/docs/agentic-ide-taxonomy.md`, `~/toolkit/docs/agentic-design-patterns.md`

---

## Input

- **Type** (required): `agent`, `skill`, `workflow`, `rule`, `hook`, or `tool`
- **Purpose**: What the artifact should do, its scope, and success criteria
- **Target IDE** (optional): `claude`, `cursor`, `codex`, `droid`, or `all`. Default: `claude`
- **Additional context**: Any reference files, constraints, or examples the user provides

---

## Process

### Phase 1 — Load references

Read these files before producing anything:

1. `~/toolkit/docs/prompt-engineering-principles.md` — principles P1-P8 + certification checklists (A1-A14, S1-S11)
2. `~/toolkit/docs/agentic-ide-taxonomy.md` — frontmatter fields, paths, conventions per IDE, 6-layer decision tree (§7)
3. `~/toolkit/docs/agentic-design-patterns.md` — patterns that may apply to the design

### Phase 2 — Classify and plan

Based on the requested type, determine:

| Type | Layer | Output format | Certification checklist |
|------|-------|---------------|------------------------|
| `agent` | D (Subagent) | `.md` with YAML frontmatter (name, description, model, tools) | A1-A14 |
| `skill` | B (Skill) | `SKILL.md` with YAML frontmatter (name, description, argument-hint) | S1-S11 |
| `workflow` | B+D combo | Orchestrator + specialized subagents (multiple files) | A1-A14 for orchestrator, S1-S11 for component skills |
| `rule` | A (Rule) | `.md` with YAML frontmatter (paths:) | P1-P8 applied informally |
| `hook` | E (Hook) | JSON config for settings.json + shell script if needed | Guardrails pattern (5.2) |
| `tool` | B (Skill) + Docs | **Two artifacts**: `docs/{tool}-manual.md` (dynamic doc) + `prompts/skills/{tool}-specialist/SKILL.md` (skill with refresh mode) | S1-S11 for skill |

For `workflow` type: use the 6-layer decision tree (taxonomy §7) to determine which parts are skills vs subagents. Identify parallelization opportunities (pattern 1.3) and chaining needs (pattern 1.1).

For `tool` type: the output is a **knowledge package** for an external tool or system. It produces two artifacts that work together — a dynamic documentation snapshot connected to live URLs, and a specialist skill that uses that documentation as its source of truth. See "Tool (knowledge package)" below for structure.

### Phase 3 — Design the artifact

Apply principles P1-P8 from the doc loaded in Phase 1. Key constraints:
- Every token in the output must be instruction — no filler (P2)
- Reference skills for detail, don't embed their content (P4)
- Start simple, only add phases when simpler solutions fail (P5)
- Tell WHAT to do, not exact commands except deterministic API calls (P6)

Structure by type:

**Agent** (subagent):
- Role statement: 2-3 lines. Role + scope + success criteria. No emotional language.
- Input contract: what data the orchestrator provides
- Phases: each with ONE distinct purpose
- Skill references: ≤15 lines per skill, detail lives in the skill
- Hard rules with rationale in parentheses _(Prevents: X)_
- Output template with no overlapping sections
- Self-verification step before final output

**Skill**:
- Opening: purpose + invoked-by + source of truth. Three lines max.
- Detection-first sections: `> **Detect:** X. **Severity:** Y.`
- Code examples: max 8 lines bad + 8 lines good per pattern
- ONE consolidated severity table at the end
- Summary template (8-10 lines) for invoking agent
- Self-check before summary

**Workflow** (orchestrator + components):
- Orchestrator as skill or agent depending on complexity
- Identify parallelizable subtasks (pattern 1.3)
- Define handoff format between components (pattern 4.2)
- Include checkpoints (pattern 5.1)
- Output EACH component in a separate fenced block with its file path. Orchestrator goes in `.claude/skills/` or `.claude/agents/` per complexity. Subagents go in `.claude/agents/`.

**Rule**:
- Conditional activation via `paths:` (Claude Code) or `globs:` (Cursor)
- Keep under 50 lines _(rules consume context always — see taxonomy §2.3 note)_
- For heavy rules, consider skill with `user-invocable: false` instead

**Hook**:
- Event + matcher + command/prompt
- Guardrails for destructive actions (pattern 5.2)
- Keep scripts idempotent

**Tool** (knowledge package):

A `tool` produces TWO artifacts that form a self-refreshing knowledge unit:

_Artifact 1 — Dynamic Documentation_ (`~/toolkit/docs/{tool}-manual.md`):
- Header: tool name, purpose, version/date of snapshot, related docs
- Sections: What it is, problem it solves, architecture/tech stack, setup (from real experience), API/CLI reference, use cases, known pain points, troubleshooting
- **Sources section** (mandatory): categorized URLs that are the live references for this snapshot. Categories: `Official Docs`, `GitHub` (repo, issues, discussions), `Community` (blogs, forums, tutorials, videos), `Related` (upstream models, dependencies)
- Each URL entry includes a short annotation of what it contains
- Follow the structure of existing tool docs: `letta-manual.md`, `beads-manual.md`

_Artifact 2 — Specialist Skill_ (`~/toolkit/prompts/skills/{tool}-specialist/SKILL.md`):
- Frontmatter: `name: {tool}-specialist`, `type: reference`, `description: ...`
- Reference to the dynamic doc as source of truth
- When to Use / When NOT to Use sections
- Process: read doc, verify against official sources, check detection rules, test
- Detection rules table (detect/severity/fix)
- Use cases with concrete examples relevant to the user's workflows
- **Refresh Mode section** (mandatory): step-by-step procedure to update the snapshot by visiting the URLs in the dynamic doc's Sources section, comparing content, and updating changed sections. Include a "Last refreshed" date field.
- Summary template for invoking agents
- Quick command reference (if the tool has CLI/API)

_Research phase_ (before writing either artifact): use WebSearch and FetchUrl to gather:
1. Official documentation and README
2. GitHub issues (open, recent, high-impact)
3. Community content (blog posts, tutorials, forum discussions)
4. Setup experience and real-world pain points
5. Upstream dependencies and compatibility notes

Existing examples to reference:
- `docs/letta-manual.md` + `prompts/skills/letta-specialist/SKILL.md`
- `docs/beads-manual.md` + `prompts/skills/beads-specialist/SKILL.md`

### Phase 4 — Produce the artifact

Output the complete artifact in a fenced code block with the file path as header.

Include the correct frontmatter for the target IDE (consult taxonomy loaded in Phase 1 for fields).

### Phase 5 — Self-verify

Before presenting, run the FULL applicable certification checklist from the principles doc loaded in Phase 1:

- **For agents**: Run ALL checks A1-A14
- **For skills**: Run ALL checks S1-S11
- **For workflows**: A1-A14 for orchestrator, S1-S11 for each component skill

Additionally verify:
- The artifact's scope matches the user's stated purpose
- All referenced documents from Phase 1 were consulted
- No content was duplicated from source docs (P4)

Report pass/fail count. If any check fails, fix the artifact and re-check before presenting.

---

## Severity Reference

| Certification Result | Definition | Action |
|---------------------|------------|--------|
| ALL PASS | Artifact satisfies every applicable checklist item | Ready to deploy |
| 1-2 FAIL (non-critical) | Minor structural issues that don't affect core behavior | Fix before deploying, note the gaps |
| 3+ FAIL or any BLOCKER-level | Structural or correctness issues that compromise the artifact | Redesign the failing sections before presenting |

BLOCKER-level failures: missing self-verification (A14/S11), internal contradictions (A2/P7), missing output template (A9).

---

## Summary Template

For the invoking agent to include in its output:

```
### Prompt Factory: {artifact-name}
- **Type**: {agent/skill/workflow/rule/hook/tool}
- **Target IDE**: {ide}
- **Certification**: {X}/{total} PASS
- **Failures**: {list of failed check IDs, or "None"}
- **Patterns applied**: {list of agentic design patterns used}
- **File path**: {suggested path}
- **Dependencies**: {skills, docs, or MCP servers needed}
- **Status**: {READY / NEEDS_FIXES — list failures}
```
