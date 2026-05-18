import {
  createRemoteJWKSet,
  errors as JoseErrors,
  jwtVerify,
  type JWTPayload,
} from "jose";

export type McpOAuthVerifyError =
  | "invalid_token"
  | "token_expired"
  | "invalid_audience";

export type McpOAuthVerifiedClaims = {
  subject: string;
  clientId: string;
  scopes: Array<string>;
  audience: string;
};

export type McpOAuthVerifyResult =
  | {
      kind: "verified";
      claims: McpOAuthVerifiedClaims;
    }
  | {
      kind: "invalid";
      error: McpOAuthVerifyError;
    };

type JwksKey = Parameters<typeof jwtVerify>[1];

const remoteJwksCache = new Map<string, JwksKey>();

function configuredIssuer(): string | null {
  const issuer = process.env.MCP_AUTHORIZATION_SERVER_ISSUER?.trim();
  if (!issuer) return null;

  try {
    return new URL(issuer).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function configuredAudience(): string | null {
  const audience = process.env.MCP_RESOURCE_URL?.trim();
  if (!audience) return null;

  try {
    return new URL(audience).toString();
  } catch {
    return null;
  }
}

function jwksForIssuer(issuer: string): JwksKey {
  const cached = remoteJwksCache.get(issuer);
  if (cached) return cached;

  const jwks = createRemoteJWKSet(new URL("/oauth2/jwks", issuer));
  remoteJwksCache.set(issuer, jwks);
  return jwks;
}

function readStringClaim(payload: JWTPayload, names: Array<string>): string | null {
  for (const name of names) {
    const value = payload[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readScopes(payload: JWTPayload): Array<string> {
  const scopes = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string") {
      for (const scope of value.split(/\s+/).map((part) => part.trim()).filter(Boolean)) {
        scopes.add(scope);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) {
          scopes.add(item.trim());
        }
      }
    }
  };

  add(payload.scope);
  add(payload.scp);
  add(payload.scopes);
  add(payload.permissions);

  return [...scopes];
}

function claimMatchesAudience(value: unknown, expectedAudience: string): boolean {
  if (typeof value === "string") {
    return value === expectedAudience;
  }

  if (Array.isArray(value)) {
    return value.some((item) => item === expectedAudience);
  }

  return false;
}

function hasExpectedAudience(payload: JWTPayload, expectedAudience: string): boolean {
  return (
    claimMatchesAudience(payload.aud, expectedAudience) ||
    claimMatchesAudience(payload.resource, expectedAudience)
  );
}

function claimsFromPayload(
  payload: JWTPayload,
  expectedAudience: string,
): McpOAuthVerifyResult {
  if (!hasExpectedAudience(payload, expectedAudience)) {
    return { kind: "invalid", error: "invalid_audience" };
  }

  const subject = readStringClaim(payload, ["external_id", "externalId"]) ?? payload.sub;
  const clientId = readStringClaim(payload, ["client_id", "azp", "cid"]);
  const scopes = readScopes(payload);

  if (!subject || !clientId || scopes.length === 0) {
    return { kind: "invalid", error: "invalid_token" };
  }

  return {
    kind: "verified",
    claims: {
      subject,
      clientId,
      scopes,
      audience: expectedAudience,
    },
  };
}

export async function verifyMcpOAuthJwt(input: {
  token: string;
  issuer: string;
  audience: string;
  key: JwksKey;
  now?: Date;
}): Promise<McpOAuthVerifyResult> {
  try {
    const { payload } = await jwtVerify(input.token, input.key, {
      issuer: input.issuer,
      currentDate: input.now,
    });

    return claimsFromPayload(payload, input.audience);
  } catch (err) {
    if (err instanceof JoseErrors.JWTExpired) {
      return { kind: "invalid", error: "token_expired" };
    }
    return { kind: "invalid", error: "invalid_token" };
  }
}

export async function verifyMcpOAuthBearerToken(input: {
  token: string;
  issuer?: string;
  audience?: string;
  now?: Date;
}): Promise<McpOAuthVerifyResult> {
  const issuer = input.issuer ?? configuredIssuer();
  const audience = input.audience ?? configuredAudience();

  if (!issuer || !audience) {
    return { kind: "invalid", error: "invalid_token" };
  }

  return verifyMcpOAuthJwt({
    token: input.token,
    issuer,
    audience,
    key: jwksForIssuer(issuer),
    now: input.now,
  });
}
