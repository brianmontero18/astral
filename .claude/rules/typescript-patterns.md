---
description: TypeScript patterns: strict typing, no any, interfaces vs types
paths:
  - "**/*.{ts,tsx}"
---


# TypeScript Patterns

## NO `any` — Ever

Use `unknown` for truly unknown types, then narrow.

```typescript
// ❌ FORBIDDEN
const data: any = response.data;

// ✅ Type it or use unknown + narrowing
const data: ApiResponse = response.data;
function handleError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

## Interface vs Type

- **interface** for object shapes (extendable via `extends`)
- **type** for unions, intersections, primitives (`type Status = 'pending' | 'active'`)

## Function Typing

Always type parameters and return values. Never leave params untyped.

## Props Typing

Define a named `interface FooProps` — never inline `{ children: any; variant: string }`.

## Avoid Type Assertions (`as`)

Prefer type narrowing (`instanceof`, type guards) over `as` casts. Assertions hide bugs.

## Strict Null Checks

- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Prefer early returns over deep nesting when values may be null
