# Admin User Provisioning Plan

## Summary

Convert the admin panel into the manual source of truth for user access while there is no payment gateway. An admin should be able to create a user by email, choose a plan (`free`, `basic`, or `premium`), and optionally provide a display name. When that person signs in through passwordless auth, Astral should recognize the pre-provisioned account, preserve the assigned plan, and send them into the remaining onboarding steps.

This must be designed as general access provisioning, not as a premium-only workaround. The current use case is manually selling Premium via transfer and then granting access, but the same backend path should be reusable later by a payment provider.

## Current Constraints

- Auth is handled by SuperTokens passwordless email.
- Astral stores app users in `users` and links auth identities through `user_identities`.
- `users.profile` is currently required, but a pre-provisioned user does not have a real Human Design profile yet.
- The current onboarding creates the user only during extraction, then updates the extracted profile, then stores intake at the end.
- A linked user currently skips onboarding and enters the main app, so pre-provisioning must introduce an explicit pending-onboarding state.

## Key Changes

- Add admin provisioning endpoint:
  - `POST /api/admin/users`
  - body: `{ email, name?: string, plan: "free" | "basic" | "premium", sendInvite: true }`
  - requires an active admin session.
  - creates or reuses the SuperTokens passwordless user for the email.
  - creates `users` and `user_identities` with the selected plan, `role = "user"`, and `status = "active"`.
  - rejects ambiguous duplicates instead of silently creating another account.
- Add onboarding state to the app user model:
  - `onboarding_status`: `pending | complete`
  - `onboarding_step`: `name | upload | review | intake | complete`
  - optional `onboarding_draft` JSON for partial progress.
  - existing users should be backfilled as `complete`.
- Keep `users.profile` internally populated with a valid placeholder JSON for pending users to avoid a destructive schema migration. API responses should expose `profile: null` while `onboarding_status = "pending"`.
- Extend `/api/me` so the frontend can distinguish:
  - complete linked user with a real profile.
  - pre-provisioned linked user with pending onboarding, assigned plan, optional name, and no usable profile yet.
- Persist onboarding checkpoints:
  - save name immediately after the name step.
  - keep uploaded assets associated with the current user immediately.
  - save extracted profile after extraction/review.
  - save intake when submitted.
  - after refresh, resume from the latest saved step.
- Send invitation:
  - admin-created users should receive a passwordless invitation/login email by default.
  - if invitation sending fails after the user is created, do not duplicate the user on retry; return a clear retryable error.

## Frontend Behavior

- In `/admin/users`, add a `Dar de alta usuario` action.
- Admin form fields:
  - email required.
  - name optional.
  - plan selectable, defaulting to `premium` for the current business workflow.
  - send invitation enabled by default.
- After login:
  - if the account is complete, behave as today.
  - if the account is pre-provisioned and has a name, start onboarding at bodygraph upload.
  - if the account is pre-provisioned without a name, start onboarding at the name step.
  - after bodygraph upload, profile review, and intake, enter the chat with the already assigned plan.
- Admin list/detail should show:
  - plan.
  - account status.
  - linked identity state.
  - onboarding state.

## Future Payment Compatibility

- Treat this as access provisioning with a source, not as a hard-coded manual premium path.
- Add a simple source field now, such as `access_source = "manual"`, leaving room for `payment_provider` or similar later.
- A future payment gateway should be able to call the same internal operation: create or update user, assign plan, and leave onboarding pending if the user has not completed profile setup.

## Test Plan

- Backend:
  - admin can create `premium`, `basic`, and `free` users.
  - name is optional.
  - users created with a name skip the onboarding name step.
  - users created without a name see the onboarding name step.
  - non-admin requests receive `403 admin_required`.
  - duplicate email or identity does not create duplicate accounts.
  - `/api/me` returns pending onboarding plus the assigned plan for pre-provisioned users.
  - each onboarding checkpoint persists and can resume after refresh.
- Frontend and E2E:
  - admin creates a user and sees it in the user list.
  - invited user signs in with passwordless code or magic link.
  - pending user lands in the correct onboarding step.
  - refresh after name, upload/profile, and intake resumes correctly.
  - completed user enters chat with the assigned plan.
- Verification commands:
  - `npm run check`
  - `npm test`
  - relevant admin/auth/onboarding E2E specs.

## Implementation Notes

- Read `CLAUDE.md` before implementation.
- Relevant backend files:
  - `backend/src/db.ts`
  - `backend/src/routes/users.ts`
  - `backend/src/auth/supertokens.ts`
  - `backend/src/auth/current-user.ts`
- Relevant frontend files:
  - `frontend/src/App.tsx`
  - `frontend/src/api.ts`
  - `frontend/src/components/OnboardingFlow.tsx`
  - `frontend/src/components/AdminUsersView.tsx`
  - `frontend/src/components/AdminUserDetailView.tsx`
  - `frontend/src/types.ts`
