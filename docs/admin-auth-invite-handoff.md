# Handoff: Admin Invitations, Auth Emails, and Admin User Management

Date: 2026-05-04

This document is a product and technical handoff for a future Codex/Claude Code session. Do not treat it as an implementation plan ready to execute blindly. Start by rereading the current code, validating assumptions, and then produce a concrete plan before changing files.

## Product Intent

Astral Guide needs an admin-driven invitation flow that feels like a real welcome into the product, not like a generic login challenge.

When an admin invites a person from `/admin/users`, the recipient should receive a branded welcome email saying they have been invited to Astral Guide. The primary action should be a magic link that logs them in directly and sends them into the app/onboarding flow. The desired user experience is:

1. Admin creates/invites a user from the admin users panel.
2. Invited person receives a branded welcome email.
3. Person clicks the CTA.
4. The app consumes the magic link automatically.
5. The person enters Astral Guide already authenticated, without typing an OTP.
6. If onboarding is pending, the product resumes the proper onboarding step.

The current generic email reading roughly `Login to Astral Guide / Enter the below OTP...` is not acceptable for this invitation scenario. It feels like a default auth email, not a welcome/invite.

## Problem Statement

There are three related issues in the current system:

1. Email delivery in local/dev falls back to SuperTokens default delivery unless SMTP is configured. The default service cannot use Astral's custom HTML template, so it sends generic OTP copy.
2. The admin invitation flow is conceptually different from normal login, but currently both are modeled as generic passwordless access.
3. The frontend magic-link route is conservative: it only auto-consumes a magic link when the browser has a matching login attempt in local storage. That makes sense for user-initiated login, but not for admin-created invites because the recipient did not initiate the request from their browser.

The result is that the recipient may get a generic OTP email and/or land on an intermediate confirmation UI instead of entering automatically from the email CTA.

## Known Current Code

Backend auth setup:

- `backend/src/auth/supertokens.ts` initializes `Passwordless` with `flowType: "USER_INPUT_CODE_AND_MAGIC_LINK"`.
- `backend/src/auth/config.ts` only enables custom SMTP email delivery when all required SMTP env vars are present.
- `backend/src/auth/passwordless-email.ts` contains a custom Astral-styled email builder, but it only gets used through the SMTP-backed `createPasswordlessEmailService`.
- `backend/src/routes/users.ts` contains the admin invite endpoint `POST /api/admin/users`.
- `backend/src/routes/users.ts` has a `buildMagicLink()` helper that builds `/auth/verify?preAuthSessionId=...&tenantId=public#linkCode`.

Frontend auth setup:

- `frontend/src/auth/AuthScreen.tsx` owns the custom auth UI.
- `frontend/src/auth/helpers.ts` has `shouldAutoConsumeMagicLink()`, which currently requires a stored `preAuthSessionId` attempt to auto-consume.
- If the stored attempt is absent/mismatched, the auth UI goes to `magic-link-ready`, requiring a click on "Continuar con este enlace".

Admin user management:

- `GET /api/admin/users` exists.
- `POST /api/admin/users` exists for inviting/reinviting by email and plan.
- `PATCH /api/admin/users/:id/access` exists and supports `plan`, `role`, and `status`, while blocking self access mutation.
- `DELETE /api/users/:id` exists for general user deletion and requires admin via the existing route, but there is no clear admin-panel delete-user UX with confirmation.
- `frontend/src/components/AdminUserDetailView.tsx` already has support actions for plan/status/role and reinvite, but copy and UX need review.
- `frontend/src/components/AdminInviteModal.tsx` has copy like "Invitar usuaria", which should be neutral.

## Recent Session Context

In the previous session, the admin invite endpoint was adjusted so that after creating a SuperTokens passwordless code it explicitly calls `Passwordless.sendEmail(...)`. The test `backend/src/__tests__/api-admin-users-invite.test.ts` was updated to cover delivery success and delivery failure.

Verify the repo state before relying on that change. If it is present, the important behavior is:

- `Passwordless.createCode(...)` creates the code/link.
- `Passwordless.sendEmail(...)` sends it.
- On create or delivery failure, `POST /api/admin/users` returns `502 invite_send_failed`.

This still does not solve branded invite email copy, SMTP/default delivery behavior, or invite auto-login UX.

## Product Requirements

### Admin Invite Email

The admin invite email must be a welcome/invitation email, not a generic login email.

Requirements:

- Branded Astral Guide HTML aligned with the product design system.
- Neutral language. Avoid assuming the recipient is female. Use "persona", "usuario", "cuenta", or neutral wording.
- Clear subject, likely along the lines of "Tu invitación a Astral Guide" or equivalent.
- CTA should be magic-link first: "Entrar a Astral Guide", "Abrir mi acceso", or similar.
- Recipient should not need to type a code for the happy path.
- The email can include a fallback plain URL, but do not foreground OTP copy in the invite email.
- Normal login emails and admin invite emails may need different templates/copy.

Open copy task:

- Define final welcome copy before implementation. The current email builder says "Pediste un acceso...", which is correct for login but wrong for admin invite.

### Magic Link UX

Desired invite behavior:

- Clicking the invite CTA should authenticate automatically.
- No OTP entry required.
- No extra "Continuar con este enlace" click in the normal invite path.
- If the link is expired, consumed, invalid, or conflicts with an existing session/account, show a clear recovery path.

Important nuance:

- SuperTokens supports magic links. This is not a hard technical limitation.
- The current frontend gating is an application-level UX decision. It can be changed for invite links after reviewing security implications.

Potential direction:

- Mark admin-generated invite links explicitly, for example with a safe query param like `source=invite` or `intent=invite`.
- Let `/auth/verify` auto-consume when a valid link code and `preAuthSessionId` are present and the intent is invite, even without stored local login attempt.
- Keep the stricter local-attempt requirement for ordinary user-initiated login links if desired.

### Passwordless TTL

Product expects admin invite links to last 48 hours.

Current/known context:

- SuperTokens passwordless default lifetime is 15 minutes (`900000ms`).
- Brian has already increased `passwordless_code_lifetime` to 48 hours in production.
- Local/dev may still be 15 minutes unless configured separately.
- Do not rely only on frontend/backend constants for `expiresAt`; the real expiry comes from SuperTokens core configuration.

Requirements:

- Align UI copy with actual environment behavior.
- Avoid saying "48h" unless the environment really uses 48h.
- Consider surfacing `createCodeResult.codeLifetime` instead of a hard-coded invite TTL in API responses.

### Admin User Deletion

Add a safe admin-panel way to delete users so testing does not require manually deleting from SQLite.

Requirements:

- Available from admin user detail or admin users list.
- Requires explicit confirmation before deletion.
- Confirmation copy should name the user/email and explain that related DB records will be deleted via cascade where applicable.
- Block or strongly guard self-deletion for the active admin account.
- On success, return to users list and refresh data.
- On failure, show a clear error.
- Do not delete local asset files unless this is intentionally designed and tested. Current DB cascades remove asset rows; physical storage cleanup needs separate consideration.

Potential existing backend:

- `DELETE /api/users/:id` already exists and requires admin. Verify behavior, auth, self-deletion handling, cascade effects, and whether a dedicated `/api/admin/users/:id` route would be clearer.

### Admin User Editing

Current product need is only plan changes. Broader profile/data editing can wait.

Requirements now:

- Confirm current admin detail can change plan reliably.
- If role/status are visible/editable, verify that product wants them exposed now. If not, hide or de-emphasize.
- Ensure saving plan changes has good feedback and reload behavior.
- Preserve safety guard against changing the current admin's own access.

Later, not now:

- Editing arbitrary user profile/intake/bodygraph data.

### Copy and Language Cleanup

The admin UI should not assume the audience is female.

Known examples to audit:

- "Invitar usuaria"
- "esta usuaria"
- any related CTA/status/copy in admin users list, invite modal, user detail, reinvite flows, and error messages.

Requirement:

- Use neutral Spanish throughout admin UI and email copy.

### Clipboard UX

The admin invite/reinvite flow exposes copy-link buttons. This needs a visible and reliable copied state.

Requirements:

- On successful copy, show visible confirmation near the button.
- The feedback should be accessible (`aria-live`) and remain long enough to notice.
- Button label/icon state can change briefly, for example "Copiado".
- Test failed clipboard permission path.

Note:

- Some copy feedback exists in code paths, but the user reported that it is not perceptible enough or not working in practice. Verify in browser.

### Responsive/Admin UI QA

Review the admin users list, invite modal, detail panel, reinvite area, delete confirmation, and access editor on mobile and desktop.

Requirements:

- No text overflow.
- Modal usable on small screens.
- Actions remain reachable.
- Long emails and magic links wrap without breaking layout.
- Buttons and feedback states are visible.
- Follow existing design system: glass panels, typography, color tokens, restrained admin UI.
- Do not introduce unrelated visual systems or over-abstracted components.

## Edge Cases to Cover

Invite/create:

- New email, no name.
- New email, with name.
- Existing self-signup user invited/upgraded.
- Existing pending manually invited user reinvited.
- Existing completed manually invited user reinvited or plan changed.
- Same email with different casing.
- Invalid email.
- Missing/invalid plan.
- Invite send failure after DB row creation.
- SuperTokens create-code failure.
- SMTP/default provider failure.
- Admin tries to invite their own email.

Magic link:

- Recipient opens link in a browser with no stored login attempt.
- Recipient opens link in same browser where login was initiated.
- Recipient opens expired link.
- Recipient opens already consumed link.
- Recipient opens link after completing onboarding.
- Recipient opens invite link while already logged in as same user.
- Recipient opens invite link while logged in as another user.
- Recipient has no matching `users` row.
- SuperTokens user exists but Astral identity row is not linked.
- Pending manual user auto-links by email.
- Manual pending user has same email but already has an identity.

Onboarding/product:

- Invite link authenticates and lands in pending onboarding at correct step.
- Completed user lands in chat.
- Disabled/banned user sees inactive account messaging.
- User refreshes during onboarding.
- User tries to reuse old invite link after completing onboarding.

Admin deletion:

- Delete pending user with no assets/messages.
- Delete user with assets/messages/reports/llm calls.
- Delete user with shares.
- Delete unknown user.
- Delete currently logged-in admin account should be blocked or require an intentionally designed flow.
- UI refreshes list and pagination after deletion.

Admin access editing:

- Plan only change.
- Role/status changes if kept in UI.
- No-op save.
- Invalid API payload.
- Self access mutation.
- Network failure.

## Testing Requirements

Backend unit/API tests:

- `POST /api/admin/users` invite success/failure paths.
- Email template builders for login vs invite.
- Delivery service selection: default vs SMTP/custom.
- `PATCH /api/admin/users/:id/access` plan update.
- Delete user route/admin auth/self guard/cascade expectations.
- Auth resolver auto-link behavior for admin-invited users.

Frontend/component tests:

- Admin invite modal copy, success, send-failed, copy-link feedback.
- Admin detail plan save, reinvite, delete confirmation, neutral language.
- Auth helper behavior for invite magic links vs normal login links.
- Error copy for expired/consumed links.

E2E tests:

- Admin creates invite and sees success.
- Admin copies magic link and feedback appears.
- Invited user opens email/magic link and is authenticated.
- Invited user lands in onboarding if pending.
- User-initiated login by email still works.
- OTP fallback still works if intentionally supported.
- Reinvite flow works.
- Delete user from admin UI works.
- Mobile viewport for admin list/detail/modal.

Manual QA:

- Real browser test with email provider or local mail catcher.
- Scenario A: user clicks from email.
- Scenario B: admin copies magic link and sends it manually.
- Scenario C: expired/consumed link.
- Scenario D: invite already accepted.

## Architecture Guidance

Before coding:

1. Reread the current auth/admin routes and frontend auth helpers.
2. Confirm SuperTokens SDK behavior against installed versions.
3. Decide whether invite and login should share one delivery service with conditional copy, or separate small builders.
4. Decide how to mark invite intent in a way that is safe and maintainable.
5. Decide how the UI determines actual link expiry text.

Implementation principles:

- Prefer existing repo patterns over new abstractions.
- Avoid stringly typed hacks when a structured context/intent can be passed.
- Keep invite-specific behavior explicit.
- Do not over-generalize email templates prematurely, but avoid duplicating large HTML blocks if a small shared renderer can do the job cleanly.
- Preserve account-linking safety. Do not auto-link arbitrary emails outside the existing pending manual invite constraints.
- Make changes test-first or test-alongside.
- Keep admin UI neutral, compact, and consistent with the current admin/support design.

## Suggested Work Breakdown

1. Audit current admin/auth code and confirm repo state.
2. Fix/define invite email delivery architecture.
3. Add invite-specific email copy/template.
4. Adjust magic-link auto-consume behavior for invite links.
5. Align TTL copy/API response with actual SuperTokens lifetime.
6. Add admin delete-user UI with confirmation.
7. Clean neutral language in admin UI.
8. Improve copy-link feedback and mobile layout.
9. Expand backend/frontend/E2E coverage.
10. Run full relevant checks and document manual QA results.

## Open Questions

- Which email provider should production/dev use for custom delivery: SMTP, Resend, SendGrid, or another provider?
- Should invite emails omit OTP entirely, or include it as a low-emphasis fallback?
- Should admin invite links always route to onboarding, or should completed users go directly to chat?
- Should the UI expose role/status editing now, or should it be hidden until needed?
- Should deleting a user also delete physical local/R2 assets, or only DB records initially?
- What is the final Spanish welcome copy for invite emails?

## Current Product Direction From Brian

- The invite should feel like a welcome into Astral Guide.
- The recipient should enter by clicking a magic link, without typing a code.
- Admin should be able to delete test users from the admin panel with confirmation.
- Plan changes should be supported; broader user data editing can wait.
- Admin copy must be neutral, not "usuaria".
- Email templates must follow the product design system.
- Admin/mobile UX must be reviewed live.
- E2E coverage for admin and user auth/onboarding flows must be updated.
- Avoid patching blindly. Think in systems, architecture, conventions, and long-term maintainability, without over-engineering.
