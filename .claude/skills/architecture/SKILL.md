---
name: architecture
description: Verify file structure and imports follow Manos project patterns. Use when reviewing PRs, checking file locations, or validating feature encapsulation.
---

# Architecture Skill

> **Purpose**: Verify that file structure and imports follow Manos project patterns.
> **Source of truth**: `~/toolkit/templates/rules/architecture/RULE.md`
> **Invoked by**: pr-reviewer, executor, any agent/skill

---

## Input

List of files from the PR with their full paths.

---

## Checklist

### 1. File Location

> **Detect:** Files placed outside their expected directory. **Severity:** Tests outside `__tests__/` = BLOCKER. Other misplacements = WARNING.

| File type | Expected location |
|-----------|-------------------|
| Tests | `feature/__tests__/` |
| Hooks | `feature/hooks/` |
| Types | `feature/types/` |
| UI Components | `feature/ui-components/` |
| Feature-specific utils | `feature/utils/` |
| Shared utils | `app/utils/` |
| Shared components | `app/components/` |

---

### 2. Feature Encapsulation

> **Detect:** Imports reaching into the internal paths of another feature (e.g., `../../features/{other}/ui-components/`). **Severity:** BLOCKER.

```typescript
// BAD — import from internal path
import { ActiveTabs } from '../../features/fintech-boards/ui-components/ActiveTabs';

// GOOD — import from feature's public index
import { ActiveTabs } from '../../features/fintech-boards';
```

The `no-restricted-imports` ESLint rule enforces this at lint time. This rule flags any import that reaches into a feature's subdirectories (hooks/, ui-components/, utils/, types/) from outside that feature. The skill catches it during review for files not yet linted.

---

### 3. File Size

> **Detect:** Components or hooks exceeding size guidelines. **Severity:** WARNING (warrants scrutiny, not automatic blocking).

| File type | Guideline | When exceeded |
|-----------|-----------|---------------|
| Components | ~400 lines | Assess whether extracting hooks or splitting into sub-components would improve clarity |
| Hooks | ~200 lines | Assess whether extracting utility functions or splitting responsibilities would help |

**How to split components**: Extract by responsibility boundary. A component handling data fetching + rendering + filtering can split into: a data hook (`useFeatureData`), a filter hook (`useFeatureFilters`), and a presentation component. Each resulting file should have one clear responsibility.

**How to split hooks**: Extract pure transformation logic into utility functions in `feature/utils/`. Split hooks that manage multiple independent concerns into separate hooks in `feature/hooks/`.

**Where extracted files go**: Hooks → `feature/hooks/`. Utils → `feature/utils/`. Sub-components → `feature/ui-components/`. Shared artifacts (used by 2+ features) → `app/hooks/`, `app/utils/`, `app/components/`.

---

### 4. Duplicate Detection

> **Detect:** New code that duplicates existing helpers, utils, or components in the codebase. **Severity:** Exact duplicate = BLOCKER. Similar functionality that could be reused = WARNING.

Before flagging new code, search the codebase for existing implementations:
- Search `app/utils/`, `app/common/`, `app/lib/` for functions with similar names or similar transformations
- Search `app/components/` and all feature directories for components with similar rendering purpose
- Search by purpose, not just name — a `formatDate` might duplicate an existing `toLocalDate`

---

### 5. Nordic Pages (Routing)

> **Detect:** Business logic, state management, or data fetching inside `app/nordic-pages/`. **Severity:** BLOCKER.

Nordic pages are routing entry points. They render the View component and nothing else.

```typescript
// BAD — logic in nordic page
export default function RisksOpsPage() {
  const [data, setData] = useState([]);
  useEffect(() => { fetchData() }, []);
  return <div>{/* ... */}</div>;
}

// GOOD — nordic page just renders view
export default function RisksOpsPage() {
  return <RisksAndOpsView />;
}
```

---

### 6. Promotion Candidates

> **Detect:** Components, hooks, or utils used by 2+ features that still live inside a single feature's directory. **Severity:** SUGGESTION.

| Condition | Action |
|-----------|--------|
| Component used in 2+ features | Promote to `app/components/` |
| Hook used in 2+ features | Promote to `app/hooks/` |
| Util used in 2+ features | Promote to `app/utils/` |

To detect cross-feature usage: check the import graph of the file. If files from a different feature directory import it, it's a promotion candidate.

---

## Severity Reference

| Severity | Criteria |
|----------|----------|
| **BLOCKER** | Import from internal path of another feature; logic in nordic-page; tests outside `__tests__/`; exact code duplicate |
| **WARNING** | File in wrong location; component exceeding ~400 lines; hook exceeding ~200 lines; similar functionality that could be reused |
| **SUGGESTION** | Promotion candidate (used by 2+ features); possible near-duplicate worth investigating |

---

## Output Format

For each issue found:

```markdown
### {SEVERITY} [Architecture] {title}

- **File**: `path/to/file.ts`
- **Problem**: {description — what's wrong and why}
- **Rule**: See `architecture/RULE.md` — {section}
- **Fix**: {correct location or concrete action}
```

For duplicate detection:

```markdown
### BLOCKER [Architecture] Duplicate code detected

- **New**: `app/pages/fintech/risks/utils/formatDate.ts`
- **Existing**: `app/utils/dates.ts:formatDate()`
- **Evidence**: {show they do the same thing}
- **Fix**: Delete new file, import from `app/utils/dates.ts`
```

---

## Architecture Summary

When finished, produce this summary for the invoking agent:

```
### Architecture Summary

1. **File locations**: {All correct / {count} files misplaced}
2. **Feature encapsulation**: {Clean / {count} cross-feature internal imports}
3. **File sizes**: {Within guidelines / {count} files exceeding guidelines}
4. **Duplicates**: {None detected / {count} duplicates found}
5. **Nordic pages**: {Clean / {count} pages with logic}
6. **Promotion candidates**: {None / {count} candidates for shared promotion}
```
