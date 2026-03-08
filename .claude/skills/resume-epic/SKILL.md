---
name: resume-epic
description: "Resume an epic — read all context, find next task, present briefing, confirm before starting."
argument-hint: "<epic-id> — the epic to resume"
---

# Resume Epic

> **Purpose**: Reconstruct full context of an epic so you can continue working as if you'd been on it the whole time.
> **When**: User says "retomá esta épica", "continue with X", or you need to pick up an epic.

Before answering, **read**: `~/toolkit/AGENTS.md` (Epic Context Convention + Landing the Plane)

---

## Process

### 1. Load epic context

```bash
bd show <epic-id>          # Read description (stable) + notes (evolving regional context)
bd children <epic-id>      # List all tasks with status
```

Extract from the epic:
- **Objective**: what this epic achieves
- **Current state**: from the notes — latest decisions, plan changes, constraints
- **Progress**: X/Y tasks closed

### 2. Find the right task

Determine what to work on next:

1. **In-progress task?** → `bd list --status=in_progress --parent <epic-id>` — if one exists, that's where we left off
2. **Ready task?** → `bd ready --parent <epic-id>` — unblocked tasks available to start
3. **All blocked?** → Report blockers and ask the user what to unblock

### 3. Read handoff chain

For context continuity, read the handoffs from recently closed tasks:

```bash
# Show the last 2-3 closed tasks to understand what happened before
bd children <epic-id> --json
# For each recently closed task, check its notes for HANDOFF:
bd show <closed-task-id>
```

Extract from handoffs:
- What was done in each
- What changed vs. the original plan
- What the next agent (you) needs to know

### 4. If resuming an in-progress task

The task was left mid-work by a previous session. Read its notes carefully:

```bash
bd show <task-id>    # Description + notes + dependencies
```

Check:
- Does it have partial HANDOFF notes?
- Are there uncommitted changes? (`git status`)
- Is the current branch related to this work?

### 5. Present briefing

Present a structured summary to the user:

```
## Epic Resume: <epic-id>

**Objective**: <from description>
**Progress**: X/Y tasks (Z%)
**Latest context**: <from notes — most recent entries>

### What happened last
<summary of recent handoffs>

### Next task
<task-id>: <title>
<task description>
<what the handoff says you need to know>

### Ready to start?
Confirmo que retomo <task-id>? Algo cambió que deba saber?
```

### 6. Wait for confirmation

Do NOT start working until the user confirms. They may:
- Correct the context ("actually, we changed direction")
- Choose a different task
- Add constraints you don't know about

---

## Rules

- **Never skip the briefing**. Even if you think you know the context, present it.
- **Never start coding before confirmation**. The user must say "go" or equivalent.
- **If the epic has no notes**: flag this — "This epic has no regional context. Should I read the description and infer, or do you want to set the context first?"
- **If there's no handoff on closed tasks**: flag this — "The last N tasks were closed without handoff. I'm working with limited context."
