---
description: Testing patterns: RTL best practices, Kent C. Dodds philosophy, test structure
paths:
  - "**/*.{spec,test}.{ts,tsx}"
---


# Testing Patterns

> "Write tests. Not too many. Mostly integration." — Kent C. Dodds

## Philosophy

Test **behavior**, not implementation. Your tests should resemble how users interact with your app.

## Query Priority (RTL)

Use queries in this order of preference:

1. `getByRole` — **Preferred**. Accessible to everyone.
2. `getByLabelText` — For form fields.
3. `getByText` — For visible text.
4. `getByTestId` — **Last resort**. Only when nothing else works.

```typescript
// ✅ GOOD - Queries by accessibility
const submitButton = screen.getByRole('button', { name: /submit/i });
const emailInput = screen.getByLabelText(/email/i);
const heading = screen.getByRole('heading', { name: /welcome/i });

// ❌ BAD - Implementation details
const button = screen.getByTestId('submit-btn'); // Avoid if possible
const div = container.querySelector('.submit-button'); // Never do this
```

## Always Use `screen`

```typescript
// ❌ BAD - Destructuring render
const { getByText } = render(<Component />);
getByText('Hello');

// ✅ GOOD - Use screen object
render(<Component />);
screen.getByText('Hello');
```

## Async Testing: Wait for Final State

```typescript
// ❌ FLAKY - Waiting for loading to finish
await waitFor(() => expect(result.current.isLoading).toBe(false));
expect(result.current.data).toBe(expected); // May still be null!

// ✅ STABLE - Wait for the actual data
await waitFor(() => expect(result.current.data).toBe(expected));
```

## User Events Over fireEvent

```typescript
import userEvent from '@testing-library/user-event';

// ❌ BAD - fireEvent is too low-level
fireEvent.click(button);
fireEvent.change(input, { target: { value: 'text' } });

// ✅ GOOD - userEvent simulates real user behavior
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
```

## Test Structure

```typescript
describe('ComponentName', () => {
  // Setup that applies to all tests
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Group related tests
  describe('when user is logged in', () => {
    test('displays user name', () => { ... });
    test('shows logout button', () => { ... });
  });

  describe('when user is logged out', () => {
    test('shows login button', () => { ... });
  });
});
```

## What to Test (and What NOT to)

### ✅ DO Test:
- User interactions (clicks, typing, navigation)
- Conditional rendering
- Data transformations (in hooks/utils)
- Error states
- Edge cases

### ❌ DON'T Test:
- Implementation details (internal state, private methods)
- Third-party libraries (MUI, React Query)
- Styling/CSS classes
- Every single component (focus on business logic)

```typescript
// ❌ BAD - Testing implementation details
expect(component.state.isOpen).toBe(true);
expect(useState).toHaveBeenCalledWith(false);

// ✅ GOOD - Testing user-visible behavior
expect(screen.getByRole('dialog')).toBeVisible();
```

## Mocking

### Mock API Clients

```typescript
jest.mock('@app-lib/bffApiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const getMock = bffApiClient.get as jest.Mock;
getMock.mockResolvedValueOnce({ data: mockResponse });
```

### Mock External Libraries

```typescript
// Mock Nordic logger
jest.mock('nordic/logger', () => ({
  LoggerFactory: () => ({ error: jest.fn(), info: jest.fn() }),
}));
```

### Don't Over-Mock

```typescript
// ❌ BAD - Mocking everything
jest.mock('react', () => ({ useState: jest.fn() }));

// ✅ GOOD - Mock only external dependencies
jest.mock('@app-lib/bffApiClient');
```

## Testing Hooks with TanStack Query

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

test('fetches data successfully', async () => {
  getMock.mockResolvedValueOnce({ data: { users: mockUsers } });
  
  const { result } = renderHook(() => useUsers(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.data).toEqual(mockUsers));
});
```

## Test File Location

```
feature/
├── hooks/
│   └── useFeature.ts
├── ui-components/
│   └── FeatureTable.tsx
└── __tests__/           # Tests live here
    ├── useFeature.spec.ts
    └── FeatureTable.spec.tsx
```

## Avoid Redundant Tests

```typescript
// ❌ BAD - 5 tests that all verify the same thing
test('renders with data', () => { ... });
test('shows data when loaded', () => { ... });
test('data is visible', () => { ... });
test('displays the data', () => { ... });

// ✅ GOOD - One test per behavior
test('displays user list when data loads', () => { ... });
test('shows error message when request fails', () => { ... });
test('shows loading spinner while fetching', () => { ... });
```

## Assertions

```typescript
// ✅ GOOD - Specific assertions
expect(screen.getByText('Hello')).toBeInTheDocument();
expect(button).toBeDisabled();
expect(input).toHaveValue('test');
expect(getMock).toHaveBeenCalledWith('/api/users');

// ❌ BAD - Vague assertions
expect(component).toBeTruthy();
expect(result).toBeDefined();
```

## Snapshot Testing: Use Sparingly

```typescript
// ❌ BAD - Large component snapshots
expect(component).toMatchSnapshot(); // 500 lines of HTML

// ✅ OK - Small, focused snapshots
expect(formatDate(new Date('2024-01-01'))).toMatchInlineSnapshot(`"Jan 1, 2024"`);
```


## Jest CI Configuration

These settings prevent OOM and flaky failures:

```javascript
// jest.config.js
const isCI = Boolean(process.env.CI);

module.exports = {
  testTimeout: isCI ? 60000 : 15000,
  ...(isCI && {
    maxWorkers: 2,                   // Fixed, not percentage (ARM runners)
    workerIdleMemoryLimit: '256MB',  // Forces worker recycling
    forceExit: true,                 // Prevents hanging workers
  }),
};
```

## Global Cleanup (jest.setup.ts)

```typescript
afterEach(() => {
  jest.clearAllMocks();    // Prevent state leaking
  jest.clearAllTimers();   // Clear pending timers
  jest.useRealTimers();    // Restore real timers
});

afterAll(async () => {
  // Flush pending promises before worker exits
  await new Promise((resolve) => setTimeout(resolve, 0));
});
```
