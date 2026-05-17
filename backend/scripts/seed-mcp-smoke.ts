import { randomBytes } from "node:crypto";
import {
  createMcpClient,
  createMcpConsent,
  createMcpToken,
  createUser,
  initDb,
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
  scopes: ["mcp:ask", "mcp:read_hd", "mcp:read_transits"],
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
  scopes: ["mcp:ask", "mcp:read_hd", "mcp:read_transits"],
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

console.log(JSON.stringify({
  userId,
  clientId,
  tokens: {
    valid,
    noConsent,
    wrongAudience,
    expired,
    revoked,
    readOnly,
  },
}));
