# SuperTokens Research Summary for Astral

Last updated: 2026-04-12

## Purpose

Capture the decision context and official SuperTokens findings needed to move Astral from client-trusted identity to server-validated sessions.

This document is the durable research summary.
Execution detail and phased implementation live in `.beads/docs/AUTH-SUPERTOKENS-IMPLEMENTATION-PLAN.md`.

## Current Astral Constraints

- Frontend: React 18 + Vite.
- Backend: Fastify 5 + TypeScript/ESM.
- Domain DB: libsql via `@libsql/client`, Turso in remote or local SQLite/libsql.
- Deploy shape: one Dockerized service on Fly serving both frontend and backend.
- Current auth posture is not real auth:
  - `frontend/src/App.tsx` reads `localStorage("astral_user")`.
  - `frontend/src/api.ts` sends `userId` in request body/query.
  - backend routes trust `:id` and client-provided `userId`.

## Decision

Recommended direction:

- Use `SuperTokens managed` first.
- Keep Astral's domain user model in libsql/Turso.
- Add a stable mapping from the SuperTokens auth subject to Astral's internal user.
- Preferred implementation: a `user_identities` table keyed by provider + provider user ID.
- Refactor backend routes to derive identity from validated session only.
- Build a minimal Astral admin layer on top of SuperTokens auth primitives.

Why this is the best fit for Astral:

- Better control path than Clerk for a backend-owned architecture.
- Cleaner fit than Supabase Auth for a repo whose domain data already lives in libsql/Turso.
- Lower operational burden than self-hosting auth or rolling custom auth.
- Escape hatch remains open because SuperTokens is self-hostable later.

## Official SuperTokens Findings

### Architecture

SuperTokens has three relevant runtime pieces:

- Frontend SDK
- Backend SDK
- SuperTokens Core

The frontend talks to auth endpoints exposed by your backend, not directly to the Core.

Official docs:

- https://supertokens.com/docs/references/how-supertokens-works

### Backend / Fastify

Use:

- `supertokens-node`
- `framework: "fastify"`
- Fastify bridge/plugin + error handler
- `Session.init()`
- `Passwordless.init(...)`
- later `UserRoles.init()`, `Dashboard.init()`

Important notes:

- CORS must be configured before SuperTokens.
- Allow `credentials: true`.
- Include `content-type` and `...getAllCORSHeaders()`.
- Session verification should be done via SuperTokens session helpers, then mapped to Astral's internal user.

Official docs:

- https://supertokens.com/docs/quickstart/backend-setup
- https://supertokens.com/docs/post-authentication/session-management/introduction
- https://supertokens.com/docs/additional-verification/user-roles/introduction

### Frontend / React

Use:

- `supertokens-auth-react`
- `SuperTokensWrapper`
- recipe routes for auth
- `SessionAuth` or equivalent guard
- session context helpers instead of `localStorage`

Official docs:

- https://supertokens.com/docs/quickstart/frontend-setup

### Recommended Auth Recipe for Astral

Recommended initial recipe set:

- `Session`
- `Passwordless`
- `UserRoles`
- `Dashboard`

Passwordless recommendation:

- `contactMethod: "EMAIL"`
- `flowType: "USER_INPUT_CODE_AND_MAGIC_LINK"`

Reason:

- Magic links alone can be auto-consumed by email scanners.
- The combined flow preserves the smoother magic-link path while keeping OTP fallback.

Official docs:

- https://supertokens.com/docs/authentication/passwordless/initial-setup
- https://supertokens.com/features/email-magic-links
- https://supertokens.com/docs/additional-verification/user-roles/protecting-routes
- https://supertokens.com/docs/userdashboard/users-listing-and-details

### Deployment / Cookie / Domain Notes

For Astral's current deploy shape, prefer single-origin in production:

- `websiteDomain === apiDomain`
- both should be the public `https://` origin

Why:

- simpler cookies
- simpler CSRF posture
- simpler browser behavior
- less CORS complexity

Operational notes:

- Do not casually customize `cookieDomain`.
- If self-hosting later, SuperTokens Core needs PostgreSQL 13+.
- For production email delivery, do not rely on default delivery forever; plan SMTP/custom delivery.

Official docs:

- https://supertokens.com/docs/post-authentication/session-management/security/cookies-and-https
- https://supertokens.com/docs/post-authentication/session-management/advanced-workflows/multiple-api-endpoints
- https://supertokens.com/docs/deployment/self-host-supertokens
- https://supertokens.com/docs/thirdpartypasswordless/email-delivery/pre-post-email

## What SuperTokens Covers vs What Astral Must Own

SuperTokens covers:

- authentication flows
- session lifecycle
- auth cookies / token refresh
- passwordless UX primitives
- roles / permissions primitives
- user dashboard basics

Astral still owns:

- internal `users` domain record
- mapping from auth subject to internal user
- admin actions tied to Astral business state
- rollout and migration from legacy `localStorage("astral_user")`
- API refactor from `/users/:id` style identity to `/api/me/*`
- migration of personalized transit impact away from query-based client `userId`

## Slice 6 Admin / Access Model

The rollout cleanup now assumes:

- `POST /api/users` is no longer an anonymous bootstrap path.
- It only exists for the authenticated `identity_not_linked` flow after SuperTokens auth succeeds.
- Astral users now carry:
  - `role`: `user | admin`
  - `status`: `active | disabled | banned`
- Non-`active` users are blocked from session-derived protected routes with `403 account_inactive`.
- Legacy user CRUD routes (`/api/users/:id`) are now internal/admin-only surfaces.
- Minimal internal admin foundation lives under `/api/admin/*`.
- The hosted SuperTokens dashboard entry remains `/auth/dashboard`.
- Internal admin gating is Astral-owned from the `users.role` field; this slice does not depend on SuperTokens role sync.

## Repository Hotspots to Refactor

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/components/OnboardingFlow.tsx`
- `frontend/src/components/AssetViewer.tsx`
- `frontend/src/components/TransitViewer.tsx`
- `frontend/src/components/ReportView.tsx`
- `frontend/src/types.ts`
- `backend/src/app.ts`
- `backend/src/routes/users.ts`
- `backend/src/routes/chat.ts`
- `backend/src/routes/assets.ts`
- `backend/src/routes/report.ts`
- `backend/src/routes/transits.ts`
- `backend/src/db.ts`

## Hard Rules for Implementation

- Tests first for each slice.
- Keep the app runnable after every slice.
- Prefer additive migration, not big-bang rewrites.
- Add a temporary compatibility window only if it is explicitly guarded and easy to delete.
- Validate manually after each slice with focused smoke tests.
- No session or auth secret in `localStorage`.
- Backend must stop trusting client-provided identity.

## Suggested Order

1. Add implementation plan + Beads epic/tasks.
2. Add failing backend tests for session-gated identity flow.
3. Install and wire SuperTokens in Fastify with no business-route refactor yet.
4. Add DB identity mapping and `/api/me`.
5. Migrate backend routes from client `userId` to session-derived user.
6. Migrate frontend bootstrap and API client.
7. Add admin role + dashboard/internal admin slice.
8. Remove compatibility remnants and finalize smoke coverage.
