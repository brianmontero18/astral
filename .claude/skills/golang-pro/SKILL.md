---
name: golang-pro
type: external
description: Go development skill for modern Go 1.21+ projects. Confirms constraints, applies modern patterns, includes tests and benchmarks.
metadata:
  model: opus
---

# Go Pro Skill

> **Purpose**: Ensure Go code follows modern patterns, is well-tested, and production-ready.
> **Invoked by**: Any agent working on Go codebases.

---

## When to Use

- Building or modifying Go services, CLIs, or libraries
- Reviewing Go architecture decisions
- Optimizing Go performance (concurrency, memory, latency)

## When NOT to Use

- Non-Go codebases
- Basic Go syntax questions the model already knows

---

## Process

1. **Confirm constraints** — Go version, module path, existing patterns in the repo, build/deploy requirements
2. **Follow project conventions** — match existing code style, error handling patterns, and package structure before introducing anything new
3. **Prefer modern patterns** — generics over interface{}, slog over log, errors.Is/As over string matching, context propagation
4. **Include tests** — table-driven tests for logic, benchmarks for performance-sensitive code
5. **Verify concurrency safety** — check for races, proper context cancellation, goroutine lifecycle management

---

## Rules

1. **Match the repo's existing patterns first.** Only introduce new patterns when the existing ones are demonstrably insufficient. _(Prevents: inconsistent codebase)_
2. **Every exported function gets a test.** Table-driven preferred. _(Prevents: untested surface area)_
3. **No `interface{}` when generics are available** (Go 1.18+). _(Prevents: type safety gaps)_
4. **Explicit error handling** — no `panic/recover` for control flow, no silently ignored errors. _(Prevents: hidden failure paths)_
5. **Benchmark before optimizing.** Measure with `go test -bench`, don't guess. _(Prevents: premature optimization)_
