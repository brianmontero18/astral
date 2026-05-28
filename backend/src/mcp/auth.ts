import { createHash } from "node:crypto";
import {
  findUserByIdentity,
  findActiveMcpConsent,
  ensureMcpClient,
  findMcpClientAuthRecord,
  findMcpTokenAuthRecordByHash,
  upsertActiveMcpConsent,
  type AppUserOnboardingStatus,
  type AppUserPlan,
  type AppUserRecord,
  type McpClientAuthRecord,
  type McpConsentRecord,
  type McpTokenAuthRecord,
} from "../db.js";
import {
  verifyMcpOAuthBearerToken,
  type McpOAuthVerifyResult,
} from "./oauth.js";
import {
  allowedMcpScopesForPlan,
  isRemoteMcpPlan,
  planAllowsMcpScopes,
} from "./policy.js";

export const MCP_AUDIENCE = "astral-mcp";

export type McpScope =
  | "mcp:ask"
  | "mcp:read_hd"
  | "mcp:write_bodygraph"
  | "mcp:read_transits"
  | "mcp:read_profile_summary"
  | "mcp:read_personal_impact";

export interface McpPrincipal {
  userId: string;
  clientId: string;
  scopes: Array<string>;
  audience: string;
  tokenId: string | null;
}

export type McpAuthError =
  | "authentication_required"
  | "invalid_token"
  | "token_expired"
  | "token_revoked"
  | "invalid_audience"
  | "insufficient_scope"
  | "client_inactive"
  | "account_inactive"
  | "onboarding_required"
  | "plan_upgrade_required"
  | "consent_required";

export type ResolveMcpPrincipalResult =
  | {
      kind: "authorized";
      principal: McpPrincipal;
    }
  | {
      kind: "unauthorized";
      statusCode: 401 | 403;
      error: McpAuthError;
      tokenId?: string;
      userId?: string;
      clientId?: string;
      requiredScopes?: Array<string>;
    };

interface ResolveMcpPrincipalInput {
  authorizationHeader?: string | Array<string> | null;
  requiredScopes?: ReadonlyArray<string>;
  audience?: string;
  oauthAudience?: string;
  now?: Date;
}

export interface ResolveMcpPrincipalDeps {
  findTokenByHash(tokenHash: string): Promise<McpTokenAuthRecord | null>;
  findActiveConsent(userId: string, clientId: string): Promise<McpConsentRecord | null>;
  findUserIdentity(provider: string, providerUserId: string): Promise<AppUserRecord | undefined>;
  findClientById(clientId: string): Promise<McpClientAuthRecord | null>;
  ensureClient(input: { id: string; name: string }): Promise<McpClientAuthRecord>;
  upsertActiveConsent(input: {
    userId: string;
    clientId: string;
    scopes: Array<string>;
  }): Promise<string>;
  verifyOAuthToken(input: {
    token: string;
    audience?: string;
    now?: Date;
  }): Promise<McpOAuthVerifyResult>;
}

const defaultDeps: ResolveMcpPrincipalDeps = {
  findTokenByHash: findMcpTokenAuthRecordByHash,
  findActiveConsent: findActiveMcpConsent,
  findUserIdentity: findUserByIdentity,
  findClientById: findMcpClientAuthRecord,
  ensureClient: (input) => ensureMcpClient(input),
  upsertActiveConsent: upsertActiveMcpConsent,
  verifyOAuthToken: verifyMcpOAuthBearerToken,
};

export function hashMcpBearerToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function readBearerToken(
  authorizationHeader?: string | Array<string> | null,
): string | null {
  const header = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

function parseScopes(scopesJson: string): Array<string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(scopesJson);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;
  if (!parsed.every((scope): scope is string => typeof scope === "string")) {
    return null;
  }

  return parsed;
}

function includesAllScopes(
  grantedScopes: ReadonlyArray<string>,
  requiredScopes: ReadonlyArray<string>,
): boolean {
  const granted = new Set(grantedScopes);
  return requiredScopes.every((scope) => granted.has(scope));
}

function hasExpired(expiresAt: string, now: Date): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return true;
  return expiresAtMs <= now.getTime();
}

function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

function unauthorized(input: {
  statusCode: 401 | 403;
  error: McpAuthError;
  requiredScopes: Array<string>;
  tokenId?: string | null;
  userId?: string;
  clientId?: string;
}): Exclude<ResolveMcpPrincipalResult, { kind: "authorized" }> {
  return {
    kind: "unauthorized",
    statusCode: input.statusCode,
    error: input.error,
    tokenId: input.tokenId ?? undefined,
    userId: input.userId,
    clientId: input.clientId,
    requiredScopes: input.requiredScopes,
  };
}

function userPolicyError(input: {
  plan: AppUserPlan;
  onboardingStatus: AppUserOnboardingStatus;
  requiredScopes: Array<string>;
  tokenId?: string | null;
  userId: string;
  clientId: string;
}): Exclude<ResolveMcpPrincipalResult, { kind: "authorized" }> | null {
  if (input.onboardingStatus === "pending") {
    return unauthorized({
      statusCode: 403,
      error: "onboarding_required",
      tokenId: input.tokenId,
      userId: input.userId,
      clientId: input.clientId,
      requiredScopes: input.requiredScopes,
    });
  }

  if (!isRemoteMcpPlan(input.plan)) {
    return unauthorized({
      statusCode: 403,
      error: "plan_upgrade_required",
      tokenId: input.tokenId,
      userId: input.userId,
      clientId: input.clientId,
      requiredScopes: input.requiredScopes,
    });
  }

  if (!planAllowsMcpScopes(input.plan, input.requiredScopes)) {
    return unauthorized({
      statusCode: 403,
      error: "plan_upgrade_required",
      tokenId: input.tokenId,
      userId: input.userId,
      clientId: input.clientId,
      requiredScopes: input.requiredScopes,
    });
  }

  return null;
}

async function resolvePatPrincipal(input: {
  token: McpTokenAuthRecord;
  expectedAudience: string;
  requiredScopes: Array<string>;
  now: Date;
  deps: ResolveMcpPrincipalDeps;
}): Promise<ResolveMcpPrincipalResult> {
  const { token, expectedAudience, requiredScopes, now, deps } = input;

  if (token.revoked_at) {
    return unauthorized({
      statusCode: 401,
      error: "token_revoked",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    });
  }

  if (hasExpired(token.expires_at, now)) {
    return unauthorized({
      statusCode: 401,
      error: "token_expired",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    });
  }

  if (token.audience !== expectedAudience) {
    return unauthorized({
      statusCode: 401,
      error: "invalid_audience",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    });
  }

  const tokenScopes = parseScopes(token.scopes_json);
  if (!tokenScopes) {
    return unauthorized({
      statusCode: 401,
      error: "invalid_token",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    });
  }

  if (!includesAllScopes(tokenScopes, requiredScopes)) {
    return unauthorized({
      statusCode: 403,
      error: "insufficient_scope",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    });
  }

  if (token.client_status !== "active") {
    return unauthorized({
      statusCode: 403,
      error: "client_inactive",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    });
  }

  if (token.user_status !== "active") {
    return unauthorized({
      statusCode: 403,
      error: "account_inactive",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    });
  }

  const policyError = userPolicyError({
    plan: token.user_plan,
    onboardingStatus: token.user_onboarding_status,
    requiredScopes,
    tokenId: token.id,
    userId: token.user_id,
    clientId: token.client_id,
  });
  if (policyError) {
    return policyError;
  }

  const consent = await deps.findActiveConsent(token.user_id, token.client_id);
  const consentScopes = consent ? parseScopes(consent.scopes_json) : null;
  if (!consentScopes || !includesAllScopes(consentScopes, requiredScopes)) {
    return unauthorized({
      statusCode: 403,
      error: "consent_required",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    });
  }

  return {
    kind: "authorized",
    principal: {
      userId: token.user_id,
      clientId: token.client_id,
      scopes: tokenScopes,
      audience: token.audience,
      tokenId: token.id,
    },
  };
}

async function resolveOAuthPrincipal(input: {
  bearerToken: string;
  requiredScopes: Array<string>;
  oauthAudience?: string;
  now: Date;
  deps: ResolveMcpPrincipalDeps;
}): Promise<ResolveMcpPrincipalResult> {
  const { bearerToken, requiredScopes, oauthAudience, now, deps } = input;

  if (!looksLikeJwt(bearerToken)) {
    return unauthorized({
      statusCode: 401,
      error: "invalid_token",
      requiredScopes,
    });
  }

  const verified = await deps.verifyOAuthToken({
    token: bearerToken,
    audience: oauthAudience,
    now,
  });

  if (verified.kind !== "verified") {
    return unauthorized({
      statusCode: 401,
      error: verified.error,
      requiredScopes,
    });
  }

  const user = await deps.findUserIdentity("workos", verified.claims.subject);
  if (!user) {
    return unauthorized({
      statusCode: 403,
      error: "consent_required",
      clientId: verified.claims.clientId,
      requiredScopes,
    });
  }

  if (user.status !== "active") {
    return unauthorized({
      statusCode: 403,
      error: "account_inactive",
      userId: user.id,
      clientId: verified.claims.clientId,
      requiredScopes,
    });
  }

  const policyError = userPolicyError({
    plan: user.plan,
    onboardingStatus: user.onboarding_status,
    requiredScopes,
    tokenId: null,
    userId: user.id,
    clientId: verified.claims.clientId,
  });
  if (policyError) {
    return policyError;
  }

  const existingClient = await deps.findClientById(verified.claims.clientId);
  const client =
    existingClient ??
    await deps.ensureClient({
      id: verified.claims.clientId,
      name: `WorkOS OAuth client ${verified.claims.clientId}`,
    });
  if (client.status !== "active") {
    return unauthorized({
      statusCode: 403,
      error: "client_inactive",
      userId: user.id,
      clientId: verified.claims.clientId,
      requiredScopes,
    });
  }

  const allowedScopes = allowedMcpScopesForPlan(user.plan);
  await deps.upsertActiveConsent({
    userId: user.id,
    clientId: verified.claims.clientId,
    scopes: allowedScopes,
  });

  const consent = await deps.findActiveConsent(user.id, verified.claims.clientId);
  const consentScopes = consent ? parseScopes(consent.scopes_json) : null;
  if (!consentScopes || !includesAllScopes(consentScopes, requiredScopes)) {
    return unauthorized({
      statusCode: 403,
      error: "consent_required",
      userId: user.id,
      clientId: verified.claims.clientId,
      requiredScopes,
    });
  }

  return {
    kind: "authorized",
    principal: {
      userId: user.id,
      clientId: verified.claims.clientId,
      scopes: allowedScopes,
      audience: verified.claims.audience,
      tokenId: null,
    },
  };
}

export async function resolveMcpPrincipal(
  input: ResolveMcpPrincipalInput,
  deps: Partial<ResolveMcpPrincipalDeps> = {},
): Promise<ResolveMcpPrincipalResult> {
  const resolvedDeps: ResolveMcpPrincipalDeps = { ...defaultDeps, ...deps };
  const requiredScopes = [...(input.requiredScopes ?? [])];
  const expectedAudience = input.audience ?? MCP_AUDIENCE;
  const now = input.now ?? new Date();
  const bearerToken = readBearerToken(input.authorizationHeader);

  if (!bearerToken) {
    return {
      kind: "unauthorized",
      statusCode: 401,
      error: "authentication_required",
      requiredScopes,
    };
  }

  const token = await resolvedDeps.findTokenByHash(hashMcpBearerToken(bearerToken));
  if (token) {
    return resolvePatPrincipal({
      token,
      expectedAudience,
      requiredScopes,
      now,
      deps: resolvedDeps,
    });
  }

  return resolveOAuthPrincipal({
    bearerToken,
    requiredScopes,
    oauthAudience: input.oauthAudience,
    now,
    deps: resolvedDeps,
  });
}
