import type { FastifyReply } from "fastify";
import { findUserByIdentity } from "../db.js";
import { resolveCurrentUser, type ResolveCurrentUserResult } from "./identity.js";
import {
  getOptionalSessionPrincipal,
  type AuthenticatedRequest,
} from "./session.js";

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
