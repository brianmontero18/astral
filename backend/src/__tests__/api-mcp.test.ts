import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { hashMcpBearerToken, MCP_AUDIENCE } from "../mcp/auth.js";

const RAW_TOKEN = "astral_mcp_route_token";

let app: FastifyInstance | null = null;
const originalRemoteMcpFlag = process.env.FEATURE_REMOTE_MCP;

afterEach(async () => {
  await app?.close();
  app = null;
  if (originalRemoteMcpFlag === undefined) {
    delete process.env.FEATURE_REMOTE_MCP;
  } else {
    process.env.FEATURE_REMOTE_MCP = originalRemoteMcpFlag;
  }
  vi.resetModules();
});

async function buildMcpTestApp(flagEnabled: boolean): Promise<{
  app: FastifyInstance;
  seedAccess(): Promise<void>;
}> {
  process.env.FEATURE_REMOTE_MCP = flagEnabled ? "true" : "false";
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.OPENAI_API_KEY ??= "test-key-not-real";
  vi.resetModules();

  const [{ buildApp }, db] = await Promise.all([
    import("../app.js"),
    import("../db.js"),
  ]);

  await db.initDb();
  app = await buildApp({ logger: false });
  await app.ready();

  return {
    app,
    seedAccess: async () => {
      const userId = await db.createUser("MCP Route User", {
        humanDesign: {
          type: "Generator",
        },
      });
      const clientId = await db.createMcpClient({
        id: "claude-code-beta",
        name: "Claude Code Beta",
      });
      await db.createMcpConsent({
        userId,
        clientId,
        scopes: ["mcp:ask"],
      });
      await db.createMcpToken({
        tokenHash: hashMcpBearerToken(RAW_TOKEN),
        userId,
        clientId,
        scopes: ["mcp:ask"],
        audience: MCP_AUDIENCE,
        expiresAt: futureExpiry(),
      });
    },
  };
}

function jsonRpcBody(method: string, id: string = "req-1") {
  return {
    jsonrpc: "2.0",
    id,
    method,
  };
}

function mcpHeaders(token: string = RAW_TOKEN) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  };
}

function futureExpiry(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

describe("Remote MCP route", () => {
  it("does not register /api/mcp/v1 while FEATURE_REMOTE_MCP is false", async () => {
    const harness = await buildMcpTestApp(false);

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: jsonRpcBody("initialize"),
    });

    expect(res.statusCode).toBe(404);
  });

  it("requires bearer auth before initialize", async () => {
    const harness = await buildMcpTestApp(true);

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      payload: jsonRpcBody("initialize"),
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        message: "authentication_required",
      },
    });
  });

  it("blocks authenticated tokens without active MCP consent", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const userId = await db.createUser("MCP No Consent User", {
      humanDesign: {
        type: "Generator",
      },
    });
    const clientId = await db.createMcpClient({
      id: "codex-beta",
      name: "Codex Beta",
    });
    await db.createMcpToken({
      tokenHash: hashMcpBearerToken(RAW_TOKEN),
      userId,
      clientId,
      scopes: ["mcp:ask"],
      audience: MCP_AUDIENCE,
      expiresAt: futureExpiry(),
    });

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: jsonRpcBody("initialize"),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        message: "consent_required",
      },
    });
  });

  it("initializes and lists zero tools for an authenticated consented beta client", async () => {
    const harness = await buildMcpTestApp(true);
    await harness.seedAccess();

    const initializeRes = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: jsonRpcBody("initialize"),
    });
    expect(initializeRes.statusCode).toBe(200);
    expect(JSON.parse(initializeRes.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: {
          name: "astral-guide-remote-mcp",
        },
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
      },
    });

    const toolsRes = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: jsonRpcBody("tools/list", "req-2"),
    });
    expect(toolsRes.statusCode).toBe(200);
    expect(JSON.parse(toolsRes.body)).toEqual({
      jsonrpc: "2.0",
      id: "req-2",
      result: {
        tools: [],
      },
    });
  });

  it("acknowledges notifications without a JSON-RPC response body", async () => {
    const harness = await buildMcpTestApp(true);
    await harness.seedAccess();

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      },
    });

    expect(res.statusCode).toBe(202);
    expect(res.body).toBe("");
  });

  it("does not enable tools/call in the transport slice", async () => {
    const harness = await buildMcpTestApp(true);
    await harness.seedAccess();

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: jsonRpcBody("tools/call"),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        code: -32601,
        message: "Method not found",
      },
    });
  });

  it("rejects browser origins that do not match the request host", async () => {
    const harness = await buildMcpTestApp(true);
    await harness.seedAccess();

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: {
        ...mcpHeaders(),
        host: "astral.guide",
        origin: "https://evil.example",
      },
      payload: jsonRpcBody("initialize"),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "origin_not_allowed",
    });
  });
});
