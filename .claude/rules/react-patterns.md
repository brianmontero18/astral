---
description: React patterns: hooks, state management, effects, memoization
paths:
  - "**/*.{ts,tsx}"
---


# React Patterns

## State Decision

| Source | Tool | Example |
|--------|------|---------|
| Server/API | TanStack Query | API responses, paginated data |
| Client, shared | Zustand | Filters, tabs, user preferences |
| Client, local | `useState` | Form inputs, toggles, local UI |

## TanStack Query — NOT useState for Server Data

```typescript
// ✅ Use TanStack Query for ALL API data
const { data, isLoading } = useQuery({
  queryKey: ['resource', filters],
  queryFn: () => bffApiClient.get('/endpoint').then(r => r.data),
});
```

Never manually fetch with `useState` + `useEffect`. TanStack Query handles caching, dedup, and background refetch.

## useEffect: When YES, When NO

**YES**: subscriptions, external system sync, cleanup
**NO**: fetching data (→ TanStack Query), transforming data (→ `useMemo`), handling events (→ event handlers), resetting state on prop change (→ `key` prop)

## Dependency Arrays

**NEVER** disable ESLint `react-hooks/exhaustive-deps`. If you feel the need, you have a design problem — extract with `useCallback`, move logic out, or use a ref.

## Zustand Selection Pattern

```typescript
// ✅ Select only what you need (avoids unnecessary re-renders)
const filters = useFiltersStore((state) => state.filters);

// ❌ Selecting entire store
const store = useFiltersStore();
```

Never put server data in Zustand — that's TanStack Query's job. Never store derived data — compute with `useMemo`.

## File Size Limit

Components **< 400 lines**. If larger: extract custom hooks, split into smaller components, move utils out.

## Component Declaration Order

Organize declarations within functional components in this order:

| Order | What | Why |
|-------|------|-----|
| 1 | `useState` declarations | Defines component shape — always first |
| 2 | Server state hooks (`useQuery`, `useMutation`, custom Query wrappers) | May depend on state values (e.g., `site: selectedSite`) |
| 3 | Derived values from hooks | Computed from hook results, not handlers (e.g., `const isFreezeDisabled = !data?.hasData`) |
| 4 | `useCallback` handlers | Stable references needed in dependency arrays or memoized children |
| 5 | Simple event handlers | User interaction flow order: open → accept → edit → delete → toggle |
| 6 | Pre-render constants | Values computed only for JSX — go just before `return` |
| 7 | JSX `return` | Render |

**Anti-patterns:**
- Interleaving `useState` with data hooks or handlers
- Declaring `useCallback` far from its consumer without a dependency reason
- Mixing derived values between handler blocks

## Memoization

- **DO**: expensive calculations, objects/arrays passed as props to memoized children, callbacks passed to children
- **DON'T**: primitive values, simple calculations, "just in case"
