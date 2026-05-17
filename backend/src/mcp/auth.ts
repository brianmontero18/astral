import { createHash } from "node:crypto";
import {
  findActiveMcpConsent,
  findMcpTokenAuthRecordByHash,
  type McpConsentRecord,
  type McpTokenAuthRecord,
} from "../db.js";

export const MCP_AUDIENCE = "astral-mcp";

export type McpScope =
  | "mcp:ask"
  | "mcp:read_hd"
  | "mcp:read_transits"
  | "mcp:read_profile_summary"
  | "mcp:read_personal_impact";

export interface McpPrincipal {
  userId: string;
  clientId: string;
  scopes: Array<string>;
  audience: string;
  tokenId: string;
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
  now?: Date;
}

export interface ResolveMcpPrincipalDeps {
  findTokenByHash(tokenHash: string): Promise<McpTokenAuthRecord | null>;
  findActiveConsent(userId: string, clientId: string): Promise<McpConsentRecord | null>;
}

const defaultDeps: ResolveMcpPrincipalDeps = {
  findTokenByHash: findMcpTokenAuthRecordByHash,
  findActiveConsent: findActiveMcpConsent,
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

export async function resolveMcpPrincipal(
  input: ResolveMcpPrincipalInput,
  deps: ResolveMcpPrincipalDeps = defaultDeps,
): Promise<ResolveMcpPrincipalResult> {
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

  const token = await deps.findTokenByHash(hashMcpBearerToken(bearerToken));
  if (!token) {
    return {
      kind: "unauthorized",
      statusCode: 401,
      error: "invalid_token",
      requiredScopes,
    };
  }

  if (token.revoked_at) {
    return {
      kind: "unauthorized",
      statusCode: 401,
      error: "token_revoked",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    };
  }

  if (hasExpired(token.expires_at, now)) {
    return {
      kind: "unauthorized",
      statusCode: 401,
      error: "token_expired",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    };
  }

  if (token.audience !== expectedAudience) {
    return {
      kind: "unauthorized",
      statusCode: 401,
      error: "invalid_audience",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    };
  }

  const tokenScopes = parseScopes(token.scopes_json);
  if (!tokenScopes) {
    return {
      kind: "unauthorized",
      statusCode: 401,
      error: "invalid_token",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    };
  }

  if (!includesAllScopes(tokenScopes, requiredScopes)) {
    return {
      kind: "unauthorized",
      statusCode: 403,
      error: "insufficient_scope",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    };
  }

  if (token.client_status !== "active") {
    return {
      kind: "unauthorized",
      statusCode: 403,
      error: "client_inactive",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    };
  }

  if (token.user_status !== "active") {
    return {
      kind: "unauthorized",
      statusCode: 403,
      error: "account_inactive",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    };
  }

  const consent = await deps.findActiveConsent(token.user_id, token.client_id);
  const consentScopes = consent ? parseScopes(consent.scopes_json) : null;
  if (!consentScopes || !includesAllScopes(consentScopes, requiredScopes)) {
    return {
      kind: "unauthorized",
      statusCode: 403,
      error: "consent_required",
      tokenId: token.id,
      userId: token.user_id,
      clientId: token.client_id,
      requiredScopes,
    };
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
