/**
 * LLM Telemetry — Integration tests
 *
 * Verifies that successful chat calls (sync + stream) persist a row to
 * `llm_calls`, and that failures do NOT write telemetry.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

const runAstralAgentMock = vi.fn();
const runAstralAgentStreamMock = vi.fn();
const getTransitsCachedMock = vi.fn();
const analyzeTransitImpactMock = vi.fn();

vi.mock("../auth/session.js", () => mockSessionModule());

vi.mock("../agent-service.js", () => ({
  runAstralAgent: runAstralAgentMock,
  runAstralAgentStream: runAstralAgentStreamMock,
  hashSystemPrompt: (input: string) => (input ? input.slice(0, 16) : "deadbeef00000000"),
  CHAT_MODEL: "gpt-4o-mini",
}));

vi.mock("../routes/transits.js", async () => {
  const actual = await vi.importActual<typeof import("../routes/transits.js")>("../routes/transits.js");
  return { ...actual, getTransitsCached: getTransitsCachedMock };
});

vi.mock("../transit-service.js", async () => {
  const actual = await vi.importActual<typeof import("../transit-service.js")>("../transit-service.js");
  return { ...actual, analyzeTransitImpact: analyzeTransitImpactMock };
});

const { createLinkedTestUser, createTestApp, sessionHeaders } = await import("./helpers.js");
const { getLlmUsageForUser } = await import("../db.js");

let app: FastifyInstance;

const MOCK_TRANSITS = {
  fetchedAt: "2026-04-20T00:00:00.000Z",
  weekRange: "Apr 20 – Apr 26, 2026",
  planets: [],
  activatedChannels: [],
};

const MOCK_IMPACT = {
  personalChannels: [],
  conditionedCenters: [],
  reinforcedGates: [],
  educationalChannels: [],
};

const SINCE_BEGINNING = "1970-01-01T00:00:00.000Z";

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  getTransitsCachedMock.mockResolvedValue(MOCK_TRANSITS);
  analyzeTransitImpactMock.mockReturnValue(MOCK_IMPACT);
});

afterEach(() => {
  runAstralAgentMock.mockReset();
  runAstralAgentStreamMock.mockReset();
});

describe("POST /api/chat — telemetry write", () => {
  it("writes one row to llm_calls with usage and route='chat' on success", async () => {
    const userId = await createLinkedTestUser(app, "tel-chat-success");

    runAstralAgentMock.mockResolvedValueOnce({
      content: "respuesta",
      usage: { promptTokens: 200, completionTokens: 100 },
      latencyMs: 875,
      systemPrompt: "TEST_PROMPT_AAAAA",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("tel-chat-success"),
      payload: { messages: [{ role: "user", content: "hola" }] },
    });

    expect(res.statusCode).toBe(200);

    const usage = await getLlmUsageForUser(userId, SINCE_BEGINNING);
    expect(usage.totalCallCount).toBe(1);
    expect(usage.totalTokensIn).toBe(200);
    expect(usage.totalTokensOut).toBe(100);
    expect(usage.byRoute).toEqual([
      expect.objectContaining({ route: "chat", callCount: 1, tokensIn: 200, tokensOut: 100 }),
    ]);
    expect(usage.byModel).toEqual([
      expect.objectContaining({ model: "gpt-4o-mini", callCount: 1 }),
    ]);
    // gpt-4o-mini: $0.15/M input + $0.60/M output → (200*0.15 + 100*0.60)/1M = 9e-5
    expect(usage.totalCostUsd).toBeCloseTo(9e-5, 8);
  });

  it("does not persist telemetry when the agent throws", async () => {
    const userId = await createLinkedTestUser(app, "tel-chat-fail");

    runAstralAgentMock.mockRejectedValueOnce(new Error("synthetic upstream failure"));

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("tel-chat-fail"),
      payload: { messages: [{ role: "user", content: "hola" }] },
    });

    expect(res.statusCode).toBe(502);

    const usage = await getLlmUsageForUser(userId, SINCE_BEGINNING);
    expect(usage.totalCallCount).toBe(0);
  });
});

describe("POST /api/chat/stream — telemetry write", () => {
  it("writes one row with route='chat_stream' when the stream finishes with usage", async () => {
    const userId = await createLinkedTestUser(app, "tel-stream-success");

    runAstralAgentStreamMock.mockImplementationOnce(async function* streamWithUsage(
      _profile,
      _transits,
      _messages,
      _key,
      _impact,
      _intake,
      _memory,
      onComplete,
    ) {
      yield "primero ";
      yield "segundo";
      onComplete?.({
        usage: { promptTokens: 300, completionTokens: 150 },
        latencyMs: 1500,
        systemPrompt: "STREAM_PROMPT_BB",
      });
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      headers: sessionHeaders("tel-stream-success"),
      payload: { messages: [{ role: "user", content: "decime" }] },
    });

    expect(res.statusCode).toBe(200);

    const usage = await getLlmUsageForUser(userId, SINCE_BEGINNING);
    expect(usage.totalCallCount).toBe(1);
    expect(usage.totalTokensIn).toBe(300);
    expect(usage.totalTokensOut).toBe(150);
    expect(usage.byRoute).toEqual([
      expect.objectContaining({ route: "chat_stream", callCount: 1 }),
    ]);
  });

  it("does not persist telemetry when the stream never reports usage", async () => {
    const userId = await createLinkedTestUser(app, "tel-stream-no-usage");

    runAstralAgentStreamMock.mockImplementationOnce(async function* streamWithoutUsage() {
      yield "fragmento sin meta";
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      headers: sessionHeaders("tel-stream-no-usage"),
      payload: { messages: [{ role: "user", content: "hola" }] },
    });

    expect(res.statusCode).toBe(200);

    const usage = await getLlmUsageForUser(userId, SINCE_BEGINNING);
    expect(usage.totalCallCount).toBe(0);
  });
});
