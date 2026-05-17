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

  it.each(["GET", "PUT", "PATCH", "DELETE"])(
    "rejects %s requests because Streamable HTTP messages use POST",
    async (method) => {
      const harness = await buildMcpTestApp(true);

      const res = await harness.app.inject({
        method,
        url: "/api/mcp/v1",
        headers: {
          accept: "application/json, text/event-stream",
        },
      });

      expect(res.statusCode).toBe(405);
      expect(JSON.parse(res.body)).toEqual({
        error: "method_not_allowed",
      });
    },
  );

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

  it("accepts protocol media types case-insensitively and rejects lookalike media types", async () => {
    const harness = await buildMcpTestApp(true);
    await harness.seedAccess();

    const accepted = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: {
        authorization: `Bearer ${RAW_TOKEN}`,
        accept: "Application/JSON; charset=utf-8, Text/Event-Stream",
        "content-type": "application/json",
      },
      payload: jsonRpcBody("ping"),
    });
    expect(accepted.statusCode).toBe(200);

    const rejected = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: {
        authorization: `Bearer ${RAW_TOKEN}`,
        accept: "application/jsonl, text/event-stream",
        "content-type": "application/json",
      },
      payload: jsonRpcBody("ping"),
    });
    expect(rejected.statusCode).toBe(406);
    expect(JSON.parse(rejected.body)).toEqual({
      error: "not_acceptable",
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
    const body = JSON.parse(res.body) as {
      error: { data?: Record<string, unknown> };
    };
    expect(body.error.data).not.toHaveProperty("userId");
    expect(body.error.data).not.toHaveProperty("clientId");
    expect(body.error.data).not.toHaveProperty("tokenId");
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

  it("keeps tools/call disabled even for consented clients without mcp:ask scope", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const userId = await db.createUser("MCP Read Only User", {
      humanDesign: {
        type: "Projector",
      },
    });
    const clientId = await db.createMcpClient({
      id: "read-only-beta",
      name: "Read Only Beta",
    });
    await db.createMcpConsent({
      userId,
      clientId,
      scopes: ["mcp:read_hd"],
    });
    await db.createMcpToken({
      tokenHash: hashMcpBearerToken(RAW_TOKEN),
      userId,
      clientId,
      scopes: ["mcp:read_hd"],
      audience: MCP_AUDIENCE,
      expiresAt: futureExpiry(),
    });

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
