/**
 * Slice-1 contract seam.
 *
 * This file defines the target resolver shape before the real SuperTokens
 * wiring and DB-backed identity mapping land in later slices.
 */
export interface AuthSessionPrincipal {
  provider: "supertokens";
  subject: string;
}

export interface AuthenticatedAppUser {
  id: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "disabled" | "banned";
  /**
   * Onboarding state propagated from `users.onboarding_status` so route
   * handlers can gate behaviour without a second DB round-trip. `pending`
   * means the user has not finished onboarding (admin-invited but not yet
   * uploaded their bodygraph, or self-signup mid-flow); `complete` is the
   * normal post-onboarding state.
   */
  onboarding_status: "pending" | "complete";
}

export interface ResolveCurrentUserDeps {
  findUserByIdentity(
    provider: AuthSessionPrincipal["provider"],
    subject: string,
  ): Promise<AuthenticatedAppUser | null>;
  /**
   * Optional. When the session subject is not yet linked to any users row,
   * the resolver consults this dep to attempt an auto-link by matching the
   * provider's email against a pending admin-provisioned user. Returning
   * null means "no candidate, leave as unlinked"; returning a user means
   * the link was just created and the resolver should treat the session as
   * linked from now on.
   */
  autoLinkPendingUserByEmail?(
    provider: AuthSessionPrincipal["provider"],
    subject: string,
  ): Promise<AuthenticatedAppUser | null>;
}

export interface ResolveCurrentUserInput {
  session: AuthSessionPrincipal | null;
  requestedUserId?: string | null;
}

export type ResolveCurrentUserResult =
  | {
      kind: "anonymous";
      statusCode: 401;
      error: "authentication_required";
    }
  | {
      kind: "unlinked";
      statusCode: 409;
      error: "identity_not_linked";
      provider: AuthSessionPrincipal["provider"];
      subject: string;
    }
  | {
      kind: "forbidden";
      statusCode: 403;
      error: "client_identity_mismatch";
      userId: string;
      requestedUserId: string;
      provider: AuthSessionPrincipal["provider"];
      subject: string;
    }
  | {
      kind: "inactive";
      statusCode: 403;
      error: "account_inactive";
      status: AuthenticatedAppUser["status"];
      userId: string;
      provider: AuthSessionPrincipal["provider"];
      subject: string;
    }
  | {
      kind: "linked";
      user: AuthenticatedAppUser;
      provider: AuthSessionPrincipal["provider"];
      subject: string;
    };

export async function resolveCurrentUser(
  input: ResolveCurrentUserInput,
  deps: ResolveCurrentUserDeps,
): Promise<ResolveCurrentUserResult> {
  if (!input.session) {
    return {
      kind: "anonymous",
      statusCode: 401,
      error: "authentication_required",
    };
  }

  let user = await deps.findUserByIdentity(
    input.session.provider,
    input.session.subject,
  );

  // Admin-provisioning auto-link: when the SuperTokens subject has no
  // identity row yet, try to attach it to a pending admin-invited user
  // by matching the email. Falls through to 'unlinked' when there is no
  // candidate, preserving the legacy POST /users bootstrap path.
  if (!user && deps.autoLinkPendingUserByEmail) {
    user = await deps.autoLinkPendingUserByEmail(
      input.session.provider,
      input.session.subject,
    );
  }

  if (!user) {
    return {
      kind: "unlinked",
      statusCode: 409,
      error: "identity_not_linked",
      provider: input.session.provider,
      subject: input.session.subject,
    };
  }

  if (user.status !== "active") {
    return {
      kind: "inactive",
      statusCode: 403,
      error: "account_inactive",
      status: user.status,
      userId: user.id,
      provider: input.session.provider,
      subject: input.session.subject,
    };
  }

  if (input.requestedUserId && input.requestedUserId !== user.id) {
    return {
      kind: "forbidden",
      statusCode: 403,
      error: "client_identity_mismatch",
      userId: user.id,
      requestedUserId: input.requestedUserId,
      provider: input.session.provider,
      subject: input.session.subject,
    };
  }

  return {
    kind: "linked",
    user,
    provider: input.session.provider,
    subject: input.session.subject,
  };
}
