/**
 * Chat API — Integration tests
 *
 * Tests validation, message persistence, and error handling.
 * The actual LLM call is NOT tested (non-deterministic).
 * Focus: routing logic, auth, and message history.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

const runAstralAgentMock = vi.fn();
const runAstralAgentStreamMock = vi.fn();
const getTransitsCachedMock = vi.fn();
const analyzeTransitImpactMock = vi.fn();

function mockAgentResult(content: string) {
  return {
    content,
    usage: { promptTokens: 0, completionTokens: 0 },
    latencyMs: 0,
    systemPrompt: "",
  };
}

vi.mock("../auth/session.js", () => mockSessionModule());

vi.mock("../agent-service.js", () => ({
  runAstralAgent: runAstralAgentMock,
  runAstralAgentStream: runAstralAgentStreamMock,
  hashSystemPrompt: (s: string) => s.slice(0, 16),
  CHAT_MODEL: "gpt-4o-mini",
}));

vi.mock("../routes/transits.js", async () => {
  const actual = await vi.importActual<typeof import("../routes/transits.js")>("../routes/transits.js");

  return {
    ...actual,
    getTransitsCached: getTransitsCachedMock,
  };
});

vi.mock("../transit-service.js", async () => {
  const actual = await vi.importActual<typeof import("../transit-service.js")>("../transit-service.js");

  return {
    ...actual,
    analyzeTransitImpact: analyzeTransitImpactMock,
  };
});

const {
  createLinkedTestUser,
  createTestApp,
  createTestUser,
  seedUserMessages,
  sessionHeaders,
} = await import("./helpers.js");
const { getChatMessages } = await import("../db.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

const MOCK_TRANSITS = {
  fetchedAt: "2026-04-20T00:00:00.000Z",
  weekRange: "Apr 20 – Apr 26, 2026",
  planets: [],
  activatedChannels: [],
};

beforeAll(() => {
  getTransitsCachedMock.mockResolvedValue(MOCK_TRANSITS);
  analyzeTransitImpactMock.mockReturnValue({
    personalChannels: [],
    conditionedCenters: [],
    reinforcedGates: [],
    educationalChannels: [],
  });
});

afterEach(() => {
  runAstralAgentMock.mockReset();
  runAstralAgentStreamMock.mockReset();
  getTransitsCachedMock.mockReset();
  analyzeTransitImpactMock.mockReset();

  getTransitsCachedMock.mockResolvedValue(MOCK_TRANSITS);
  analyzeTransitImpactMock.mockReturnValue({
    personalChannels: [],
    conditionedCenters: [],
    reinforcedGates: [],
    educationalChannels: [],
  });
});

describe("POST /api/chat — validation", () => {
  it("rejects request without messages", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/messages/i);
  });

  it("rejects request with empty messages array", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId, messages: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns authentication_required when a persisted chat request has no validated session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId: "legacy-client-user-id",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("rejects request without userId or profile", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { messages: [{ role: "user", content: "hello" }] },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/userId|profile/i);
  });
});

describe("POST /api/chat/stream — validation", () => {
  it("rejects request without messages", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: { userId },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns authentication_required when a persisted stream request has no validated session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: {
        userId: "legacy-client-user-id",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });
});

describe("Chat history routes", () => {
  it("GET /api/me/messages returns authentication_required without a validated session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/me/messages",
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("GET /api/me/messages returns empty history for a linked user with no messages", async () => {
    await createLinkedTestUser(app, "st-chat-empty");
    const res = await app.inject({
      method: "GET",
      url: "/api/me/messages",
      headers: sessionHeaders("st-chat-empty"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.messages).toEqual([]);
  });

  it("GET legacy /api/users/:userId/messages returns client_identity_mismatch on cross-user access", async () => {
    const ownerId = await createLinkedTestUser(app, "st-chat-owner");
    const otherId = await createLinkedTestUser(app, "st-chat-other");

    const res = await app.inject({
      method: "GET",
      url: `/api/users/${otherId}/messages`,
      headers: sessionHeaders("st-chat-owner"),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "client_identity_mismatch",
      userId: ownerId,
      requestedUserId: otherId,
      provider: "supertokens",
      subject: "st-chat-owner",
    });
  });

  it("GET /api/me/messages returns used and limit for the current linked user", async () => {
    await createLinkedTestUser(app, "st-chat-metrics");
    const res = await app.inject({
      method: "GET",
      url: "/api/me/messages",
      headers: sessionHeaders("st-chat-metrics"),
    });

    const body = JSON.parse(res.body);
    expect(body.used).toBe(0);
    expect(body.plan).toBe("free");
    expect(body.limit).toBe(20);
    expect(body.cycle).toMatch(/^\d{4}-\d{2}$/);
    expect(body.resetsAt).toEqual(expect.any(String));
  });

  it.each([
    { plan: "basic" as const, limit: 120 },
    { plan: "premium" as const, limit: 300 },
  ])(
    "GET /api/me/messages returns the configured limit for $plan plan",
    async ({ plan, limit }) => {
      await createLinkedTestUser(app, `st-chat-${plan}-metrics`, "Paid Chat User", undefined, {
        plan,
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/me/messages",
        headers: sessionHeaders(`st-chat-${plan}-metrics`),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.plan).toBe(plan);
      expect(body.used).toBe(0);
      expect(body.limit).toBe(limit);
    },
  );

  it("GET /api/me/messages returns the linked user's persisted history", async () => {
    const userId = await createLinkedTestUser(app, "st-chat-history");
    await seedUserMessages(app, userId, 5);
    const res = await app.inject({
      method: "GET",
      url: "/api/me/messages",
      headers: sessionHeaders("st-chat-history"),
    });

    const body = JSON.parse(res.body);
    expect(body.used).toBe(5);
    expect(body.limit).toBe(20);
    expect(body.plan).toBe("free");
    expect(body.messages).toHaveLength(10); // 5 user + 5 assistant
  });

  it("GET /api/me/messages ignores messages from previous months in the usage counter", async () => {
    const userId = await createLinkedTestUser(app, "st-chat-monthly-window");
    await seedUserMessages(app, userId, 8, "2020-01-15 12:00:00");
    await seedUserMessages(app, userId, 3);

    const res = await app.inject({
      method: "GET",
      url: "/api/me/messages",
      headers: sessionHeaders("st-chat-monthly-window"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.used).toBe(3);
    expect(body.limit).toBe(20);
    expect(body.messages).toHaveLength(22);
  });

  it.each([
    {
      from: "free" as const,
      to: "basic" as const,
      usedBeforeUpgrade: 20,
      previousLimit: 20,
      nextLimit: 120,
    },
    {
      from: "basic" as const,
      to: "premium" as const,
      usedBeforeUpgrade: 120,
      previousLimit: 120,
      nextLimit: 300,
    },
  ])(
    "keeps identity and history alive when the current user upgrades from $from to $to",
    async ({ from, to, usedBeforeUpgrade, previousLimit, nextLimit }) => {
      const targetSubject = `st-chat-upgrade-${from}-target`;
      const adminSubject = `st-chat-upgrade-${from}-admin`;

      await createLinkedTestUser(app, adminSubject, "Upgrade Admin", undefined, {
        role: "admin",
      });
      const userId = await createLinkedTestUser(app, targetSubject, "Upgrade Target", undefined, {
        plan: from,
      });
      await seedUserMessages(app, userId, usedBeforeUpgrade);

      const beforeRes = await app.inject({
        method: "GET",
        url: "/api/me/messages",
        headers: sessionHeaders(targetSubject),
      });

      expect(beforeRes.statusCode).toBe(200);
      expect(JSON.parse(beforeRes.body)).toMatchObject({
        plan: from,
        used: usedBeforeUpgrade,
        limit: previousLimit,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "test message 1" }),
          expect.objectContaining({ role: "assistant", content: "test reply 1" }),
        ]),
      });

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/api/admin/users/${userId}/access`,
        headers: sessionHeaders(adminSubject),
        payload: {
          plan: to,
        },
      });

      expect(patchRes.statusCode).toBe(200);
      expect(JSON.parse(patchRes.body)).toEqual({
        ok: true,
      });

      const meRes = await app.inject({
        method: "GET",
        url: "/api/me",
        headers: sessionHeaders(targetSubject),
      });

      expect(meRes.statusCode).toBe(200);
      expect(JSON.parse(meRes.body)).toMatchObject({
        id: userId,
        plan: to,
      });

      const afterUpgradeRes = await app.inject({
        method: "GET",
        url: "/api/me/messages",
        headers: sessionHeaders(targetSubject),
      });

      expect(afterUpgradeRes.statusCode).toBe(200);
      expect(JSON.parse(afterUpgradeRes.body)).toMatchObject({
        plan: to,
        used: usedBeforeUpgrade,
        limit: nextLimit,
      });
      expect(JSON.parse(afterUpgradeRes.body).messages).toHaveLength(usedBeforeUpgrade * 2);

      runAstralAgentMock.mockResolvedValueOnce(mockAgentResult("Seguimos sin perder contexto"));

      const sendRes = await app.inject({
        method: "POST",
        url: "/api/chat",
        headers: sessionHeaders(targetSubject),
        payload: {
          messages: [{ role: "user", content: "¿Sigo con el mismo historial?" }],
        },
      });

      expect(sendRes.statusCode).toBe(200);
      expect(JSON.parse(sendRes.body)).toEqual({
        reply: "Seguimos sin perder contexto",
        transits_used: MOCK_TRANSITS.fetchedAt,
        userMsgId: expect.any(Number),
        assistantMsgId: expect.any(Number),
      });

      const afterSendRes = await app.inject({
        method: "GET",
        url: "/api/me/messages",
        headers: sessionHeaders(targetSubject),
      });

      expect(afterSendRes.statusCode).toBe(200);
      expect(JSON.parse(afterSendRes.body)).toMatchObject({
        plan: to,
        used: usedBeforeUpgrade + 1,
        limit: nextLimit,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "¿Sigo con el mismo historial?" }),
          expect.objectContaining({ role: "assistant", content: "Seguimos sin perder contexto" }),
        ]),
      });
    },
  );
});

describe("Freemium message limit", () => {
  it("POST /api/chat returns a persisted reply for the linked current user", async () => {
    const userId = await createLinkedTestUser(app, "st-chat-happy");
    runAstralAgentMock.mockResolvedValueOnce(mockAgentResult("Respuesta persistida"));

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("st-chat-happy"),
      payload: {
        messages: [{ role: "user", content: "¿Qué necesito ver hoy?" }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      reply: "Respuesta persistida",
      transits_used: MOCK_TRANSITS.fetchedAt,
      userMsgId: expect.any(Number),
      assistantMsgId: expect.any(Number),
    });

    const historyRes = await app.inject({
      method: "GET",
      url: "/api/me/messages",
      headers: sessionHeaders("st-chat-happy"),
    });

    expect(historyRes.statusCode).toBe(200);
    expect(JSON.parse(historyRes.body)).toMatchObject({
      used: 1,
      plan: "free",
      limit: 20,
      messages: [
        expect.objectContaining({ role: "user", content: "¿Qué necesito ver hoy?" }),
        expect.objectContaining({ role: "assistant", content: "Respuesta persistida" }),
      ],
    });
    expect(runAstralAgentMock).toHaveBeenCalledTimes(1);
    expect(runAstralAgentMock).toHaveBeenCalledWith(
      expect.any(Object),
      MOCK_TRANSITS,
      [{ role: "user", content: "¿Qué necesito ver hoy?" }],
      expect.any(String),
      expect.any(Object),
      undefined,
    );
    expect(userId).toEqual(expect.any(String));
  });

  it("POST /api/chat/stream persists the streamed answer for the linked current user", async () => {
    await createLinkedTestUser(app, "st-chat-stream-happy");
    runAstralAgentStreamMock.mockImplementationOnce(async function* streamReply() {
      yield "Respuesta ";
      yield "streaming";
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      headers: sessionHeaders("st-chat-stream-happy"),
      payload: {
        messages: [{ role: "user", content: "Decime algo" }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('"content":"Respuesta "');
    expect(res.body).toContain('"content":"streaming"');
    expect(res.body).toContain('"done":true');

    const historyRes = await app.inject({
      method: "GET",
      url: "/api/me/messages",
      headers: sessionHeaders("st-chat-stream-happy"),
    });

    expect(historyRes.statusCode).toBe(200);
    expect(JSON.parse(historyRes.body)).toMatchObject({
      used: 1,
      messages: [
        expect.objectContaining({ role: "user", content: "Decime algo" }),
        expect.objectContaining({ role: "assistant", content: "Respuesta streaming" }),
      ],
    });
  });

  it("does not persist duplicate messages when the backend agent fails", async () => {
    await createLinkedTestUser(app, "st-chat-agent-fail");
    runAstralAgentMock.mockRejectedValueOnce(new Error("synthetic upstream failure"));

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("st-chat-agent-fail"),
      payload: {
        messages: [{ role: "user", content: "hola" }],
      },
    });

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body)).toEqual({
      error: "synthetic upstream failure",
    });

    const historyRes = await app.inject({
      method: "GET",
      url: "/api/me/messages",
      headers: sessionHeaders("st-chat-agent-fail"),
    });

    expect(historyRes.statusCode).toBe(200);
    expect(JSON.parse(historyRes.body)).toMatchObject({
      used: 0,
      messages: [],
    });
  });

  it("returns 403 on POST /api/chat when the linked session user has reached the limit", async () => {
    const userId = await createLinkedTestUser(app, "st-chat-limit");
    await seedUserMessages(app, userId, 20);

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("st-chat-limit"),
      payload: {
        messages: [{ role: "user", content: "one more please" }],
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("message_limit_reached");
    expect(body.plan).toBe("free");
    expect(body.used).toBe(20);
    expect(body.limit).toBe(20);
    expect(body.cycle).toMatch(/^\d{4}-\d{2}$/);
    expect(body.resetsAt).toEqual(expect.any(String));
  });

  it("returns 403 on POST /api/chat/stream when the linked session user has reached the limit", async () => {
    const userId = await createLinkedTestUser(app, "st-chat-stream-limit");
    await seedUserMessages(app, userId, 20);

    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      headers: sessionHeaders("st-chat-stream-limit"),
      payload: {
        messages: [{ role: "user", content: "one more please" }],
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("message_limit_reached");
    expect(body.plan).toBe("free");
    expect(body.used).toBe(20);
    expect(body.limit).toBe(20);
  });

  it.each([
    { plan: "basic" as const, limit: 120 },
    { plan: "premium" as const, limit: 300 },
  ])(
    "enforces POST /api/chat limit for $plan plan users",
    async ({ plan, limit }) => {
      const userId = await createLinkedTestUser(app, `st-chat-${plan}-send`, "Paid Send User", undefined, {
        plan,
      });
      await seedUserMessages(app, userId, limit);

      const res = await app.inject({
        method: "POST",
        url: "/api/chat",
        headers: sessionHeaders(`st-chat-${plan}-send`),
        payload: {
          messages: [{ role: "user", content: "one more please" }],
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.plan).toBe(plan);
      expect(body.used).toBe(limit);
      expect(body.limit).toBe(limit);
    },
  );

  it.each([
    { plan: "basic" as const, limit: 120 },
    { plan: "premium" as const, limit: 300 },
  ])(
    "enforces POST /api/chat/stream limit for $plan plan users",
    async ({ plan, limit }) => {
      const userId = await createLinkedTestUser(app, `st-chat-${plan}-stream`, "Paid Stream User", undefined, {
        plan,
      });
      await seedUserMessages(app, userId, limit);

      const res = await app.inject({
        method: "POST",
        url: "/api/chat/stream",
        headers: sessionHeaders(`st-chat-${plan}-stream`),
        payload: {
          messages: [{ role: "user", content: "one more please" }],
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.plan).toBe(plan);
      expect(body.used).toBe(limit);
      expect(body.limit).toBe(limit);
    },
  );

  it("rejects a mismatched legacy userId when the session resolves to a different user", async () => {
    const ownerId = await createLinkedTestUser(app, "st-chat-mismatch-owner");
    const otherId = await createLinkedTestUser(app, "st-chat-mismatch-other");

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("st-chat-mismatch-owner"),
      payload: {
        userId: otherId,
        messages: [{ role: "user", content: "who am i" }],
      },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "client_identity_mismatch",
      userId: ownerId,
      requestedUserId: otherId,
      provider: "supertokens",
      subject: "st-chat-mismatch-owner",
    });
  });

  it("does not silently fall back to anonymous profile mode when userId is present without a valid session", async () => {
    const otherId = await createLinkedTestUser(app, "st-chat-fallback-other");

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId: otherId,
        profile: {
          humanDesign: {
            type: "Generator",
            strategy: "Respond",
            authority: "Sacral",
            profile: "1/3",
            definition: "Single",
            incarnationCross: "Test",
            channels: [],
            activatedGates: [],
            definedCenters: [],
            undefinedCenters: [],
          },
        },
        messages: [{ role: "user", content: "hello" }],
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("does not enforce limit when userId is not provided (legacy mode)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        profile: {
          humanDesign: {
            type: "Generator",
            strategy: "Respond",
            authority: "Sacral",
            profile: "1/3",
            definition: "Single",
            incarnationCross: "Test",
            channels: [],
            activatedGates: [],
            definedCenters: [],
            undefinedCenters: [],
          },
        },
        messages: [{ role: "user", content: "hello" }],
      },
    });

    // Should not be 403 — no userId means no limit check
    expect(res.statusCode).not.toBe(403);
  });
});

describe("Chat history truncation semantics", () => {
  it.each([
    { plan: "free" as const, limit: 20 },
    { plan: "basic" as const, limit: 120 },
    { plan: "premium" as const, limit: 300 },
  ])(
    "DELETE /api/me/messages rewrites the persisted branch for $plan users",
    async ({ plan, limit }) => {
      const sessionSubject = `st-chat-${plan}-truncate`;
      const userId = await createLinkedTestUser(app, sessionSubject, "Paid Truncate User", undefined, {
        plan,
      });
      await seedUserMessages(app, userId, 3);
      const messagesBefore = await getChatMessages(userId);
      expect(messagesBefore).toHaveLength(6);
      expect(messagesBefore[2]?.content).toBe("test message 2");

      const truncateRes = await app.inject({
        method: "DELETE",
        url: `/api/me/messages?fromId=${messagesBefore[2]!.id}`,
        headers: sessionHeaders(sessionSubject),
      });

      expect(truncateRes.statusCode).toBe(200);
      expect(JSON.parse(truncateRes.body)).toEqual(expect.objectContaining({
        deleted: 4,
        plan,
        used: 1,
        limit,
      }));

      const messagesAfterTruncate = await getChatMessages(userId);
      expect(messagesAfterTruncate).toHaveLength(2);
      expect(messagesAfterTruncate.map((message) => message.content)).toEqual([
        "test message 1",
        "test reply 1",
      ]);

      const regeneratedReply = `branch regenerated for ${plan}`;
      runAstralAgentMock.mockResolvedValueOnce(mockAgentResult(regeneratedReply));

      const sendRes = await app.inject({
        method: "POST",
        url: "/api/chat",
        headers: sessionHeaders(sessionSubject),
        payload: {
          messages: [
            { role: "user", content: "test message 1" },
            { role: "assistant", content: "test reply 1" },
            { role: "user", content: `new branch after ${plan} truncate` },
          ],
        },
      });

      expect(sendRes.statusCode).toBe(200);
      expect(JSON.parse(sendRes.body)).toEqual({
        reply: regeneratedReply,
        transits_used: MOCK_TRANSITS.fetchedAt,
        userMsgId: expect.any(Number),
        assistantMsgId: expect.any(Number),
      });

      const messagesAfterRewrite = await getChatMessages(userId);
      expect(messagesAfterRewrite.map((message) => message.content)).toEqual([
        "test message 1",
        "test reply 1",
        `new branch after ${plan} truncate`,
        regeneratedReply,
      ]);
    },
  );

  it("DELETE /api/me/messages returns authentication_required and leaves history untouched without a validated session", async () => {
    const sessionSubject = "st-chat-truncate-expired";
    const userId = await createLinkedTestUser(app, sessionSubject);
    await seedUserMessages(app, userId, 2);
    const messagesBefore = await getChatMessages(userId);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/me/messages?fromId=${messagesBefore[0]!.id}`,
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });

    const messagesAfter = await getChatMessages(userId);
    expect(messagesAfter).toEqual(messagesBefore);
  });
});
