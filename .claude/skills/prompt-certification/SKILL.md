---
name: prompt-certification
description: "Run certification checklists against agent or skill prompts. Detects contradictions, redundancy, filler, missing rationale, and structural issues. Binary pass/fail per check."
---

# Prompt Certification Skill

> **Purpose**: Evaluate any agent or skill prompt against the certification checklists in the principles doc.
> **Source of truth**: `~/toolkit/docs/prompt-engineering-principles.md`
> **Invoked by**: any agent, user directly

---

## Input

- Path to the prompt file to certify
- Type hint (optional): `agent` or `skill`. If not provided, detect from file location (`prompts/agents/` → agent, `prompts/skills/` → skill)

---

## Process

1. **Read** `~/toolkit/docs/prompt-engineering-principles.md` — load principles P1-P8, certification checklists (A1-A14, S1-S11), and anti-pattern reference
2. **Read** the target prompt file
3. **Detect type**: agent (run Agent Certification Checklist A1-A14) or skill (run Skill Certification Checklist S1-S11)
4. **Evaluate each check** using the detection patterns and evaluation rules below
5. **Self-check**: verify the evaluation is complete and consistent (see Self-Check section)
6. **Generate report** using the output format below

---

## Issue Detection Patterns

When evaluating a prompt, look for these specific patterns:

> **Detect:** Contradiction — same concept defined differently in two or more sections (e.g., section 2 says "always use X", section 7 says "X is optional"). **Severity:** FAIL. _(Violates P7)_

> **Detect:** Filler — sentence that does not change agent behavior if deleted (e.g., "Remember, quality is paramount", "Testing is the backbone of quality"). **Severity:** FAIL. _(Violates P2)_

> **Detect:** Missing rationale — hard rule stated without parenthetical explaining what problem it prevents (e.g., "Never approve with `any` types" without "_(Prevents: silent type errors)_"). **Severity:** FAIL. _(Violates A8)_

> **Detect:** Duplicated content — same concept, checklist, or table appears in 3+ places within the prompt, or content that exists in a referenced doc is restated inline. **Severity:** FAIL. _(Violates P4, P7)_

> **Detect:** Vague fix — issue recommendation uses "consider improving" or "this could be better" instead of a concrete action. **Severity:** FAIL. _(Violates S7)_

> **Detect:** Missing self-verification — prompt produces actionable output but has no explicit verification step before final delivery. **Severity:** FAIL. _(Violates P8, A14/S11)_

> **Detect:** CAPS misuse — CAPS used for emphasis in body text (e.g., "ALWAYS check", "NEVER skip") instead of only for severity labels (BLOCKER/WARNING/SUGGESTION). **Severity:** FAIL. _(Violates A5)_

> **Detect:** Prescriptive commands — exact shell commands or code snippets prescribed where intent-based instruction would suffice (except deterministic API calls like `gh pr view`). **Severity:** FAIL. _(Violates P6)_

---

## Evaluation Rules

For each check in the applicable checklist (A1-A14 or S1-S11), look for **concrete evidence** in the prompt text:

- **PASS**: The prompt satisfies the pass criteria. Cite the evidence (line range or quote).
- **FAIL**: The prompt violates the pass criteria. Cite the violation and which principle it breaks.

Be strict. Partial compliance is FAIL — the criteria are binary.

Do not invent hypothetical violations. Only flag what is actually present (or absent) in the text.

### Evaluation Examples

**Example — Contradiction (P7):**
Section 2 says: "always use factories for test data." Section 7 says: "factories are optional for small objects." Evidence: direct quotes from both sections. Result: FAIL on A2.

**Example — Filler (P2):**
Opening says: "You take pride in thorough, high-quality reviews." This sentence can be deleted without altering any instruction. Evidence: the sentence is motivational, not instructional. Result: FAIL on A11.

**Example — Missing fix (S7):**
Issue says: "consider improving test coverage." No concrete action specified. Evidence: "consider" is not an action. Fix must say what to do (e.g., "Add a test for the error path in handleSubmit"). Result: FAIL on S7.

### Edge Cases

- **Generative skills** (factories, builders): S1 applies to any methodology sections, not code review patterns. If the skill has no detection logic by design, note this as N/A with explanation.
- **Reference-type skills** (`type: reference` in frontmatter): Only checks S1, S4, S7, S8, S11 apply per the principles doc.
- **Skills with no code examples**: S2 passes automatically — absence of examples when none are needed is not a violation.
- **Skills that don't recommend file splitting**: S10 is N/A.

---

## Severity Reference

| Result | Definition | Certification Impact |
|--------|------------|---------------------|
| PASS | Prompt satisfies the criterion with cited evidence | No action needed |
| FAIL | Prompt violates the criterion with cited evidence | Blocks certification — requires fix |

BLOCKER-level failures (any single one blocks certification): A2 (contradictions), A14/S11 (missing self-verification), A9 (overlapping output sections).

---

## Self-Check

Before generating the report, verify:

1. Every check in the applicable checklist (A1-A14 or S1-S11) has a PASS or FAIL entry — no checks skipped
2. Every FAIL has: a cited violation (quote or line range), a principle reference (P1-P8), and a concrete fix
3. The verdict is consistent with individual results — any FAIL = NOT CERTIFIED
4. No evidence was fabricated — every quote exists in the actual prompt text
5. If any result seems borderline, re-read the relevant prompt section and the principle definition before finalizing

---

## Output Format

```markdown
# Certification Report: {filename}

**Type**: {Agent / Skill}
**Checklist**: {Agent Certification A1-A14 / Skill Certification S1-S11}
**Result**: {X}/{total} PASS

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| {id} | {check name} | PASS/FAIL | {brief evidence — line range or quote} |

## Failures Summary

### {id}: {check name}
- **Violation**: {what's wrong — cite the text}
- **Principle**: {P1-P8}
- **Fix**: {concrete action to pass the check}

## Verdict

{CERTIFIED — all checks pass / NOT CERTIFIED — N failures requiring fixes}
```

---

## Summary Template

For the invoking agent to include in its output:

```
### Prompt Certification: {filename}
- **Type**: {Agent / Skill}
- **Checklist**: {Agent A1-A14 / Skill S1-S11}
- **Result**: {X}/{total} PASS
- **Failures**: {list of failed check IDs, or "None"}
- **Top Issue**: {most impactful failure, or "N/A"}
- **Principles Violated**: {list of P1-P8 violated, or "None"}
- **Verdict**: {CERTIFIED / NOT CERTIFIED}
- **Fix Priority**: {ordered list of fixes by impact, or "N/A"}
```
