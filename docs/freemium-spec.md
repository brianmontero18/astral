# Access Model v1 — Contract

## Status

Policy closed and implemented on 2026-04-19.

This document replaces the old "15 free lifetime messages + WhatsApp CTA" spec.
It is the current source of truth implemented in `astral-rkw.3`.

## Current-state audit

### Code truth today

- `backend/src/chat-limits.ts` and `frontend/src/chat-limits.ts` define:
  - `free = 20`
  - `basic = 120`
  - `premium = 300`
- `backend/src/routes/chat.ts` enforces the cap with `getUserMessageCount(userId)`.
- `backend/src/db.ts` counts only monthly user messages in the active window:
  - `role = 'user'`
  - `created_at >= current_window_start`
  - `created_at < next_window_start`
- `backend/src/routes/report.ts` allows premium report access only for `plan === "premium"`.
- `backend/src/report/types.ts` defines the premium continuation as 6 applied sections:
  - `work-rhythm`
  - `decision-style`
  - `positioning-offer`
  - `client-dynamics`
  - `visibility-sales`
  - `next-30-days`

### Inconsistencies now open

- None at contract level after `astral-rkw.4` implementation.

## Closed contract v1

| Plan | Chat quota | Usage cycle | Report access | Premium-only value | Behavior at limit |
|------|------------|-------------|---------------|--------------------|-------------------|
| `free` | `20` user messages | Calendar month | Single report surface, base layer only | None | Hard stop on new chat messages |
| `basic` | `120` user messages | Calendar month | Single report surface, base layer only | None | Hard stop on new chat messages |
| `premium` | `300` user messages | Calendar month | Single report surface, base + premium layer | Premium business/mentorship continuation | Hard stop on new chat messages |

## Usage cycle definition

### Decision

Use **calendar month**, not rolling 30 days.

### Exact semantics

- The quota window runs from the first day of the month at `00:00:00` to the last day of the month at `23:59:59`.
- The reference timezone for v1 is `America/Argentina/Buenos_Aires`.
- Count only persisted messages with:
  - `role = 'user'`
  - `created_at` inside the active monthly window
- Unused quota does not roll over.
- There is no proration.
- New users start with the full quota of the current month.

### Why this and not rolling 30d

- Easier to explain to users.
- Easier to support from admin.
- Easier to implement and debug in `.3`.
- Easier to align later with billing.

## Limit behavior at cap

### Decision

Use a **hard cap** for all 3 plans in v1.

### Exact behavior

- When the user reaches the monthly limit, the product becomes read-only for chat.
- Existing chat history remains visible.
- Existing reports remain accessible according to the user's plan.
- New user messages are rejected until the next monthly reset or until the user changes plan.
- No carryover, no grace bucket, no manual overflow logic in v1.

### Contract for API/frontend

When the cap is reached, chat endpoints must reject the request with:

```json
{
  "error": "message_limit_reached",
  "plan": "free|basic|premium",
  "used": 20,
  "limit": 20,
  "cycle": "2026-04",
  "resetsAt": "2026-05-01T00:00:00-03:00"
}
```

The exact timestamp will vary by month, but the contract requires:

- `plan`
- `used`
- `limit`
- `cycle`
- `resetsAt`

### UX behavior

- `free`: show upgrade CTA to `basic` or `premium`.
- `basic`: show upgrade CTA to `premium` plus next reset date.
- `premium`: show next reset date. Do not invent a second hidden overflow tier.

## Premium differentiation beyond chat

### Decision

`premium` must not be positioned as "basic with more messages".

### Premium promise in v1

`premium` includes the **premium continuation of the same report, oriented to business and mentorship**, not only a deeper HD glossary.

That deliverable must:

- use the user's activity, goals, and challenges as business context
- translate the chart into applied guidance for work, offer, positioning, client dynamics, and decision-making
- surface strengths, shadows, and pattern-recognition angles with direct mentoring value
- produce a concrete artifact the user can keep, revisit, and share

### Product consequence

This promise is now implemented as a continuation of the same report surface.

Today premium unlocks:

- applied business interpretation
- mentorship-oriented synthesis
- clearer action/value than "6 more sections"

## Why these limits

### `free = 20`

- Enough to evaluate the product with real usage.
- Clean round number.
- Matches the already-decided business constraint.

### `basic = 120`

- Creates a real step up from free: `6x`.
- Large enough for recurring weekly use without feeling tokenized.
- Still bounded enough to keep cost and abuse predictable.

### `premium = 300`

- Creates a real step up from basic: `2.5x`.
- Supports near-daily usage without needing "unlimited".
- Keeps the premium value anchored in the deliverable, not only in volume.

### Why not unlimited

- It weakens cost control.
- It weakens plan differentiation.
- It makes abuse harder to contain.
- It is unnecessary for v1 if premium already includes a stronger deliverable.

### Why not a soft cap for premium

- It adds ops ambiguity.
- It complicates implementation and support.
- It blurs the contract right before `astral-rkw.3`.

For v1, a hard cap is cleaner.

## Reference for premium direction

The premium deliverable should move toward the level of applied value seen in:

- `../marca_personal/DANIELA_DESIGN_PROFILE.md`

What matters from that reference is not "more theory", but:

- business pattern recognition
- mentoring usefulness
- decision and rhythm guidance
- value perceived as strategic, not decorative

## Implementation scope for `astral-rkw.3`

`astral-rkw.3` implemented this contract without redefining plan policy.

### Implemented in `.3`

- Limits are:
  - `free = 20`
  - `basic = 120`
  - `premium = 300`
- Counting is monthly-window based.
- Keep counting only `role = 'user'`.
- Enforce the cap in both sync and streaming chat routes.
- Return the richer limit payload with cycle metadata.
- Update frontend usage display and cap state against the monthly contract.

### Explicitly not part of `.3`

- Designing the premium report v2
- Repricing plans
- Billing implementation
- Manual exceptions or soft-cap operations

## Premium deliverable spec

The exact contract for the premium business/mentorship deliverable is now defined in:

- [docs/premium-report-v2-spec.md](/Users/brmontero/astral/docs/premium-report-v2-spec.md)

That document closes `astral-rkw.4` at policy/spec level.

The plan policy and the premium deliverable are now aligned in both contract and implementation.
