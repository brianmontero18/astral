---
description: Architecture patterns: feature structure, imports, component organization
paths:
  - "**/*.{ts,tsx}"
---


# Architecture Patterns

## Feature Structure

Each feature in `app/pages/{vertical}/{feature}/` is self-contained:

```
feature/
├── __tests__/         # Tests
├── hooks/             # TanStack Query + logic
├── types/             # TypeScript types
├── ui-components/     # Feature-specific UI
├── utils/             # Feature-specific utils
└── FeatureView.tsx    # Main view
```

## Import Rules

- **Public API**: import from feature's `index.ts` (e.g., `from '../../features/fintech-boards'`)
- **FORBIDDEN**: import from internal paths (`/ui-components/Foo`, `/api/get-bar`). ESLint `no-restricted-imports` enforces this.

## Where to Put Things

### Types
| Scope | Location |
|-------|----------|
| Feature-specific | `feature/types/index.ts` |
| Shared across features | `app/types/index.ts` |
| API response types | Co-located with the hook |

### Constants
| Scope | Location |
|-------|----------|
| Feature-specific | `feature/constants.ts` |
| Shared | `app/common/constants.ts` |

### Helpers
| Scope | Location |
|-------|----------|
| Feature-specific | `feature/utils/` |
| Shared formatting | `app/utils/` |
| API clients | `app/lib/` |

Check if a shared util exists before creating a new one.

## Promotion Rule

Component used in **2+ features** → move to `app/components/`.

## Nordic Pages

`app/nordic-pages/` handles **ONLY routing** — no business logic. Import and render the view component.
