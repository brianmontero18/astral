---
name: context-loader
description: Load and structure relevant context artifacts (specs, Jira tickets, PRs, docs) to provide PURPOSE for exploration or review.
---

# Context Loader Skill

> **Purpose**: Gather all relevant context artifacts before exploration or review. Provides the "WHY" and "WHAT" for subsequent actions.
> **Invoked by**: `explorer`, `pr-reviewer`, `architect`, any agent/skill needing context
> **Philosophy**: "Understand the purpose before exploring the code."

---

## Why This Skill Exists

Exploration without purpose is random wandering. This skill ensures that before we explore code, we understand:

1. **WHY** are we exploring? (the problem/goal)
2. **WHAT** context already exists? (specs, tickets, PRs, docs)
3. **WHO** is involved? (author, reviewers, stakeholders)

---

## Input Types (auto-detected)

The skill accepts various input types and auto-detects what to fetch:

| Input Pattern | Detected As | Action |
|---------------|-------------|--------|
| `FPFX-XXX` | Jira ticket | Fetch from Jira API |
| `#123` or `PR #123` | GitHub PR | Fetch with `gh pr view` |
| `https://github.com/.../pull/123` | GitHub PR URL | Extract PR number, fetch |
| `https://mercadolibre.atlassian.net/browse/FPFX-XXX` | Jira URL | Extract ticket, fetch |
| `~/specs/.../FEATURE.md` | Spec file path | Read file |
| `~/specs/.../*.spec.md` | Slice spec path | Read file + parent FEATURE.md |
| Free text | Problem description | Use as-is |

---

## What It Loads (by input type)

### For Jira Ticket (FPFX-XXX)

```
1. Fetch ticket from Jira:
   - Title
   - Description
   - Status
   - Assignee
   - Epic Link (if any)
   - Comments (last 5)

2. Search for related spec in toolkit:
   - ~/specs/manos/**/FPFX-XXX/*.spec.md
   - ~/specs/manos/**/FEATURE.md (parent epic)

3. Search for related PR (if any):
   - gh pr list --search "FPFX-XXX"
```

### For GitHub PR (#123)

```
1. Fetch PR info:
   gh pr view {number} --json title,body,author,state,files,additions,deletions,comments,reviews

2. Fetch PR comments:
   gh api repos/{owner}/{repo}/pulls/{number}/comments

3. Fetch GenAI review (if exists):
   - Look for comments from bots (github-actions, genai-bot, etc.)
   - Or reviews with specific patterns

4. Extract ticket from PR title/branch:
   - Pattern: FPFX-XXX in title or branch name
   - If found → also load Jira ticket

5. Search for related spec:
   - Use extracted ticket ID to find spec
```

### For Spec Path

```
1. Read the spec file

2. If it's a slice spec ({TICKET}.spec.md):
   - Also read parent FEATURE.md
   - Extract ticket ID → optionally load Jira

3. If it's FEATURE.md:
   - List all slices in the folder
   - Read their status
```

---

## Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT LOADER PROCESS                        │
└─────────────────────────────────────────────────────────────────┘

STEP 1: DETECT INPUT TYPE
         │
         ├── Jira ticket? → STEP 2A
         ├── GitHub PR? → STEP 2B
         ├── Spec path? → STEP 2C
         └── Free text? → STEP 2D

STEP 2A: LOAD JIRA CONTEXT
         │
         ├── Fetch ticket details
         ├── Get epic info (if linked)
         ├── Get comments (last 5)
         ├── Search for spec in toolkit
         └── Search for related PR

STEP 2B: LOAD PR CONTEXT
         │
         ├── Fetch PR details (gh pr view)
         ├── Fetch comments
         ├── Fetch reviews (including GenAI)
         ├── Extract ticket ID from title/branch
         ├── If ticket found → also load Jira context
         └── Search for spec in toolkit

STEP 2C: LOAD SPEC CONTEXT
         │
         ├── Read spec file
         ├── If slice → read parent FEATURE.md
         ├── Extract ticket ID
         └── Optionally load Jira context

STEP 2D: FREE TEXT
         │
         └── Use as problem description

STEP 3: STRUCTURE OUTPUT
         │
         └── Consolidate all found artifacts
```

---

## Commands Used

### Jira (via MCP or direct)

```bash
# If using Jira MCP
mcp_mcp-atlassian_jira_get_issue --issue_key "FPFX-XXX"

# Or via toolkit script
~/toolkit/scripts/mcp-toggle.sh jira on
```

### GitHub

```bash
# PR details
gh pr view {number} --json title,body,author,state,files,additions,deletions,comments,reviews

# PR comments (API for more detail)
gh api repos/{owner}/{repo}/pulls/{number}/comments

# Search PR by ticket
gh pr list --search "FPFX-XXX" --json number,title,state
```

### Local Specs

```bash
# Find spec by ticket
find ~/specs -name "*FPFX-XXX*" -type f

# Find FEATURE.md in same epic
# If spec is at ~/specs/manos/Epic/slices/FPFX-XXX/
# Then FEATURE.md is at ~/specs/manos/Epic/FEATURE.md
```

---

## Output Format (MANDATORY)

```markdown
# Context Loaded

**Input**: {original input}
**Detected type**: {Jira ticket / PR / Spec / Description}
**Load timestamp**: {timestamp}

---

## 🎫 Jira Ticket (if found)

**ID**: FPFX-XXX
**Title**: {title}
**Status**: {status}
**Assignee**: {assignee}
**Epic**: {epic name and ID, if linked}

### Description
{summarized description - max 500 chars}

### Recent Comments
- **{author}** ({date}): {summary}
- ...

---

## 📄 Spec (if found)

**Path**: {path to spec}
**Type**: {FEATURE.md / slice spec}

### Summary
{key points from spec - max 500 chars}

### Acceptance Criteria (if slice spec)
- {criterion 1}
- {criterion 2}
- ...

---

## 🔀 Pull Request (if found)

**PR**: #{number} - {title}
**Author**: {author}
**State**: {open/closed/merged}
**Files changed**: {count}

### Description
{summarized PR description - max 500 chars}

### Comments ({count})
- **{author}**: {summary}
- ...

### GenAI Review (if exists)
{summary of GenAI findings}

### Reviews
- **{reviewer}** ({status}): {summary}
- ...

---

## 🎯 Synthesized Purpose

Based on loaded context:

**Problem**: {1 sentence summary of what we're trying to solve}
**Goal**: {what success looks like}
**Key constraints**: {from spec or ticket}
**Related areas**: {modules/features mentioned}

---

## ⚠️ Missing Context

{List anything that was expected but not found}

- [ ] Spec not found in toolkit
- [ ] No PR linked to this ticket
- [ ] Jira ticket has no description
- [ ] etc.
```

---

## Handling Missing Artifacts

When an artifact is not found, **don't fail**. Document it and continue:

```markdown
## 📄 Spec

**Status**: ❌ Not found
**Searched**: ~/specs/manos/**/FPFX-XXX/
**Action needed**: Consider creating spec before proceeding
```

---

## Integration with Other Skills/Agents

### With codebase-explorer-skill

```
context-loader-skill output
         │
         ▼
codebase-explorer-skill input:
  - Entry point: {derived from context}
  - Context: {full context-loader output}
  - Purpose: {synthesized from context}
```

### With pr-reviewer-agent

```
PR number
    │
    ▼
context-loader-skill
    │
    ├── PR details + comments + GenAI review
    ├── Related spec (if found)
    └── Related Jira ticket (if found)
    │
    ▼
Full context for review
```

### With explorer-agent

```
Jira ticket or problem description
    │
    ▼
context-loader-skill
    │
    ├── Ticket details
    ├── Epic context (FEATURE.md)
    └── Existing spec (if any)
    │
    ▼
Informed exploration with purpose
```

---

## Rules

1. **NEVER fail on missing artifact** - Document and continue
2. **ALWAYS summarize** - Don't dump full content, summarize to save tokens
3. **ALWAYS synthesize purpose** - The "Synthesized Purpose" section is mandatory
4. **DETECT related artifacts** - If loading PR, also try to find ticket; if loading ticket, also try to find spec
5. **RESPECT token budget** - Summaries should be <500 chars each
6. **INDICATE what's missing** - Help the user know what context is incomplete
