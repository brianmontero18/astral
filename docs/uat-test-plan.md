# UAT Coverage Map

## Goal

Lock the user-facing contract before visual or style refactors.

This is not a classic QA script. It is the minimum agent-facing checklist that defines what the app must keep doing from the user's point of view.

## How to use this document

- Treat each coverage ID as a contract.
- In the next audit, map every ID to one of: `covered`, `partial`, `missing`, `wrong`, `overlap`.
- Prefer behavior coverage over implementation-detail coverage.
- If a real user scenario is missing, update this file in the same task that discovers it.
- Do not assert exact LLM wording. Assert visible structure, gating, recovery, and user-safe copy.

## Global rules

- `P0` means ship-blocking.
- `P1` means must be covered before a style refactor is considered safe.
- Every user-visible error must be friendly Spanish.
- No user-visible copy may expose stack details, provider names, internal route names, HTTP jargon, or admin-only diagnostics.
- Mobile is mandatory. Assume most users are on mobile.

## Current product contracts to preserve

- Auth is passwordless email.
- A first-time linked user is created as `free`.
- Chat quotas are monthly calendar quotas: `free=20`, `basic=120`, `premium=300`.
- Normal chat UI must not expose running usage counters.
- Report is one single surface: `free` and `basic` see the base layer plus locked premium continuation, while `premium` unlocks that same continuation in place.
- Linked users recover persisted chat history on later sessions.
- Editing a past message rewrites the conversation from that point onward.
- The assets surface currently allows more than one source file, even if future copy may move from "Mis Cartas" to "Mi Carta".
- Manual retry is currently acceptable where no explicit automatic retry contract exists, but the user must never get stuck in a broken state.

## Coverage matrix

| ID | Pri | Flow to protect | Must prove | Expected layers |
|----|-----|-----------------|------------|-----------------|
| `ONBOARD-01` | `P0` | First-time onboarding and chart extraction | User can enter name, upload a supported chart file, review the extracted HD profile, and enter the app without losing context | `BE + UI + E2E` |
| `ONBOARD-02` | `P1` | Extraction failure and retry | Unsupported, corrupt, unreadable, or failed chart extraction produces clear recovery and lets the user retry cleanly | `BE + UI` |
| `AUTH-01` | `P0` | First login, linked identity, no Astral user yet | Bootstrap succeeds, user lands inside the app, starts as `free`, plan is visible somewhere in UI, no dead-end state | `BE + UI + E2E` |
| `AUTH-02` | `P0` | Returning linked `free` user | App restores the session cleanly, shows the previous user state, and restores persisted chat history instead of treating the user as new | `BE + UI + E2E` |
| `AUTH-03` | `P0` | Returning linked `basic` and `premium` users | App restores the correct plan label and the correct gated/unlocked surfaces for each plan | `BE + UI + E2E` |
| `AUTH-04` | `P0` | Anonymous, unlinked, and inactive boot states | Anonymous users are sent to auth cleanly, unlinked users can complete bootstrap, inactive users are blocked with friendly copy | `BE + UI` |
| `AUTH-05` | `P0` | Session expiry during runtime and logout | If the session expires before or during a backend action, the UI fails safely and recovers cleanly; logout clears the session and protected state | `BE + UI + E2E` |
| `AUTH-06` | `P1` | Passwordless auth flow states | Email submit, code submit, resend, invalid code, loading states, and magic-link return paths all behave cleanly with user-safe copy | `BE + UI + E2E` |
| `ACCESS-01` | `P1` | Role-based access | Non-admin users cannot use admin routes; admin users can; denial is graceful and non-technical | `BE + UI` |
| `CHAT-01` | `P0` | Core chat loop | Linked user can trigger quick actions, send typed messages, stream responses, reload, and keep the persisted conversation | `BE + UI + E2E` |
| `CHAT-02` | `P0` | Free quota stop | At the `free` limit, new chat is blocked, prior history remains visible, and the user sees the correct upgrade experience without raw counters | `BE + UI + E2E` |
| `CHAT-03` | `P0` | Basic and premium quotas | `basic` and `premium` use their own limits, keep the same core chat behavior, and show the correct limit-state UX when capped | `BE + UI` |
| `CHAT-04` | `P0` | Existing user plan upgrades | `free -> basic` and `basic -> premium` preserve identity and history, and new access/limit behavior becomes effective without breaking the session | `BE + UI + E2E` |
| `CHAT-05` | `P0` | Message editing semantics | Editing a past user message truncates the later branch, regenerates from that point, and does not leave ghost messages or stale counters | `BE + UI` |
| `CHAT-06` | `P1` | Voice input and transcription | User can record, transcribe, and send voice input; long or failed transcriptions fail safely, do not wedge the recorder, and allow retry | `BE + UI + E2E` |
| `CHAT-07` | `P0` | Chat failures and timeouts | Backend errors, timeouts, transcription failures, and expired sessions during chat actions preserve a usable UI state, keep copy friendly, and avoid duplicate persistence | `BE + UI` |
| `REPORT-01` | `P0` | Free/basic report experience | `free` and `basic` users see one report surface with base content plus locked premium continuation, not a separate premium artifact | `BE + UI + E2E` |
| `REPORT-02` | `P0` | Premium report experience | `premium` unlocks the same report continuation in place and receives the full applied layer | `BE + UI + E2E` |
| `REPORT-03` | `P0` | Report actions | Generate, replace/regenerate, share, and PDF/download work for allowed tiers and fail safely for disallowed tiers | `BE + UI` |
| `REPORT-04` | `P1` | Intake and regeneration | Intake is optional, editable, and can be used to regenerate the report without breaking previous state | `BE + UI` |
| `REPORT-05` | `P0` | Report failure handling | Generation failures or degraded backend paths produce a clear user-safe state; no blank screen or technical dump | `BE + UI` |
| `TRANSIT-01` | `P1` | Weekly transits for a linked user | The app loads the weekly transit view, expands cards cleanly, and shows the personalized HD impact sections when user context exists | `BE + UI + E2E` |
| `TRANSIT-02` | `P1` | Transit resilience | Transit backend failure still results in a clear recoverable UI state with no broken layout or confusing copy | `BE + UI` |
| `ASSET-01` | `P1` | Source-file flow | User can see empty state, upload, preview, close preview, and delete source files without the screen breaking | `BE + UI + E2E` |
| `ASSET-02` | `P1` | Asset validation and recovery | Invalid file, oversized file, missing asset, forbidden asset, and preview failure all surface friendly copy and leave the surface usable | `BE + UI` |
| `PROFILE-01` | `P1` | Profile and plan visibility | The user can open the profile surface, see plan/access cues, and the surface works even with partial HD data | `UI + E2E` |
| `NAV-01` | `P1` | Main navigation | Chat, Tránsitos, Mis Cartas, Intake, and Report navigation preserve state where expected and do not strand the user | `UI + E2E` |
| `ADMIN-01` | `P1` | Admin user list and detail | Admin can list, search, paginate, open detail, and inspect support data without exposing raw implementation details | `BE + UI` |
| `ADMIN-02` | `P1` | Admin access mutation | Admin can update another user's plan/role/status; self-mutation remains blocked with safe copy | `BE + UI` |
| `RESP-01` | `P0` | Mobile core flows | Auth, chat, voice, report, transits, assets, profile, and upgrade CTAs remain usable at mobile widths with no overlap or horizontal scroll | `E2E + visual smoke` |
| `RESP-02` | `P1` | Overlays and layout stability | Drawers, dropdowns, dialogs, locked cards, and preview modals open, close, and fit correctly on mobile and desktop | `UI + E2E + visual smoke` |
| `COPY-01` | `P0` | User-safe copy | No user-facing screen leaks internal names like provider, backend, route paths, status codes, or admin diagnostics | `UI + E2E` |

## Clarifications that the next audit must lock explicitly

- `free` users are expected to see they are on `free`, but not to see a running `used/limit` counter in normal chat mode.
- Returning linked users are expected to recover their prior persisted chat history.
- Editing a message does not preserve alternate branches; it replaces the future from the edit point onward.
- If the session expires mid-action, the app must recover cleanly; the audit should verify the exact UX that exists today and flag any broken or ambiguous path.
- Automatic retry is not assumed. If a flow only supports manual retry today, the audit should mark that behavior clearly instead of inventing hidden retry semantics.
- The assets surface currently behaves as a multi-file source area. If product later formalizes a strict single-file model, this UAT must be updated first.

## Out of scope for this document

- Internal implementation details.
- Exact LLM text snapshots.
- Exhaustive backend schema coverage.
- Classic QA ceremony, screenshots, and long step-by-step scripts.

This file is the compact source of truth for the next coverage audit.
