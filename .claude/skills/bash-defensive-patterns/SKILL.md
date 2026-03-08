---
name: bash-defensive-patterns
type: reference
description: Apply defensive Bash programming patterns for production-grade scripts. Use when writing robust shell scripts, CI/CD pipelines, or system utilities.
---

# Bash Defensive Patterns Skill

> **Purpose**: Ensure Bash scripts follow defensive programming patterns for production safety.
> **Reference**: `~/toolkit/docs/bash-defensive-patterns.md` — full pattern catalog with code examples.
> **Invoked by**: Any agent writing or reviewing shell scripts.

---

## When to Use

- Writing new Bash scripts (CI/CD, automation, deployment)
- Reviewing existing scripts for safety issues
- Modifying scripts that run in production or shared environments

## When NOT to Use

- One-liner terminal commands
- Scripts in other languages (Python, Node, etc.)

---

## Process

1. **Read** `~/toolkit/docs/bash-defensive-patterns.md` for the full pattern reference
2. **Check** the script against the detection rules below
3. **Apply** relevant patterns from the reference doc

---

## Detection Rules

| # | Detect | Severity | Pattern to Apply |
|---|--------|----------|------------------|
| 1 | Script missing `set -Eeuo pipefail` | BLOCKER | Strict Mode |
| 2 | Unquoted variables (`$var` instead of `"$var"`) | WARNING | Variable Safety |
| 3 | No `trap` for cleanup on exit/error | WARNING | Error Trapping |
| 4 | Using `[ ]` instead of `[[ ]]` in Bash scripts | SUGGESTION | Conditional Safety |
| 5 | `which` instead of `command -v` | SUGGESTION | Dependency Checking |
| 6 | No argument validation or usage function | WARNING | Argument Parsing |
| 7 | Temporary files without cleanup trap | BLOCKER | Safe Temp Files |
| 8 | `echo` for logging instead of structured functions | SUGGESTION | Structured Logging |
| 9 | No idempotency guards (file/dir existence checks) | WARNING | Idempotent Design |
| 10 | Background processes without signal handling | WARNING | Process Orchestration |

---

## Summary Template

```
### Bash Defensive Patterns: {filename}
- **BLOCKERs**: {count} ({list of #s})
- **WARNINGs**: {count} ({list of #s})
- **SUGGESTIONs**: {count} ({list of #s})
- **Verdict**: {PASS — no blockers / FAIL — blockers found}
```
