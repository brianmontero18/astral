import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { hashMcpBearerToken, MCP_AUDIENCE } from "../mcp/auth.js";
import type { ChatMessage } from "../types/agent.js";

const RAW_TOKEN = "astral_mcp_route_token";

let app: FastifyInstance | null = null;
const originalRemoteMcpFlag = process.env.FEATURE_REMOTE_MCP;
const originalMcpTestReply = process.env.MCP_ASK_ASTRAL_GUIDE_TEST_REPLY;
const originalMcpResourceUrl = process.env.MCP_RESOURCE_URL;
const originalMcpAuthorizationServerIssuer = process.env.MCP_AUTHORIZATION_SERVER_ISSUER;

const runAstralAgentV2Mock = vi.fn();
const runAstralAgentStreamV2Mock = vi.fn();
const runMemoryWriterMock = vi.fn();
const analyzeTransitImpactMock = vi.fn();
const getTransitSnapshotCachedMock = vi.fn();

function mockAgentResult(content: string) {
  return {
    content,
    usage: { promptTokens: 11, completionTokens: 7, cachedTokens: 0 },
    latencyMs: 5,
    systemPrompt: "TEST_MCP_PROMPT",
  };
}

vi.mock("../llm/model-config.js", () => ({
  hashSystemPrompt: (s: string) => s.slice(0, 16),
  CHAT_MODEL: "gpt-4o-mini",
  CHAT_SIMPLE_MODEL: "gpt-4o-mini",
  CHAT_COMPLEX_MODEL: "gpt-4o-mini",
}));

vi.mock("../agent-service-v2.js", () => ({
  runAstralAgentV2: runAstralAgentV2Mock,
  runAstralAgentStreamV2: runAstralAgentStreamV2Mock,
}));

vi.mock("../memory-writer.js", async () => {
  const actual = await vi.importActual<typeof import("../memory-writer.js")>("../memory-writer.js");

  return {
    ...actual,
    runMemoryWriter: runMemoryWriterMock,
  };
});

vi.mock("../transit-service.js", async () => {
  const actual = await vi.importActual<typeof import("../transit-service.js")>("../transit-service.js");

  return {
    ...actual,
    analyzeTransitImpact: analyzeTransitImpactMock,
    getTransitSnapshotCached: getTransitSnapshotCachedMock,
  };
});

afterEach(async () => {
  await app?.close();
  app = null;
  if (originalRemoteMcpFlag === undefined) {
    delete process.env.FEATURE_REMOTE_MCP;
  } else {
    process.env.FEATURE_REMOTE_MCP = originalRemoteMcpFlag;
  }
  if (originalMcpTestReply === undefined) {
    delete process.env.MCP_ASK_ASTRAL_GUIDE_TEST_REPLY;
  } else {
    process.env.MCP_ASK_ASTRAL_GUIDE_TEST_REPLY = originalMcpTestReply;
  }
  if (originalMcpResourceUrl === undefined) {
    delete process.env.MCP_RESOURCE_URL;
  } else {
    process.env.MCP_RESOURCE_URL = originalMcpResourceUrl;
  }
  if (originalMcpAuthorizationServerIssuer === undefined) {
    delete process.env.MCP_AUTHORIZATION_SERVER_ISSUER;
  } else {
    process.env.MCP_AUTHORIZATION_SERVER_ISSUER = originalMcpAuthorizationServerIssuer;
  }
  runAstralAgentV2Mock.mockReset();
  runAstralAgentStreamV2Mock.mockReset();
  runMemoryWriterMock.mockReset();
  analyzeTransitImpactMock.mockReset();
  getTransitSnapshotCachedMock.mockReset();
  vi.resetModules();
});

const MOCK_TRANSIT_SNAPSHOT = {
  id: "instant:2026-05-17T00:00:00.000Z",
  targetAt: "2026-05-17T00:00:00.000Z",
  calculatedAt: "2026-05-17T00:00:01.000Z",
  label: "Ahora",
  collective: {
    planets: [],
    activatedGates: [],
    activatedChannels: [],
    activatedCenters: [],
    temporarilyDefinedCenters: [],
  },
};

const MOCK_IMPACT = {
  personalChannels: [],
  conditionedCenters: [],
  reinforcedGates: [],
  educationalChannels: [],
};

function testProfile(name: string, type: string = "Generator") {
  return {
    name,
    humanDesign: {
      type,
      strategy: "Respond",
      authority: "Sacral",
      profile: "2/4",
      definition: "Single Definition",
      incarnationCross: "Right Angle Cross of Explanation",
      notSelfTheme: "Frustration",
      variable: "",
      digestion: "",
      environment: "",
      strongestSense: "",
      channels: [],
      activatedGates: [{ number: 1, line: 1, planet: "Sun", isPersonality: true }],
      definedCenters: ["Sacral"],
      undefinedCenters: ["Head"],
    },
  };
}

async function buildMcpTestApp(flagEnabled: boolean): Promise<{
  app: FastifyInstance;
  seedAccess(): Promise<void>;
}> {
  process.env.FEATURE_REMOTE_MCP = flagEnabled ? "true" : "false";
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.OPENAI_API_KEY ??= "test-key-not-real";
  process.env.MCP_RESOURCE_URL = "https://mcp.astral.test/api/mcp/v1";
  process.env.MCP_AUTHORIZATION_SERVER_ISSUER = "https://auth.astral.test";
  vi.resetModules();

  const [{ buildApp }, db] = await Promise.all([
    import("../app.js"),
    import("../db.js"),
  ]);

  await db.initDb();
  app = await buildApp({ logger: false });
  await app.ready();
  getTransitSnapshotCachedMock.mockResolvedValue(MOCK_TRANSIT_SNAPSHOT);
  analyzeTransitImpactMock.mockReturnValue(MOCK_IMPACT);

  return {
    app,
    seedAccess: async () => {
      await seedMcpAccess(db);
    },
  };
}

async function seedMcpAccess(
  db: typeof import("../db.js"),
  input: {
    rawToken?: string;
    userName?: string;
    profile?: object;
    tokenScopes?: Array<string>;
    consentScopes?: Array<string>;
    userStatus?: "active" | "disabled" | "banned";
    clientStatus?: "active" | "disabled";
    intake?: object | null;
    memory?: string;
  } = {},
): Promise<{ userId: string; clientId: string; rawToken: string }> {
  const rawToken = input.rawToken ?? RAW_TOKEN;
  const profile = input.profile ?? testProfile(input.userName ?? "MCP Route User");
  const userId = await db.createUser(input.userName ?? "MCP Route User", profile, {
    status: input.userStatus ?? "active",
    plan: "premium",
  });
  if (input.intake !== undefined) {
    await db.updateUserProfile(userId, input.userName ?? "MCP Route User", profile, input.intake);
  }
  if (input.memory !== undefined) {
    await db.updateUserMemory(userId, input.memory);
  }
  const clientId = await db.createMcpClient({
    id: `mcp-test-client-${Math.random().toString(16).slice(2)}`,
    name: "MCP Test Client",
    status: input.clientStatus ?? "active",
  });
  await db.createMcpConsent({
    userId,
    clientId,
    scopes: input.consentScopes ?? ["mcp:ask"],
  });
  await db.createMcpToken({
    tokenHash: hashMcpBearerToken(rawToken),
    userId,
    clientId,
    scopes: input.tokenScopes ?? ["mcp:ask"],
    audience: MCP_AUDIENCE,
    expiresAt: futureExpiry(),
  });

  return { userId, clientId, rawToken };
}

function jsonRpcBody(method: string, id: string = "req-1") {
  return {
    jsonrpc: "2.0",
    id,
    method,
  };
}

function toolsCallBody(
  name: string,
  args: Record<string, unknown>,
  id: string = "req-1",
) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
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

  it("does not register MCP OAuth discovery while FEATURE_REMOTE_MCP is false", async () => {
    const harness = await buildMcpTestApp(false);

    const res = await harness.app.inject({
      method: "GET",
      url: "/.well-known/oauth-protected-resource",
    });

    expect(res.statusCode).toBe(404);
  });

  it("serves protected resource metadata for MCP OAuth discovery", async () => {
    const harness = await buildMcpTestApp(true);

    for (const url of [
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/api/mcp/v1",
    ]) {
      const res = await harness.app.inject({
        method: "GET",
        url,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(JSON.parse(res.body)).toEqual({
        resource: "https://mcp.astral.test/api/mcp/v1",
        authorization_servers: ["https://auth.astral.test"],
        bearer_methods_supported: ["header"],
        scopes_supported: ["openid", "profile", "email", "offline_access"],
      });
    }
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
    expect(res.headers["www-authenticate"]).toContain(
      'resource_metadata="https://mcp.astral.test/.well-known/oauth-protected-resource"',
    );
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        message: "authentication_required",
      },
    });
  });

  it("accepts ChatGPT-style octet-stream JSON payloads", async () => {
    const harness = await buildMcpTestApp(true);

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/octet-stream",
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
    }, {
      plan: "premium",
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

  it("initializes and lists ask_astral_guide_v1 for a consented client with mcp:ask", async () => {
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
    const toolsBody = JSON.parse(toolsRes.body);
    expect(toolsBody).toEqual({
      jsonrpc: "2.0",
      id: "req-2",
      result: {
        tools: [
          expect.objectContaining({
            name: "ask_astral_guide_v1",
            description: expect.stringContaining("Astral Guide"),
            inputSchema: expect.objectContaining({
              type: "object",
              required: ["question"],
            }),
          }),
        ],
      },
    });
    const toolNames = toolsBody.result.tools.map((tool: { name: string }) => tool.name);
    expect(toolNames).not.toContain("find_channel_by_gates_v1");
    expect(toolNames).not.toContain("find_channels_by_gate_v1");
    expect(toolNames).not.toContain("get_center_for_gate_v1");
  });

  it("lists deterministic HD tools, but not ask_astral_guide_v1, for a read-only mcp:read_hd client", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    await seedMcpAccess(db, {
      tokenScopes: ["mcp:read_hd"],
      consentScopes: ["mcp:read_hd"],
    });

    const toolsRes = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: jsonRpcBody("tools/list", "req-2"),
    });

    expect(toolsRes.statusCode).toBe(200);
    const body = JSON.parse(toolsRes.body);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe("req-2");
    const toolNames = body.result.tools.map((tool: { name: string }) => tool.name).sort();
    expect(toolNames).toEqual([
      "find_channel_by_gates_v1",
      "find_channels_by_gate_v1",
      "get_center_for_gate_v1",
    ]);
    expect(toolNames).not.toContain("ask_astral_guide_v1");
    expect(body.result.tools).toContainEqual(
      expect.objectContaining({
        name: "find_channel_by_gates_v1",
        inputSchema: expect.objectContaining({
          type: "object",
          required: ["gateA", "gateB"],
        }),
      }),
    );
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

  it("calls ask_astral_guide_v1 with the user derived from the bearer token", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const tokenProfile = testProfile("Token Owner", "Generator");
    const overrideProfile = testProfile("Injected Owner", "Projector");
    const { userId } = await seedMcpAccess(db, {
      userName: "Token Owner",
      profile: tokenProfile,
      intake: { actividad: "Astrology mentor", desafio_actual: "Focus" },
      memory: "Verified memory from database.",
    });
    const otherUserId = await db.createUser("Injected Owner", overrideProfile, {
      plan: "premium",
    });
    runAstralAgentV2Mock.mockResolvedValueOnce(mockAgentResult("Respuesta MCP"));

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("ask_astral_guide_v1", {
        question: "Que energia hay disponible?",
        userId: otherUserId,
        profile: overrideProfile,
        intake: { actividad: "Injected activity" },
        memory: "Injected memory",
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      jsonrpc: "2.0",
      id: "req-1",
      result: {
        content: [
          {
            type: "text",
            text: "Respuesta MCP",
          },
        ],
        structuredContent: {
          transits_used: "2026-05-17T00:00:00.000Z",
        },
      },
    });
    expect(runAstralAgentV2Mock).toHaveBeenCalledTimes(1);
    expect(runAstralAgentV2Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Token Owner",
        humanDesign: expect.objectContaining({ type: "Generator" }),
      }),
      expect.any(Object),
      [{ role: "user", content: "Que energia hay disponible?" }] satisfies ChatMessage[],
      "test-key-not-real",
      MOCK_IMPACT,
      { actividad: "Astrology mentor", desafio_actual: "Focus" },
      "Verified memory from database.",
      expect.objectContaining({
        selection: expect.objectContaining({ reason: "full_history_fits" }),
      }),
      { model: "gpt-4o-mini" },
    );

    const messages = await db.getChatMessages(userId);
    expect(messages).toEqual([]);
    expect(await db.getUserMessageCount(userId)).toBe(1);
    const auditEvents = await db.getMcpAuditEventsForUser(userId);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        user_id: userId,
        event: "tool_call_started",
        tool_name: "ask_astral_guide_v1",
        side_effects_mode: "mcp_read_only",
        status: "success",
      }),
      expect.objectContaining({
        user_id: userId,
        event: "tool_call_completed",
        tool_name: "ask_astral_guide_v1",
        side_effects_mode: "mcp_read_only",
        status: "success",
      }),
    ]);
    const usage = await db.getLlmUsageForUser(userId, "1970-01-01T00:00:00.000Z");
    expect(usage.byRoute).toContainEqual(
      expect.objectContaining({
        route: "mcp_ask",
        callCount: 1,
        tokensIn: 11,
        tokensOut: 7,
      }),
    );
    expect(usage.byRoute).not.toContainEqual(
      expect.objectContaining({
        route: "chat",
      }),
    );
    expect(runMemoryWriterMock).not.toHaveBeenCalled();
  });

  it("does not write chat_messages or trigger memory_writer for ask_astral_guide_v1", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const { userId } = await seedMcpAccess(db, {
      memory: "Persistent memory should be read, not mutated.",
    });
    runAstralAgentV2Mock.mockResolvedValueOnce(mockAgentResult("Read-only reply"));

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("ask_astral_guide_v1", {
        question: "Respondeme sin persistir",
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).result.content[0].text).toBe("Read-only reply");
    expect(await db.getChatMessages(userId)).toEqual([]);
    expect(runMemoryWriterMock).not.toHaveBeenCalled();
  });

  it("returns a controlled MCP error when ask_astral_guide_v1 is called without mcp:ask", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const { userId, clientId } = await seedMcpAccess(db, {
      tokenScopes: ["mcp:read_hd"],
      consentScopes: ["mcp:read_hd"],
    });

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("ask_astral_guide_v1", {
        question: "hello",
      }),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        code: -32006,
        message: "insufficient_scope",
        data: {
          requiredScopes: ["mcp:ask"],
        },
      },
    });
    expect(runAstralAgentV2Mock).not.toHaveBeenCalled();

    const auditEvents = await db.getMcpAuditEventsForUser(userId);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        user_id: userId,
        client_id: clientId,
        event: "tool_call_blocked",
        tool_name: "ask_astral_guide_v1",
        status: "denied",
        metadata: { reason: "insufficient_scope" },
      }),
    ]);
  });

  it("calls deterministic HD tools with mcp:read_hd without invoking agents, chat persistence, or memory writer", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const { userId } = await seedMcpAccess(db, {
      tokenScopes: ["mcp:read_hd"],
      consentScopes: ["mcp:read_hd"],
    });

    const channelRes = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("find_channel_by_gates_v1", {
        gateA: 8,
        gateB: 1,
      }),
    });
    const channelsRes = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("find_channels_by_gate_v1", {
        gate: 10,
      }, "req-2"),
    });
    const centerRes = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("get_center_for_gate_v1", {
        gate: 1,
      }, "req-3"),
    });

    expect(channelRes.statusCode).toBe(200);
    const channelBody = JSON.parse(channelRes.body);
    expect(channelBody).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      result: {
        content: [
          {
            type: "text",
            text: expect.any(String),
          },
        ],
        structuredContent: {
          channel: {
            id: "1-8",
            name: "Canal de Inspiración",
            gates: [1, 8],
            circuit: "Individual",
            subCircuit: "Knowing",
          },
        },
      },
    });
    expect(JSON.parse(channelBody.result.content[0].text)).toEqual(
      channelBody.result.structuredContent,
    );
    expect(JSON.parse(channelsRes.body).result.structuredContent.channels.map(
      (channel: { id: string }) => channel.id,
    ).sort()).toEqual(["10-20", "10-34", "10-57"]);
    expect(JSON.parse(centerRes.body)).toMatchObject({
      result: {
        structuredContent: {
          gate: 1,
          center: "G",
        },
      },
    });

    expect(runAstralAgentV2Mock).not.toHaveBeenCalled();
    expect(runMemoryWriterMock).not.toHaveBeenCalled();
    expect(await db.getChatMessages(userId)).toEqual([]);
  });

  it("returns null when find_channel_by_gates_v1 receives valid gates that do not form a channel", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    await seedMcpAccess(db, {
      tokenScopes: ["mcp:read_hd"],
      consentScopes: ["mcp:read_hd"],
    });

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("find_channel_by_gates_v1", {
        gateA: 8,
        gateB: 20,
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      result: {
        structuredContent: {
          channel: null,
        },
      },
    });
  });

  it("writes started and completed audit events for deterministic HD tools", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const { userId, clientId } = await seedMcpAccess(db, {
      tokenScopes: ["mcp:read_hd"],
      consentScopes: ["mcp:read_hd"],
    });

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("get_center_for_gate_v1", {
        gate: 1,
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(await db.getMcpAuditEventsForUser(userId)).toEqual([
      expect.objectContaining({
        user_id: userId,
        client_id: clientId,
        event: "tool_call_started",
        tool_name: "get_center_for_gate_v1",
        side_effects_mode: "mcp_read_only",
        status: "success",
      }),
      expect.objectContaining({
        user_id: userId,
        client_id: clientId,
        event: "tool_call_completed",
        tool_name: "get_center_for_gate_v1",
        side_effects_mode: "mcp_read_only",
        status: "success",
      }),
    ]);
  });

  it("returns a controlled MCP error when deterministic HD tools are called without mcp:read_hd", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const { userId, clientId } = await seedMcpAccess(db);

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("get_center_for_gate_v1", {
        gate: 1,
      }),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        code: -32006,
        message: "insufficient_scope",
        data: {
          requiredScopes: ["mcp:read_hd"],
        },
      },
    });
    expect(runAstralAgentV2Mock).not.toHaveBeenCalled();

    expect(await db.getMcpAuditEventsForUser(userId)).toEqual([
      expect.objectContaining({
        user_id: userId,
        client_id: clientId,
        event: "tool_call_blocked",
        tool_name: "get_center_for_gate_v1",
        status: "denied",
        metadata: { reason: "insufficient_scope" },
      }),
    ]);
  });

  it("blocks deterministic HD tools before execution when MCP budget is exhausted", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const { userId, clientId } = await seedMcpAccess(db, {
      tokenScopes: ["mcp:read_hd"],
      consentScopes: ["mcp:read_hd"],
    });

    for (let i = 0; i < 100; i += 1) {
      await db.insertMcpAuditEvent({
        userId,
        clientId,
        event: "tool_call_completed",
        toolName: "get_center_for_gate_v1",
        sideEffectsMode: "mcp_read_only",
        status: "success",
      });
    }

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("get_center_for_gate_v1", {
        gate: 1,
      }),
    });

    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        code: -32011,
        message: "budget_exceeded",
        data: {
          period: "day",
          limit: 100,
          used: 100,
        },
      },
    });
    expect(runAstralAgentV2Mock).not.toHaveBeenCalled();
    const auditEvents = await db.getMcpAuditEventsForUser(userId);
    expect(auditEvents.at(-1)).toMatchObject({
      user_id: userId,
      client_id: clientId,
      event: "tool_call_blocked",
      tool_name: "get_center_for_gate_v1",
      status: "denied",
      metadata: {
        reason: "budget_exceeded",
        period: "day",
        limit: 100,
        used: 100,
      },
    });
    expect(auditEvents.filter((event) => (
      event.tool_name === "get_center_for_gate_v1" &&
      event.event === "tool_call_started"
    ))).toHaveLength(0);
  });

  it("returns invalid params for malformed deterministic HD tool arguments", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    await seedMcpAccess(db, {
      tokenScopes: ["mcp:read_hd"],
      consentScopes: ["mcp:read_hd"],
    });

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("find_channels_by_gate_v1", {
        gate: 65,
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        code: -32602,
        message: "Invalid params",
        data: {
          reason: "gate_out_of_range",
          param: "gate",
        },
      },
    });
    expect(runAstralAgentV2Mock).not.toHaveBeenCalled();
  });

  it("blocks ask_astral_guide_v1 before the agent call when monthly chat quota is exhausted", async () => {
    const harness = await buildMcpTestApp(true);
    const db = await import("../db.js");
    const { userId, clientId } = await seedMcpAccess(db);

    for (let i = 0; i < 300; i += 1) {
      await db.insertMcpAuditEvent({
        userId,
        clientId,
        event: "tool_call_completed",
        toolName: "ask_astral_guide_v1",
        sideEffectsMode: "mcp_read_only",
        status: "success",
      });
    }

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("ask_astral_guide_v1", {
        question: "hello",
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        code: -32014,
        message: "message_limit_reached",
        data: {
          plan: "premium",
          used: 300,
          limit: 300,
        },
      },
    });
    expect(runAstralAgentV2Mock).not.toHaveBeenCalled();
    const auditEvents = await db.getMcpAuditEventsForUser(userId);
    expect(auditEvents.at(-1)).toMatchObject({
      user_id: userId,
      client_id: clientId,
      event: "tool_call_failed",
      tool_name: "ask_astral_guide_v1",
      status: "error",
      metadata: {
        message: "message_limit_reached",
      },
    });
  });

  it.each(["disabled", "banned"] as const)(
    "blocks %s users before ask_astral_guide_v1 runs",
    async (userStatus) => {
      const harness = await buildMcpTestApp(true);
      const db = await import("../db.js");
      await seedMcpAccess(db, {
        userStatus,
      });

      const res = await harness.app.inject({
        method: "POST",
        url: "/api/mcp/v1",
        headers: mcpHeaders(),
        payload: toolsCallBody("ask_astral_guide_v1", {
          question: "hello",
        }),
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toMatchObject({
        jsonrpc: "2.0",
        id: "req-1",
        error: {
          code: -32008,
          message: "account_inactive",
        },
      });
      expect(runAstralAgentV2Mock).not.toHaveBeenCalled();
    },
  );

  it("returns invalid params when ask_astral_guide_v1 receives no question", async () => {
    const harness = await buildMcpTestApp(true);
    await harness.seedAccess();

    const res = await harness.app.inject({
      method: "POST",
      url: "/api/mcp/v1",
      headers: mcpHeaders(),
      payload: toolsCallBody("ask_astral_guide_v1", {
        question: " ",
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "req-1",
      error: {
        code: -32602,
        message: "Invalid params",
      },
    });
    expect(runAstralAgentV2Mock).not.toHaveBeenCalled();
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
