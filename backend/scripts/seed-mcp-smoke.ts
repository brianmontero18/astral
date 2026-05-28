import { randomBytes } from "node:crypto";
import {
  createMcpClient,
  createMcpConsent,
  createMcpToken,
  createUser,
  initDb,
  insertMcpAuditEvent,
} from "../src/db.js";
import { hashMcpBearerToken, MCP_AUDIENCE } from "../src/mcp/auth.js";

function newToken(label: string): string {
  return `astral_mcp_smoke_${label}_${randomBytes(16).toString("hex")}`;
}

async function seedToken(input: {
  label: string;
  userId: string;
  clientId: string;
  scopes?: Array<string>;
  audience?: string;
  expiresAt?: string;
  revokedAt?: string | null;
}): Promise<{ label: string; token: string; tokenId: string }> {
  const token = newToken(input.label);
  const tokenId = await createMcpToken({
    tokenHash: hashMcpBearerToken(token),
    userId: input.userId,
    clientId: input.clientId,
    scopes: input.scopes ?? ["mcp:ask"],
    audience: input.audience ?? MCP_AUDIENCE,
    expiresAt:
      input.expiresAt ??
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    revokedAt: input.revokedAt ?? null,
  });

  return {
    label: input.label,
    token,
    tokenId,
  };
}

await initDb();

const profile = {
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
};

const userId = await createUser("MCP Smoke User", profile, {
  email: "mcp-smoke@astral.test",
  plan: "premium",
});
const clientId = await createMcpClient({
  id: `mcp-smoke-client-${Date.now()}`,
  name: "MCP Smoke Client",
});
await createMcpConsent({
  userId,
  clientId,
  scopes: ["mcp:ask", "mcp:read_hd", "mcp:write_bodygraph"],
});

const noConsentUserId = await createUser("MCP No Consent User", profile, {
  email: "mcp-smoke-no-consent@astral.test",
  plan: "premium",
});
const noConsentClientId = await createMcpClient({
  id: `mcp-smoke-no-consent-client-${Date.now()}`,
  name: "MCP Smoke No Consent Client",
});

const valid = await seedToken({
  label: "valid",
  userId,
  clientId,
  scopes: ["mcp:ask", "mcp:read_hd", "mcp:write_bodygraph"],
});
const noConsent = await seedToken({
  label: "no_consent",
  userId: noConsentUserId,
  clientId: noConsentClientId,
});
const wrongAudience = await seedToken({
  label: "wrong_audience",
  userId,
  clientId,
  audience: "astral-web",
});
const expired = await seedToken({
  label: "expired",
  userId,
  clientId,
  expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
});
const revoked = await seedToken({
  label: "revoked",
  userId,
  clientId,
  revokedAt: new Date().toISOString(),
});
const readOnly = await seedToken({
  label: "read_only",
  userId,
  clientId,
  scopes: ["mcp:read_hd"],
});
const askOnly = await seedToken({
  label: "ask_only",
  userId,
  clientId,
  scopes: ["mcp:ask"],
});

const quotaUserId = await createUser("MCP Quota Smoke User", profile, {
  email: "mcp-smoke-quota@astral.test",
  plan: "premium",
});
const quotaClientId = await createMcpClient({
  id: `mcp-smoke-quota-client-${Date.now()}`,
  name: "MCP Smoke Quota Client",
});
await createMcpConsent({
  userId: quotaUserId,
  clientId: quotaClientId,
  scopes: ["mcp:ask"],
});
const quotaExceeded = await seedToken({
  label: "quota_exceeded",
  userId: quotaUserId,
  clientId: quotaClientId,
  scopes: ["mcp:ask"],
});
for (let i = 0; i < 300; i += 1) {
  await insertMcpAuditEvent({
    userId: quotaUserId,
    clientId: quotaClientId,
    tokenId: quotaExceeded.tokenId,
    event: "tool_call_completed",
    toolName: "ask_astral_guide_v1",
    sideEffectsMode: "mcp_read_only",
    status: "success",
  });
}

console.log(JSON.stringify({
  userId,
  clientId,
  quotaUserId,
  quotaClientId,
  tokens: {
    valid,
    noConsent,
    wrongAudience,
    expired,
    revoked,
    readOnly,
    askOnly,
    quotaExceeded,
  },
}));
