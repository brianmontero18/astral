import { describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT } from "jose";

import { verifyMcpOAuthJwt } from "../mcp/oauth.js";

const ISSUER = "https://thoughtful-trinket-33-staging.authkit.app";
const AUDIENCE = "https://astral.soydanielamedina.com/api/mcp/v1";
const NOW = new Date("2026-05-18T12:00:00.000Z");

async function signedToken(
  claims: Record<string, unknown> = {},
  input: { issuer?: string; expiresAt?: number } = {},
) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const token = await new SignJWT({
    aud: AUDIENCE,
    client_id: "client_workos_mcp",
    scope: "openid profile mcp:ask mcp:read_hd",
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(input.issuer ?? ISSUER)
    .setSubject("workos-user-1")
    .setIssuedAt(Math.floor(NOW.getTime() / 1000))
    .setExpirationTime(input.expiresAt ?? Math.floor(NOW.getTime() / 1000) + 3600)
    .sign(privateKey);

  return { token, publicKey };
}

describe("verifyMcpOAuthJwt", () => {
  it("verifies issuer, signature, audience, client id, subject, and MCP scopes", async () => {
    const { token, publicKey } = await signedToken();

    await expect(
      verifyMcpOAuthJwt({
        token,
        issuer: ISSUER,
        audience: AUDIENCE,
        key: publicKey,
        now: NOW,
      }),
    ).resolves.toEqual({
      kind: "verified",
      claims: {
        subject: "workos-user-1",
        clientId: "client_workos_mcp",
        scopes: ["openid", "profile", "mcp:ask", "mcp:read_hd"],
        audience: AUDIENCE,
      },
    });
  });

  it("accepts resource claim audience when aud is absent", async () => {
    const { token, publicKey } = await signedToken({
      aud: undefined,
      resource: AUDIENCE,
      permissions: ["mcp:ask"],
    });

    await expect(
      verifyMcpOAuthJwt({
        token,
        issuer: ISSUER,
        audience: AUDIENCE,
        key: publicKey,
        now: NOW,
      }),
    ).resolves.toMatchObject({
      kind: "verified",
      claims: {
        scopes: expect.arrayContaining(["mcp:ask"]),
      },
    });
  });

  it("rejects the wrong issuer", async () => {
    const { token, publicKey } = await signedToken({}, {
      issuer: "https://evil.example.test",
    });

    await expect(
      verifyMcpOAuthJwt({
        token,
        issuer: ISSUER,
        audience: AUDIENCE,
        key: publicKey,
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "invalid", error: "invalid_token" });
  });

  it("rejects the wrong audience/resource", async () => {
    const { token, publicKey } = await signedToken({
      aud: "https://other.example.test/api/mcp/v1",
    });

    await expect(
      verifyMcpOAuthJwt({
        token,
        issuer: ISSUER,
        audience: AUDIENCE,
        key: publicKey,
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "invalid", error: "invalid_audience" });
  });

  it("maps expired tokens to token_expired", async () => {
    const { token, publicKey } = await signedToken({}, {
      expiresAt: Math.floor(NOW.getTime() / 1000) - 1,
    });

    await expect(
      verifyMcpOAuthJwt({
        token,
        issuer: ISSUER,
        audience: AUDIENCE,
        key: publicKey,
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "invalid", error: "token_expired" });
  });

  it("rejects tokens missing client id or scopes", async () => {
    const { token, publicKey } = await signedToken({
      client_id: undefined,
      scope: undefined,
    });

    await expect(
      verifyMcpOAuthJwt({
        token,
        issuer: ISSUER,
        audience: AUDIENCE,
        key: publicKey,
        now: NOW,
      }),
    ).resolves.toEqual({ kind: "invalid", error: "invalid_token" });
  });
});
