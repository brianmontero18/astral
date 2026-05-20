import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  ensureUserIdentity,
  getUser,
  type AppUserRecord,
} from "../db.js";
import {
  resolveRequestCurrentUser,
  sendCurrentUserError,
} from "../auth/current-user.js";
import type { AuthenticatedRequest } from "../auth/session.js";
import { isRemoteMcpPlan } from "../mcp/policy.js";

const WORKOS_COMPLETE_URL = "https://api.workos.com/authkit/oauth2/complete";

interface WorkosConnectQuery {
  external_auth_id?: string;
}

interface WorkosCompleteResponse {
  redirect_uri?: unknown;
}

function readWorkosApiKey(): string | null {
  const apiKey = process.env.WORKOS_API_KEY?.trim();
  return apiKey || null;
}

function redirectToAuth(request: FastifyRequest, reply: FastifyReply) {
  const requestUrl = request.raw.url ?? request.url;
  const search = new URLSearchParams({ redirectToPath: requestUrl });
  return reply.redirect(`/auth?${search.toString()}`);
}

function splitName(name: string): { firstName: string; lastName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "Astral";
  const lastName = parts.slice(1).join(" ");
  return lastName ? { firstName, lastName } : { firstName };
}

function buildWorkosUser(user: AppUserRecord) {
  if (!user.email) {
    return null;
  }

  const { firstName, lastName } = splitName(user.name);
  return {
    id: user.id,
    email: user.email,
    first_name: firstName,
    ...(lastName ? { last_name: lastName } : {}),
  };
}

async function completeWorkosOAuth(input: {
  apiKey: string;
  externalAuthId: string;
  user: NonNullable<ReturnType<typeof buildWorkosUser>>;
}): Promise<{ redirectUri: string } | { error: string; statusCode: 502 | 503 }> {
  let response: Response;
  try {
    response = await fetch(WORKOS_COMPLETE_URL, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        external_auth_id: input.externalAuthId,
        user: input.user,
      }),
    });
  } catch {
    return { statusCode: 502, error: "workos_complete_unreachable" };
  }

  if (!response.ok) {
    return { statusCode: 502, error: "workos_complete_failed" };
  }

  let payload: WorkosCompleteResponse;
  try {
    payload = await response.json() as WorkosCompleteResponse;
  } catch {
    return { statusCode: 502, error: "workos_complete_invalid_response" };
  }

  if (typeof payload.redirect_uri !== "string") {
    return { statusCode: 502, error: "workos_complete_missing_redirect" };
  }

  try {
    const redirectUri = new URL(payload.redirect_uri);
    if (redirectUri.protocol !== "https:") {
      return { statusCode: 502, error: "workos_complete_invalid_redirect" };
    }
    return { redirectUri: redirectUri.toString() };
  } catch {
    return { statusCode: 502, error: "workos_complete_invalid_redirect" };
  }
}

export async function workosConnectRoutes(app: FastifyInstance) {
  app.get<{ Querystring: WorkosConnectQuery }>(
    "/auth/workos/connect",
    async (request, reply) => {
      const externalAuthId = request.query.external_auth_id?.trim();
      if (!externalAuthId) {
        return reply.status(400).send({ error: "external_auth_id_required" });
      }

      const currentUser = await resolveRequestCurrentUser(
        request as AuthenticatedRequest,
        reply,
      );

      if (reply.sent) {
        return;
      }

      if (currentUser.kind === "anonymous") {
        return redirectToAuth(request, reply);
      }

      if (currentUser.kind !== "linked") {
        return sendCurrentUserError(reply, currentUser);
      }

      const user = await getUser(currentUser.user.id);
      if (!user) {
        return reply.status(409).send({
          error: "identity_not_linked",
          provider: currentUser.provider,
          subject: currentUser.subject,
        });
      }

      if (user.onboarding_status !== "complete") {
        return reply.status(403).send({ error: "onboarding_required" });
      }

      if (!isRemoteMcpPlan(user.plan)) {
        return reply.status(403).send({
          error: "plan_upgrade_required",
          requiredPlan: "basic",
        });
      }

      const workosUser = buildWorkosUser(user);
      if (!workosUser) {
        return reply.status(409).send({ error: "identity_email_required" });
      }

      const apiKey = readWorkosApiKey();
      if (!apiKey) {
        return reply.status(503).send({ error: "workos_api_key_not_configured" });
      }

      const identityResult = await ensureUserIdentity("workos", user.id, user.id);
      if (identityResult === "conflict") {
        return reply.status(409).send({ error: "workos_identity_conflict" });
      }

      const completed = await completeWorkosOAuth({
        apiKey,
        externalAuthId,
        user: workosUser,
      });

      if ("error" in completed) {
        return reply.status(completed.statusCode).send({ error: completed.error });
      }

      return reply.redirect(completed.redirectUri);
    },
  );
}
