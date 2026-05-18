import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import {
  createMcpClient,
  createMcpConsent,
  createMcpToken,
  createUserWithIdentity,
  type AppUserStatus,
  type McpConsentRecord,
  type McpTokenAuthRecord,
} from "../db.js";
import {
  hashMcpBearerToken,
  MCP_AUDIENCE,
  resolveMcpPrincipal,
  type ResolveMcpPrincipalDeps,
} from "../mcp/auth.js";
import { createTestApp, createTestUser } from "./helpers.js";

const NOW = new Date("2026-05-17T12:00:00.000Z");
const FUTURE = "2026-05-17T13:00:00.000Z";
const PAST = "2026-05-17T11:00:00.000Z";
const RAW_TOKEN = "astral_mcp_test_token";
const RAW_OAUTH_TOKEN = "header.payload.signature";
const OAUTH_AUDIENCE = "https://astral.soydanielamedina.com/api/mcp/v1";

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

function makeTokenRecord(
  overrides: Partial<McpTokenAuthRecord> = {},
): McpTokenAuthRecord {
  return {
    id: "token-1",
    token_hash: hashMcpBearerToken(RAW_TOKEN),
    user_id: "user-1",
    client_id: "client-1",
    scopes_json: JSON.stringify(["mcp:ask", "mcp:read_hd"]),
    audience: MCP_AUDIENCE,
    expires_at: FUTURE,
    revoked_at: null,
    created_at: "2026-05-17T10:00:00.000Z",
    user_status: "active",
    client_status: "active",
    ...overrides,
  };
}

function makeConsentRecord(
  overrides: Partial<McpConsentRecord> = {},
): McpConsentRecord {
  return {
    id: "consent-1",
    user_id: "user-1",
    client_id: "client-1",
    scopes_json: JSON.stringify(["mcp:ask", "mcp:read_hd"]),
    status: "active",
    created_at: "2026-05-17T10:00:00.000Z",
    revoked_at: null,
    ...overrides,
  };
}

async function seedDbAccess(input: {
  tokenScopes?: Array<string>;
  consentScopes?: Array<string>;
  userStatus?: AppUserStatus;
  clientStatus?: "active" | "disabled";
  audience?: string;
  expiresAt?: string;
  revokedAt?: string | null;
  consentStatus?: "active" | "revoked";
  consentRevokedAt?: string | null;
} = {}): Promise<{ userId: string; clientId: string; tokenId: string }> {
  app = await createTestApp();
  const userId = await createTestUser(app, "MCP User", undefined, {
    status: input.userStatus ?? "active",
  });
  const clientId = await createMcpClient({
    id: "claude-code-beta",
    name: "Claude Code Beta",
    status: input.clientStatus ?? "active",
  });

  if (input.consentScopes) {
    await createMcpConsent({
      userId,
      clientId,
      scopes: input.consentScopes,
      status: input.consentStatus ?? "active",
      revokedAt: input.consentRevokedAt ?? null,
    });
  }

  const tokenId = await createMcpToken({
    tokenHash: hashMcpBearerToken(RAW_TOKEN),
    userId,
    clientId,
    scopes: input.tokenScopes ?? ["mcp:ask"],
    audience: input.audience ?? MCP_AUDIENCE,
    expiresAt: input.expiresAt ?? FUTURE,
    revokedAt: input.revokedAt ?? null,
  });

  return { userId, clientId, tokenId };
}

async function seedDbOAuthAccess(input: {
  subject?: string;
  clientId?: string;
  consentScopes?: Array<string>;
  userStatus?: AppUserStatus;
  clientStatus?: "active" | "disabled";
} = {}): Promise<{ userId: string; clientId: string; subject: string }> {
  app = await createTestApp();
  const subject = input.subject ?? "workos-user-1";
  const clientId = input.clientId ?? "client_workos_mcp";
  const userId = await createUserWithIdentity(
    "WorkOS User",
    {
      humanDesign: {
        type: "Generator",
        strategy: "Respond",
        authority: "Sacral",
        profile: "2/4",
        channels: [],
        activatedGates: [{ number: 1 }],
        definedCenters: ["Sacral"],
        undefinedCenters: ["Head"],
      },
    },
    "workos",
    subject,
    {
      status: input.userStatus ?? "active",
      email: "workos-user@astral.test",
    },
  );
  await createMcpClient({
    id: clientId,
    name: "WorkOS Astral MCP",
    status: input.clientStatus ?? "active",
  });
  await createMcpConsent({
    userId,
    clientId,
    scopes: input.consentScopes ?? ["mcp:ask", "mcp:read_hd"],
  });

  return { userId, clientId, subject };
}

describe("resolveMcpPrincipal", () => {
  it("hashes the bearer token before lookup and never passes raw token material to deps", async () => {
    let receivedHash: string | null = null;
    const deps: Partial<ResolveMcpPrincipalDeps> = {
      findTokenByHash: async (tokenHash) => {
        receivedHash = tokenHash;
        return makeTokenRecord({ token_hash: tokenHash });
      },
      findActiveConsent: async () => makeConsentRecord(),
    };

    const result = await resolveMcpPrincipal(
      {
        authorizationHeader: `Bearer ${RAW_TOKEN}`,
        requiredScopes: ["mcp:ask"],
        now: NOW,
      },
      deps,
    );

    expect(result.kind).toBe("authorized");
    expect(receivedHash).toBe(hashMcpBearerToken(RAW_TOKEN));
    expect(receivedHash).not.toBe(RAW_TOKEN);
  });

  it("authorizes an active token with matching audience, scope, user, client, and consent", async () => {
    const seeded = await seedDbAccess({
      tokenScopes: ["mcp:ask", "mcp:read_hd"],
      consentScopes: ["mcp:ask", "mcp:read_hd"],
    });

    await expect(
      resolveMcpPrincipal({
        authorizationHeader: `Bearer ${RAW_TOKEN}`,
        requiredScopes: ["mcp:ask"],
        now: NOW,
      }),
    ).resolves.toEqual({
      kind: "authorized",
      principal: {
        userId: seeded.userId,
        clientId: seeded.clientId,
        scopes: ["mcp:ask", "mcp:read_hd"],
        audience: MCP_AUDIENCE,
        tokenId: seeded.tokenId,
      },
    });
  });

  it("authorizes a valid WorkOS OAuth token mapped to an Astral user identity", async () => {
    const seeded = await seedDbOAuthAccess();

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_OAUTH_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          oauthAudience: OAUTH_AUDIENCE,
          now: NOW,
        },
        {
          findTokenByHash: async () => null,
          verifyOAuthToken: async ({ token, audience }) => {
            expect(token).toBe(RAW_OAUTH_TOKEN);
            expect(audience).toBe(OAUTH_AUDIENCE);
            return {
              kind: "verified",
              claims: {
                subject: seeded.subject,
                clientId: seeded.clientId,
                scopes: ["mcp:ask", "mcp:read_hd"],
                audience: OAUTH_AUDIENCE,
              },
            };
          },
        },
      ),
    ).resolves.toEqual({
      kind: "authorized",
      principal: {
        userId: seeded.userId,
        clientId: seeded.clientId,
        scopes: ["mcp:ask", "mcp:read_hd"],
        audience: OAUTH_AUDIENCE,
        tokenId: null,
      },
    });
  });

  it("keeps PAT beta precedence before trying WorkOS OAuth verification", async () => {
    let oauthChecks = 0;
    const seeded = await seedDbAccess({
      tokenScopes: ["mcp:ask"],
      consentScopes: ["mcp:ask"],
    });

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          now: NOW,
        },
        {
          verifyOAuthToken: async () => {
            oauthChecks += 1;
            return { kind: "invalid", error: "invalid_token" };
          },
        },
      ),
    ).resolves.toMatchObject({
      kind: "authorized",
      principal: {
        userId: seeded.userId,
        tokenId: seeded.tokenId,
      },
    });
    expect(oauthChecks).toBe(0);
  });

  it("rejects WorkOS OAuth tokens with the wrong resource audience", async () => {
    await seedDbOAuthAccess();

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_OAUTH_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          oauthAudience: OAUTH_AUDIENCE,
          now: NOW,
        },
        {
          findTokenByHash: async () => null,
          verifyOAuthToken: async () => ({ kind: "invalid", error: "invalid_audience" }),
        },
      ),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 401,
      error: "invalid_audience",
    });
  });

  it("rejects WorkOS OAuth tokens without the requested MCP scope", async () => {
    const seeded = await seedDbOAuthAccess();

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_OAUTH_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          oauthAudience: OAUTH_AUDIENCE,
          now: NOW,
        },
        {
          findTokenByHash: async () => null,
          verifyOAuthToken: async () => ({
            kind: "verified",
            claims: {
              subject: seeded.subject,
              clientId: seeded.clientId,
              scopes: ["mcp:read_hd"],
              audience: OAUTH_AUDIENCE,
            },
          }),
        },
      ),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 403,
      error: "insufficient_scope",
    });
  });

  it("requires a linked WorkOS identity before accepting an OAuth token", async () => {
    const seeded = await seedDbOAuthAccess();

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_OAUTH_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          oauthAudience: OAUTH_AUDIENCE,
          now: NOW,
        },
        {
          findTokenByHash: async () => null,
          verifyOAuthToken: async () => ({
            kind: "verified",
            claims: {
              subject: "different-workos-user",
              clientId: seeded.clientId,
              scopes: ["mcp:ask"],
              audience: OAUTH_AUDIENCE,
            },
          }),
        },
      ),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 403,
      error: "consent_required",
    });
  });

  it("requires active MCP consent for WorkOS OAuth client scopes", async () => {
    const seeded = await seedDbOAuthAccess({
      consentScopes: ["mcp:read_hd"],
    });

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_OAUTH_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          oauthAudience: OAUTH_AUDIENCE,
          now: NOW,
        },
        {
          findTokenByHash: async () => null,
          verifyOAuthToken: async () => ({
            kind: "verified",
            claims: {
              subject: seeded.subject,
              clientId: seeded.clientId,
              scopes: ["mcp:ask", "mcp:read_hd"],
              audience: OAUTH_AUDIENCE,
            },
          }),
        },
      ),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 403,
      error: "consent_required",
    });
  });

  it("rejects WorkOS OAuth tokens mapped to inactive Astral users", async () => {
    const seeded = await seedDbOAuthAccess({
      userStatus: "disabled",
    });

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_OAUTH_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          oauthAudience: OAUTH_AUDIENCE,
          now: NOW,
        },
        {
          findTokenByHash: async () => null,
          verifyOAuthToken: async () => ({
            kind: "verified",
            claims: {
              subject: seeded.subject,
              clientId: seeded.clientId,
              scopes: ["mcp:ask"],
              audience: OAUTH_AUDIENCE,
            },
          }),
        },
      ),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 403,
      error: "account_inactive",
    });
  });

  it("rejects WorkOS OAuth tokens for disabled MCP clients", async () => {
    const seeded = await seedDbOAuthAccess({
      clientStatus: "disabled",
    });

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_OAUTH_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          oauthAudience: OAUTH_AUDIENCE,
          now: NOW,
        },
        {
          findTokenByHash: async () => null,
          verifyOAuthToken: async () => ({
            kind: "verified",
            claims: {
              subject: seeded.subject,
              clientId: seeded.clientId,
              scopes: ["mcp:ask"],
              audience: OAUTH_AUDIENCE,
            },
          }),
        },
      ),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 403,
      error: "client_inactive",
    });
  });

  it("requires a bearer token", async () => {
    await expect(
      resolveMcpPrincipal({ requiredScopes: ["mcp:ask"], now: NOW }),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 401,
      error: "authentication_required",
    });
  });

  it("rejects expired tokens", async () => {
    await seedDbAccess({
      consentScopes: ["mcp:ask"],
      expiresAt: PAST,
    });

    await expect(
      resolveMcpPrincipal({
        authorizationHeader: `Bearer ${RAW_TOKEN}`,
        requiredScopes: ["mcp:ask"],
        now: NOW,
      }),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 401,
      error: "token_expired",
    });
  });

  it("rejects revoked tokens", async () => {
    await seedDbAccess({
      consentScopes: ["mcp:ask"],
      revokedAt: "2026-05-17T11:30:00.000Z",
    });

    await expect(
      resolveMcpPrincipal({
        authorizationHeader: `Bearer ${RAW_TOKEN}`,
        requiredScopes: ["mcp:ask"],
        now: NOW,
      }),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 401,
      error: "token_revoked",
    });
  });

  it("rejects wrong audience before checking consent", async () => {
    let consentChecks = 0;
    const deps: Partial<ResolveMcpPrincipalDeps> = {
      findTokenByHash: async () => makeTokenRecord({ audience: "astral-web" }),
      findActiveConsent: async () => {
        consentChecks += 1;
        return makeConsentRecord();
      },
    };

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          now: NOW,
        },
        deps,
      ),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 401,
      error: "invalid_audience",
    });
    expect(consentChecks).toBe(0);
  });

  it("rejects insufficient token scope before checking consent", async () => {
    let consentChecks = 0;
    const deps: Partial<ResolveMcpPrincipalDeps> = {
      findTokenByHash: async () => makeTokenRecord({ scopes_json: JSON.stringify(["mcp:read_hd"]) }),
      findActiveConsent: async () => {
        consentChecks += 1;
        return makeConsentRecord();
      },
    };

    await expect(
      resolveMcpPrincipal(
        {
          authorizationHeader: `Bearer ${RAW_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          now: NOW,
        },
        deps,
      ),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 403,
      error: "insufficient_scope",
    });
    expect(consentChecks).toBe(0);
  });

  it("requires active consent with the requested scopes", async () => {
    await seedDbAccess({
      tokenScopes: ["mcp:ask", "mcp:read_hd"],
      consentScopes: ["mcp:read_hd"],
    });

    await expect(
      resolveMcpPrincipal({
        authorizationHeader: `Bearer ${RAW_TOKEN}`,
        requiredScopes: ["mcp:ask"],
        now: NOW,
      }),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 403,
      error: "consent_required",
    });
  });

  it("rejects tokens when no active consent exists for the client and user", async () => {
    await seedDbAccess({
      tokenScopes: ["mcp:ask"],
    });

    await expect(
      resolveMcpPrincipal({
        authorizationHeader: `Bearer ${RAW_TOKEN}`,
        requiredScopes: ["mcp:ask"],
        now: NOW,
      }),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 403,
      error: "consent_required",
    });
  });

  it.each(["disabled", "banned"] satisfies Array<AppUserStatus>)(
    "rejects %s Astral users",
    async (userStatus) => {
      await seedDbAccess({
        userStatus,
        consentScopes: ["mcp:ask"],
      });

      await expect(
        resolveMcpPrincipal({
          authorizationHeader: `Bearer ${RAW_TOKEN}`,
          requiredScopes: ["mcp:ask"],
          now: NOW,
        }),
      ).resolves.toMatchObject({
        kind: "unauthorized",
        statusCode: 403,
        error: "account_inactive",
      });
    },
  );

  it("rejects disabled MCP clients", async () => {
    await seedDbAccess({
      clientStatus: "disabled",
      consentScopes: ["mcp:ask"],
    });

    await expect(
      resolveMcpPrincipal({
        authorizationHeader: `Bearer ${RAW_TOKEN}`,
        requiredScopes: ["mcp:ask"],
        now: NOW,
      }),
    ).resolves.toMatchObject({
      kind: "unauthorized",
      statusCode: 403,
      error: "client_inactive",
    });
  });
});
