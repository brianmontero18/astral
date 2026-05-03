# E2E specs

Playwright suite under `e2e/specs/`. Run via `npm run test:e2e` (or `:ui`).

## Contracts in progress

Some specs are checked in **before** the underlying feature is implemented and
are used as the UX contract for an in-flight epic. Tests in those specs are
marked `test.fixme(...)` so the suite stays green; each `fixme` is removed
when the corresponding slice lands.

| Spec | Epic / bead | Status |
|---|---|---|
| `25-admin-invite-flow.spec.ts` | `astral-0xw` (admin user provisioning) — north star bead `astral-bgk` | `fixme` until backend (`astral-wlx`, `astral-4ub`) and frontend (`astral-e59`, `astral-3wx`) slices land. Closed by `astral-6o4`. |

When a downstream slice removes a `fixme`, that test must pass as part of
its merge.
