---
name: testing
description: Verify test QUALITY deeply — factories, mock reuse, test accuracy, Kent C. Dodds alignment, organization, DRY. Not just "do tests exist" but "are tests GOOD".
---

# Testing Skill v2

> **Purpose**: Verify that tests are high quality, not just present. LLM-generated tests typically have: hardcoded objects repeated across tests, duplicated mocks between files, names that don't reflect what the test verifies, and tests that check implementation instead of behavior.
> **Source of truth**: `~/toolkit/templates/rules/testing/RULE.md`
> **Invoked by**: pr-reviewer, executor, any agent/skill

---

## Input

- Test files (`*.spec.ts`, `*.spec.tsx`, `*.test.ts`, `*.test.tsx`) from the PR
- Source files that should have tests but don't
- Other test files in the same feature (for mock duplication detection)

---

## Checklist

### 1. Test Location

| Incorrect | Correct |
|-----------|---------|
| Tests at project root | Tests in feature's `__tests__/` |
| Tests mixed with source | Separate `__tests__/` directory |
| Tests from one feature in another's `__tests__/` | Each feature owns its tests |

Expected structure:
```
feature-dir/
├── __tests__/
│   ├── fixtures/          ← shared test objects
│   ├── mocks/             ← shared mock implementations
│   ├── useFeatureHook.spec.ts
│   └── FeatureView.spec.tsx
├── hooks/
└── FeatureView.tsx
```

---

### 2. Test Factories & Fixtures

> **Detect:** Objects with 5+ fields hardcoded in multiple tests. **Severity:** 5+ fields in 2+ tests = WARNING. 10+ fields in 3+ tests, or repeated across files = BLOCKER.

```typescript
// BAD — heavy object repeated per test (common in LLM-generated code)
test('displays risks', () => {
  const data = [{ id: '1', name: 'Risk A', type: 'Risk', site: 'MLM',
    status: 'open', priority: 'high', assignee: 'user1', /* ...more */ }];
});
test('filters by site', () => {
  const data = [{ id: '2', name: 'Risk B', type: 'Risk', site: 'MLA',
    status: 'open', priority: 'high', assignee: 'user1', /* ...same shape */ }];
});

// GOOD — factory with smart defaults (__tests__/fixtures/risk-record.fixture.ts)
let counter = 0;
export const createMockRisk = (overrides?: Partial<RiskRecord>): RiskRecord => ({
  id: `risk-${++counter}`, name: `Risk ${counter}`, type: 'Risk',
  site: 'MLM', status: 'open', priority: 'medium', ...defaults,
  ...overrides,
});
// Usage: const risks = [createMockRisk({ site: 'MLM' }), createMockRisk({ site: 'MLA' })];
```

When multiple test files in the same feature use similar data, the factory should live in `__tests__/fixtures/` as a shared file.

---

### 3. Mock Duplication Detection

> **Detect:** Same `jest.mock()` call appearing in 2+ test files of the same feature. **Severity:** 2 files = WARNING. 3+ files = BLOCKER.

```typescript
// BAD — same mock duplicated across 3 test files
// useFeature.spec.ts, FeatureView.spec.tsx, FeatureTable.spec.tsx all have:
jest.mock('@app-lib/bffApiClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
```

**Correct pattern — share mock implementations, keep `jest.mock()` at top level:**

`jest.mock()` is hoisted by babel-jest to the top of the file at compile time. Wrapping it inside a helper function and calling that function does **not** work reliably — the hoisting moves the call to the wrong scope and fails silently.

Instead, share the mock **implementation objects** and keep `jest.mock()` at the top level of each test file:

```typescript
// __tests__/mocks/api-client.ts — shared implementation (NO jest.mock here)
export const mockBffApiClient = {
  __esModule: true as const,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
};

// In each test file — jest.mock stays top-level, imports shared implementation
import { mockBffApiClient } from './mocks/api-client';
jest.mock('@app-lib/bffApiClient', () => mockBffApiClient);
```

Alternative approaches:
- **`__mocks__/` directory**: Place manual mocks adjacent to the module. Jest picks them up automatically.
- **`setupFiles` in jest.config**: For mocks needed by every test file (e.g., logger, analytics).

---

### 4. Test Name vs. Actual Behavior

> **Detect:** Test name promises to verify X, but assertions verify Y or nothing. **Severity:** Name partially misleading = WARNING. Name and assertions completely unrelated, or test has no meaningful assertion = BLOCKER.

```typescript
// BAD — name says "displays error" but never checks error rendering
test('displays error when API fails', () => {
  getMock.mockRejectedValueOnce(new Error('fail'));
  renderHook(() => useFeature());
  // no assertion about error display
});

// GOOD — name and body match
test('displays error message when API fails', async () => {
  getMock.mockRejectedValueOnce(new Error('fail'));
  render(<FeatureView />);
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(/error/i);
  });
});
```

**Process**: For each test, read the name, read the body, verify the assertions prove what the name claims.

---

### 5. Kent C. Dodds Alignment

> **Detect:** Tests that check implementation details instead of user-visible behavior, use low-level queries when better alternatives exist, or use fireEvent instead of userEvent. **Severity:** Implementation detail testing or `container.querySelector` = BLOCKER. `getByTestId` when `getByRole` works, or `fireEvent` instead of `userEvent` = WARNING.

**Level 1 — What is tested:**

| Prohibited (implementation detail) | Correct (user behavior) |
|------------------------------------|-------------------------|
| `expect(setState).toHaveBeenCalledWith(...)` | `expect(screen.getByText('New value')).toBeInTheDocument()` |
| `expect(component.state.isOpen).toBe(true)` | `expect(screen.getByRole('dialog')).toBeVisible()` |
| `expect(hookResult.current.internalCount).toBe(5)` | `expect(screen.getByText('5 items')).toBeInTheDocument()` |
| `expect(useEffect).toHaveBeenCalled()` | Verify the visible effect of the side effect |
| Testing unexported private functions directly | Test the component that uses them |

**Level 2 — How interactions are triggered:**

| Avoid | Prefer |
|-------|--------|
| `fireEvent.click(button)` | `await user.click(button)` (userEvent) |
| `fireEvent.change(input, { target: { value: 'x' } })` | `await user.type(input, 'x')` |

**Level 3 — How elements are selected (query priority):**

| Priority | Query | When to use |
|----------|-------|-------------|
| 1 (best) | `getByRole` | Always when possible — reflects accessibility |
| 2 | `getByLabelText` | Form inputs with visible label |
| 3 | `getByText` | Visible content |
| 4 | `getByDisplayValue` | Inputs with current value |
| 5 (avoid) | `getByTestId` | Only if no other option exists |

---

### 6. Test Organization

> **Detect:** Flat test files without describe nesting, or repeated setup across tests. **Severity:** 5+ tests without any describe = WARNING. Same setup (3+ lines) in 3+ tests = WARNING, in 5+ tests = BLOCKER.

```typescript
// BAD — flat, no organization
test('renders component', () => { ... });
test('calls API', () => { ... });
test('shows error', () => { ... });

// GOOD — organized by scenario
describe('FeatureView', () => {
  describe('when data loads successfully', () => {
    beforeEach(() => { /* shared setup */ });
    test('renders the table', () => { ... });
    test('displays correct count', () => { ... });
  });
  describe('when API returns error', () => {
    test('displays error message', () => { ... });
  });
});
```

**Splitting large test files (300+ lines):** Split by top-level describe block. Each resulting file covers one component behavior area (e.g., `FeatureView.rendering.spec.tsx`, `FeatureView.filtering.spec.tsx`). Shared fixtures go to `__tests__/fixtures/`, shared mocks go to `__tests__/mocks/`.

---

### 7. Test DRY Analysis

> **Detect:** 3+ tests with identical structure differing only in data, or 2+ tests with identical assertions. **Severity:** `test.each` candidates = WARNING. Fully overlapping tests = WARNING. Tests adding zero new confidence = SUGGESTION.

```typescript
// BAD — identical tests with different data
test('formats USD', () => { expect(format(1000, 'USD')).toBe('$1,000.00'); });
test('formats ARS', () => { expect(format(1000, 'ARS')).toBe('$1.000,00'); });
test('formats BRL', () => { expect(format(1000, 'BRL')).toBe('R$1.000,00'); });

// GOOD — test.each
test.each([
  ['USD', '$1,000.00'], ['ARS', '$1.000,00'], ['BRL', 'R$1.000,00'],
])('formats %s correctly', (currency, expected) => {
  expect(format(1000, currency)).toBe(expected);
});
```

---

### 8. Async Testing

| Incorrect | Correct |
|-----------|---------|
| Waiting for `isLoading` | Waiting for final state |
| Multiple assertions inside `waitFor` | One assertion per `waitFor` |
| Not awaiting async changes | `waitFor` or `findBy*` |

---

### 9. Proper Mocking

| Incorrect | Correct |
|-----------|---------|
| Mocking React internals (`useState`, `useEffect`) | Mock only external dependencies |
| Global mock without cleanup | `jest.spyOn` with restore |
| Mocking internal implementation | Mock API/services at boundary |

---

### 10. Coverage Gaps

Verify the PR includes tests for:

| Change in PR | Expected test |
|--------------|---------------|
| New hook | Unit test of the hook |
| New util function | Unit test of the function |
| New component with logic | Behavior test |
| Bug fix | Test that reproduces the bug |
| Component with data fetching | Tests for: loading, success, error, empty states |

**Priority of scenarios to cover:**

| Scenario | Priority |
|----------|----------|
| Happy path | Required |
| Error state (API failure) | Required if data fetching exists |
| Empty state (data = []) | Required if data fetching exists |
| Loading state | Recommended |
| Null/undefined edge cases | Recommended |

---

### 11. Flaky Tests Anti-Patterns (FPFX-617)

> **Detect:** Patterns that cause OOM, timeouts, and worker exit failures in CI.

| Anti-Pattern | Fix | Severity |
|--------------|-----|----------|
| `await result.current.fn()` without `act()` | Wrap in `await act(async () => ...)` | BLOCKER |
| `await new Promise(r => setTimeout(r, 100))` | `jest.useFakeTimers()` + `advanceTimersByTimeAsync` | BLOCKER |
| `setTimeout()` in mocks without cleanup | Use `Promise.resolve().then()` | BLOCKER |
| `userEvent.setup()` at describe level | Move inside each test | BLOCKER |
| `setImmediate` in tests | `setTimeout(0)` (JSDOM compatible) | BLOCKER |
| `waitFor(() => isLoading === false)` | `waitFor(() => expect(data).toBe(expected))` | WARNING |
| Multiple expects in `waitFor` | Only the primary, rest outside | WARNING |
| Heavy components without mock (Image, etc.) | Mock to reduce memory | SUGGESTION |
| Test files >300 lines | Split by behavior (see Section 6) | WARNING |

---

## Severity Reference

| Severity | Criteria |
|----------|----------|
| **BLOCKER** | No tests for new code; mocking React internals; flaky anti-patterns (act, setTimeout, userEvent.setup scope, setImmediate); objects 10+ fields repeated in 3+ tests without factory; same mock in 3+ test files; test name completely mismatched with behavior; `container.querySelector` in tests; implementation detail testing (Level 1 violations) |
| **WARNING** | `getByTestId` when `getByRole` works; `fireEvent` instead of `userEvent`; redundant tests; test files >300 lines; partially misleading test names; 3+ tests as `test.each` candidates; 5+ tests without describe; setup repeated in 3+ tests; mock duplicated in 2 files; missing error/empty state tests; objects 5+ fields repeated in 2+ tests without factory |
| **SUGGESTION** | Could improve edge case coverage; mock heavy components; improve describe nesting; add boundary value tests |

---

## Output format

For each issue found:

```markdown
### {severity} [Testing] {title — WHAT is wrong}

- **File**: `path/to/__tests__/file.spec.tsx:{line}`
- **Problem**: {concrete description — not "could improve" but "this is wrong because..."}
- **Rule**: See `testing/RULE.md` — {section}
- **Fix**: {Concrete code or actionable instruction. Show BEFORE and AFTER when possible.}
```

---

## Test Quality Summary

When finished reviewing tests, produce this summary:

```
### Test Quality Summary

1. **Factories/fixtures**: {Uses factories / No — {count} heavy objects repeated}
2. **Mock duplication**: {Clean / {count} mocks duplicated between {files}}
3. **Test name accuracy**: {All match / {count} tests with misleading names}
4. **Kent C. Dodds alignment**: {Good / {count} implementation tests, {count} unnecessary getByTestId}
5. **Organization**: {Well organized / {problems}}
6. **DRY**: {Clean / {count} test.each candidates, {count} redundant tests}
7. **Edge cases**: {Complete / Missing: {loading/error/empty/...}}
8. **Flaky risks**: {None / {list of anti-patterns}}
```
