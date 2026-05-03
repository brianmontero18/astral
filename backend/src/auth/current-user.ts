import type { FastifyReply } from "fastify";
import SuperTokens from "supertokens-node";
import {
  findUserByEmail,
  findUserByIdentity,
  getUserIdentity,
  linkIdentity,
} from "../db.js";
import {
  resolveCurrentUser,
  type AuthenticatedAppUser,
  type AuthSessionPrincipal,
  type ResolveCurrentUserResult,
} from "./identity.js";
import {
  getOptionalSessionPrincipal,
  type AuthenticatedRequest,
} from "./session.js";

async function fetchProviderEmail(
  provider: AuthSessionPrincipal["provider"],
  subject: string,
): Promise<string | null> {
  if (provider !== "supertokens") {
    return null;
  }

  try {
    const stUser = await SuperTokens.getUser(subject);
    return stUser?.emails?.[0] ?? null;
  } catch {
    return null;
  }
}

async function autoLinkPendingUserByEmail(
  provider: AuthSessionPrincipal["provider"],
  subject: string,
): Promise<{
  user: AuthenticatedAppUser | null;
  providerEmail: string | null;
}> {
  const providerEmail = await fetchProviderEmail(provider, subject);
  if (!providerEmail) return { user: null, providerEmail: null };

  const candidate = await findUserByEmail(providerEmail);
  if (!candidate) return { user: null, providerEmail };

  // Only admin-provisioned rows participate in auto-link. A self-signup
  // user that ended up with the same email but never finished POST /users
  // would have no row at all; if a row exists with access_source='self',
  // it belongs to a different identity already linked elsewhere.
  if (candidate.access_source !== "manual") {
    return { user: null, providerEmail };
  }

  const existingIdentity = await getUserIdentity(candidate.id);
  if (existingIdentity) return { user: null, providerEmail };

  await linkIdentity(provider, subject, candidate.id);
  return { user: candidate, providerEmail };
}

export async function resolveRequestCurrentUser(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  requestedUserId?: string | null,
): Promise<ResolveCurrentUserResult> {
  return resolveCurrentUser(
    {
      session: await getOptionalSessionPrincipal(request, reply),
      requestedUserId,
    },
    {
      findUserByIdentity: async (provider, subject) =>
        (await findUserByIdentity(provider, subject)) ?? null,
      autoLinkPendingUserByEmail,
    },
  );
}

export function sendCurrentUserError(
  reply: FastifyReply,
  currentUser: Exclude<ResolveCurrentUserResult, { kind: "linked" }>,
) {
  if (currentUser.kind === "anonymous") {
    return reply.status(currentUser.statusCode).send({
      error: currentUser.error,
    });
  }

  if (currentUser.kind === "unlinked") {
    return reply.status(currentUser.statusCode).send({
      error: currentUser.error,
      provider: currentUser.provider,
      subject: currentUser.subject,
    });
  }

  if (currentUser.kind === "inactive") {
    return reply.status(currentUser.statusCode).send({
      error: currentUser.error,
      status: currentUser.status,
      provider: currentUser.provider,
      subject: currentUser.subject,
    });
  }

  return reply.status(currentUser.statusCode).send({
    error: currentUser.error,
    userId: currentUser.userId,
    requestedUserId: currentUser.requestedUserId,
    provider: currentUser.provider,
    subject: currentUser.subject,
  });
}
