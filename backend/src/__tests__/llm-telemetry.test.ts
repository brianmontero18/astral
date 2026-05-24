/**
 * LLM Telemetry — Integration tests
 *
 * Verifies that successful chat calls (sync + stream) persist a row to
 * `llm_calls`, and that failures do NOT write telemetry.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

const runAstralAgentV2Mock = vi.fn();
const runAstralAgentStreamV2Mock = vi.fn();
const analyzeTransitImpactMock = vi.fn();
const getTransitSnapshotCachedMock = vi.fn();

vi.mock("../auth/session.js", () => mockSessionModule());

vi.mock("../llm/model-config.js", () => ({
  hashSystemPrompt: (input: string) => (input ? input.slice(0, 16) : "deadbeef00000000"),
  CHAT_MODEL: "gpt-4o-mini",
}));

vi.mock("../agent-service-v2.js", () => ({
  runAstralAgentV2: runAstralAgentV2Mock,
  runAstralAgentStreamV2: runAstralAgentStreamV2Mock,
}));

vi.mock("../transit-service.js", async () => {
  const actual = await vi.importActual<typeof import("../transit-service.js")>("../transit-service.js");
  return {
    ...actual,
    analyzeTransitImpact: analyzeTransitImpactMock,
    getTransitSnapshotCached: getTransitSnapshotCachedMock,
  };
});

const { createLinkedTestUser, createTestApp, sessionHeaders } = await import("./helpers.js");
const { getLlmUsageForUser, getRecentLlmCallsForUser } = await import("../db.js");

let app: FastifyInstance;

const MOCK_TRANSITS = {
  fetchedAt: "2026-04-20T00:00:00.000Z",
  weekRange: "Apr 20 – Apr 26, 2026",
  planets: [],
  activatedChannels: [],
};

const MOCK_TRANSIT_SNAPSHOT = {
  id: "instant:2026-04-20T00:00:00.000Z",
  targetAt: MOCK_TRANSITS.fetchedAt,
  calculatedAt: "2026-04-20T00:00:01.000Z",
  label: MOCK_TRANSITS.weekRange,
  collective: {
    planets: MOCK_TRANSITS.planets,
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

const SINCE_BEGINNING = "1970-01-01T00:00:00.000Z";

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  getTransitSnapshotCachedMock.mockResolvedValue(MOCK_TRANSIT_SNAPSHOT);
  analyzeTransitImpactMock.mockReturnValue(MOCK_IMPACT);
});

afterEach(() => {
  runAstralAgentV2Mock.mockReset();
  runAstralAgentStreamV2Mock.mockReset();
  getTransitSnapshotCachedMock.mockReset();
});

describe("POST /api/chat — telemetry write", () => {
  it("writes one row to llm_calls with usage and route='chat' on success", async () => {
    const userId = await createLinkedTestUser(app, "tel-chat-success");

    runAstralAgentV2Mock.mockResolvedValueOnce({
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

    const calls = await getRecentLlmCallsForUser(userId, SINCE_BEGINNING);
    expect(calls[0]).toMatchObject({
      route: "chat",
      toolCallsCount: 0,
      toolCallsJson: null,
    });
  });

  it("writes tool call telemetry when the canonical agent reports tool calls", async () => {
    const userId = await createLinkedTestUser(app, "tel-chat-tools");

    runAstralAgentV2Mock.mockResolvedValueOnce({
      content: "respuesta con tools",
      usage: { promptTokens: 220, completionTokens: 80 },
      latencyMs: 920,
      systemPrompt: "TEST_PROMPT_TOOLS",
      toolsUsed: ["findChannelByGates", "getCenterForGate"],
      toolCalls: ["findChannelByGates", "findChannelByGates", "getCenterForGate"],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("tel-chat-tools"),
      payload: { messages: [{ role: "user", content: "¿La 12 y la 20 forman canal?" }] },
    });

    expect(res.statusCode).toBe(200);

    const calls = await getRecentLlmCallsForUser(userId, SINCE_BEGINNING);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      route: "chat",
      toolCallsCount: 3,
      toolCallsJson: JSON.stringify([
        "findChannelByGates",
        "findChannelByGates",
        "getCenterForGate",
      ]),
    });
  });

  it("persists context budget breakdown with post-call calibration", async () => {
    const userId = await createLinkedTestUser(app, "tel-chat-context-budget");

    runAstralAgentV2Mock.mockResolvedValueOnce({
      content: "respuesta con budget",
      usage: { promptTokens: 220, completionTokens: 80, cachedTokens: 20 },
      latencyMs: 920,
      systemPrompt: "TEST_PROMPT_BUDGET",
      contextBudget: {
        model: "gpt-4o-mini",
        provider: "openai",
        contextWindowTokens: 128000,
        estimatedInputTokens: 200,
        reservedOutputTokens: 512,
        estimatedTotalTokens: 712,
        percentUsed: 0.0055625,
        blocks: [
          { id: "system_static", tokens: 120, percentOfWindow: 0.0009375 },
          { id: "history", tokens: 80, percentOfWindow: 0.000625 },
          { id: "response", tokens: 512, percentOfWindow: 0.004 },
        ],
        selection: {
          selectedMessageCount: 1,
          omittedMessageCount: 2,
          omittedTokenEstimate: 160,
          currentMessageTokens: 12,
          historyTokenBudget: 120000,
          selectedHistoryTokens: 80,
          reason: "token_budget_omitted_history",
        },
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("tel-chat-context-budget"),
      payload: { messages: [{ role: "user", content: "hola" }] },
    });

    expect(res.statusCode).toBe(200);

    const calls = await getRecentLlmCallsForUser(userId, SINCE_BEGINNING);
    expect(calls).toHaveLength(1);
    const contextBreakdownJson = calls[0]?.contextBreakdownJson;
    if (typeof contextBreakdownJson !== "string") {
      throw new Error("expected context_breakdown_json to be persisted");
    }
    const contextBreakdown = JSON.parse(contextBreakdownJson);
    expect(contextBreakdown).toMatchObject({
      estimatedInputTokens: 200,
      selection: {
        selectedMessageCount: 1,
        omittedMessageCount: 2,
        reason: "token_budget_omitted_history",
      },
      postCall: {
        inputTokens: 220,
        outputTokens: 80,
        cachedInputTokens: 20,
        calibrationRatio: 1.1,
      },
    });
  });

  it("prices cached input tokens at the cached-input rate", async () => {
    const userId = await createLinkedTestUser(app, "tel-chat-cached-cost");

    runAstralAgentV2Mock.mockResolvedValueOnce({
      content: "respuesta cacheada",
      usage: { promptTokens: 1000, completionTokens: 100, cachedTokens: 600 },
      latencyMs: 875,
      systemPrompt: "TEST_PROMPT_CACHE",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("tel-chat-cached-cost"),
      payload: { messages: [{ role: "user", content: "hola" }] },
    });

    expect(res.statusCode).toBe(200);

    const usage = await getLlmUsageForUser(userId, SINCE_BEGINNING);
    expect(usage.totalCallCount).toBe(1);
    expect(usage.totalTokensIn).toBe(1000);
    expect(usage.totalTokensOut).toBe(100);
    expect(usage.totalCostUsd).toBeCloseTo(0.000165, 8);
  });

  it("does not persist telemetry when the agent throws", async () => {
    const userId = await createLinkedTestUser(app, "tel-chat-fail");

    runAstralAgentV2Mock.mockRejectedValueOnce(new Error("synthetic upstream failure"));

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

    runAstralAgentStreamV2Mock.mockImplementationOnce(async function* streamWithUsage(
      _profile,
      _transits,
      _messages,
      _key,
      _impact,
      _intake,
      _memory,
      onComplete,
      _contextBudget,
    ) {
      yield "primero ";
      yield "segundo";
      onComplete?.({
        usage: { promptTokens: 300, completionTokens: 150 },
        latencyMs: 1500,
        systemPrompt: "STREAM_PROMPT_BB",
        toolsUsed: ["findChannelsByGate"],
        toolCalls: ["findChannelsByGate"],
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

    const calls = await getRecentLlmCallsForUser(userId, SINCE_BEGINNING);
    expect(calls[0]).toMatchObject({
      route: "chat_stream",
      toolCallsCount: 1,
      toolCallsJson: JSON.stringify(["findChannelsByGate"]),
    });
  });

  it("does not persist telemetry when the stream never reports usage", async () => {
    const userId = await createLinkedTestUser(app, "tel-stream-no-usage");

    runAstralAgentStreamV2Mock.mockImplementationOnce(async function* streamWithoutUsage() {
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
