import type { FastifyReply, FastifyRequest } from "fastify";
import { verifySession } from "supertokens-node/recipe/session/framework/fastify";
import type { SessionRequest } from "supertokens-node/framework/fastify";
import type { AuthSessionPrincipal } from "./identity.js";
import { readSuperTokensConfig } from "./config.js";

export { verifySession };

export type AuthenticatedRequest = SessionRequest<FastifyRequest>;

export function getValidatedSessionPrincipal(
  request: AuthenticatedRequest,
): AuthSessionPrincipal | null {
  if (!request.session) {
    return null;
  }

  return {
    provider: "supertokens",
    subject: request.session.getUserId(),
  };
}

export async function getOptionalSessionPrincipal(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<AuthSessionPrincipal | null> {
  if (!readSuperTokensConfig().enabled) {
    return null;
  }

  await verifySession({ sessionRequired: false })(request, reply);

  if (reply.sent) {
    return null;
  }

  return getValidatedSessionPrincipal(request);
}
