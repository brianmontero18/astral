/**
 * Memory Integration — Two-turn end-to-end test for the Living Document.
 *
 * Contract: a fact persisted by the writer after turn 1 must reach the chat
 * system prompt on turn 2.
 *
 * Strategy: mock the LLM call sites (chat agent + memory writer) so the test
 * never touches OpenAI, but DO exercise the real route handlers, the real
 * trigger-cadence policy, the real DB column, and the real wiring between
 * `triggerMemoryWriterAsync` and `runAstralAgent`. Mocking deeper would
 * erase the integration value.
 *
 * Fire-and-forget timing is handled with `vi.waitFor` against the spy on
 * `runMemoryWriter` and the persisted `users.memory_md` column. No
 * artificial sleeps — the wait is bounded by what the system actually
 * produced.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

const runAstralAgentMock = vi.fn();
const runAstralAgentStreamMock = vi.fn();
const runMemoryWriterMock = vi.fn();
const getTransitsCachedMock = vi.fn();
const analyzeTransitImpactMock = vi.fn();

vi.mock("../auth/session.js", () => mockSessionModule());

vi.mock("../agent-service.js", async () => {
  const actual = await vi.importActual<typeof import("../agent-service.js")>("../agent-service.js");
  return {
    ...actual,
    runAstralAgent: runAstralAgentMock,
    runAstralAgentStream: runAstralAgentStreamMock,
  };
});

vi.mock("../memory-writer.js", async () => {
  const actual = await vi.importActual<typeof import("../memory-writer.js")>("../memory-writer.js");
  return {
    ...actual,
    runMemoryWriter: runMemoryWriterMock,
  };
});

vi.mock("../routes/transits.js", async () => {
  const actual = await vi.importActual<typeof import("../routes/transits.js")>("../routes/transits.js");
  return { ...actual, getTransitsCached: getTransitsCachedMock };
});

vi.mock("../transit-service.js", async () => {
  const actual = await vi.importActual<typeof import("../transit-service.js")>("../transit-service.js");
  return { ...actual, analyzeTransitImpact: analyzeTransitImpactMock };
});

const { createLinkedTestUser, createTestApp, sessionHeaders } = await import("./helpers.js");
const { getLlmUsageForUser, getUser } = await import("../db.js");

const SINCE_BEGINNING = "1970-01-01T00:00:00.000Z";

let app: FastifyInstance;

const MOCK_TRANSITS = {
  fetchedAt: "2026-04-27T00:00:00.000Z",
  weekRange: "Apr 27 – May 3, 2026",
  planets: [],
  activatedChannels: [],
};

const MOCK_IMPACT = {
  personalChannels: [],
  conditionedCenters: [],
  reinforcedGates: [],
  educationalChannels: [],
};

const SAMPLE_AGENT_REPLY = {
  content: "Respuesta del agente",
  usage: { promptTokens: 100, completionTokens: 50 },
  latencyMs: 200,
  systemPrompt: "TEST_CHAT_PROMPT",
};

const SAMPLE_WRITER_NEW_FACT = {
  memory: "## Identidad\n- Es coach somática para mujeres emprendedoras",
  noop: false,
  meta: {
    usage: { promptTokens: 50, completionTokens: 30 },
    latencyMs: 100,
    systemPrompt: "TEST_WRITER_PROMPT",
  },
};

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
  runMemoryWriterMock.mockReset();
});

describe("Memory layer — two-turn integration", () => {
  it("turn 1 fires the writer with empty memory; turn 2 receives the merged memory in the system prompt", async () => {
    const userId = await createLinkedTestUser(app, "mem-int-2turn");

    runAstralAgentMock.mockResolvedValue(SAMPLE_AGENT_REPLY);
    runMemoryWriterMock.mockResolvedValueOnce(SAMPLE_WRITER_NEW_FACT);

    // ── Turn 1 ───────────────────────────────────────────────────────────
    const res1 = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("mem-int-2turn"),
      payload: {
        messages: [
          { role: "user", content: "Hola, soy Camila, soy coach somática para mujeres emprendedoras." },
        ],
      },
    });
    expect(res1.statusCode).toBe(200);

    // Turn 1's chat call sees the BEFORE-trigger state of memory_md, which is "".
    expect(runAstralAgentMock).toHaveBeenLastCalledWith(
      expect.any(Object),  // profile
      MOCK_TRANSITS,
      expect.any(Array),
      expect.any(String),  // openai key
      MOCK_IMPACT,
      undefined,           // intake (test user has none)
      undefined,           // memory empty → flag-gated to undefined
    );

    // The trigger is fire-and-forget: wait until the writer mock has been
    // invoked AND the DB column reflects its output. No artificial sleeps.
    await vi.waitFor(() => {
      expect(runMemoryWriterMock).toHaveBeenCalledTimes(1);
    });

    expect(runMemoryWriterMock).toHaveBeenCalledWith(
      "",                                  // current memory was empty
      expect.any(Array),                   // recent messages window
      expect.any(String),                  // openai key
    );

    await vi.waitFor(async () => {
      const persisted = await getUser(userId);
      expect(persisted?.memory_md).toBe(SAMPLE_WRITER_NEW_FACT.memory);
    });

    // Telemetry: the writer run must land in `llm_calls` with the dedicated
    // route so cost/latency dashboards can break it out from the chat call.
    const usage = await getLlmUsageForUser(userId, SINCE_BEGINNING);
    expect(usage.byRoute).toContainEqual(
      expect.objectContaining({
        route: "memory_writer",
        callCount: 1,
        tokensIn: SAMPLE_WRITER_NEW_FACT.meta.usage.promptTokens,
        tokensOut: SAMPLE_WRITER_NEW_FACT.meta.usage.completionTokens,
      }),
    );

    // ── Turn 2 ───────────────────────────────────────────────────────────
    runAstralAgentMock.mockClear();
    // Count is 2 → shouldTriggerMemoryWriter(2) === false. We don't queue a
    // writer mock for turn 2 — if it fires unexpectedly the test fails
    // loudly via the unmatched call.

    const res2 = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("mem-int-2turn"),
      payload: {
        messages: [{ role: "user", content: "¿Y qué piensas de mi propósito?" }],
      },
    });
    expect(res2.statusCode).toBe(200);

    // Turn 2's prompt MUST contain the fact the writer persisted on turn 1.
    // The route reads `users.memory_md` and threads it through to the agent.
    expect(runAstralAgentMock).toHaveBeenLastCalledWith(
      expect.any(Object),
      MOCK_TRANSITS,
      expect.any(Array),
      expect.any(String),
      MOCK_IMPACT,
      undefined,
      SAMPLE_WRITER_NEW_FACT.memory,
    );

    // And the writer must NOT have fired again (count=2 is below cadence).
    expect(runMemoryWriterMock).toHaveBeenCalledTimes(1);
  });

  it("after a NOOP writer run, the column stays empty and subsequent turns pass undefined memory", async () => {
    // The other half of the contract: when the writer judges nothing worth
    // saving, the DB column stays "" and the route's flag-and-truthiness
    // gate emits `undefined` (not "") to keep the prompt minimal.
    const userId = await createLinkedTestUser(app, "mem-int-empty");

    runAstralAgentMock.mockResolvedValue(SAMPLE_AGENT_REPLY);
    // Writer returns NOOP — nothing worth saving from the first message.
    runMemoryWriterMock.mockResolvedValueOnce({
      memory: "",
      noop: true,
      meta: {
        usage: { promptTokens: 30, completionTokens: 1 },
        latencyMs: 50,
        systemPrompt: "TEST_WRITER_PROMPT",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("mem-int-empty"),
      payload: { messages: [{ role: "user", content: "ok" }] },
    });

    await vi.waitFor(() => {
      expect(runMemoryWriterMock).toHaveBeenCalled();
    });

    // After NOOP, the DB column stays NULL → mapped to "" by mapUserRow.
    const user = await getUser(userId);
    expect(user?.memory_md).toBe("");

    // Subsequent turn still passes `undefined` (flag ON + empty memory →
    // route-level gate returns undefined to keep the prompt minimal).
    runAstralAgentMock.mockClear();
    runMemoryWriterMock.mockResolvedValueOnce({
      memory: "",
      noop: true,
      meta: {
        usage: { promptTokens: 0, completionTokens: 0 },
        latencyMs: 0,
        systemPrompt: "TEST_WRITER_PROMPT",
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("mem-int-empty"),
      payload: { messages: [{ role: "user", content: "hola otra vez" }] },
    });

    expect(runAstralAgentMock).toHaveBeenLastCalledWith(
      expect.any(Object),
      MOCK_TRANSITS,
      expect.any(Array),
      expect.any(String),
      MOCK_IMPACT,
      undefined,
      undefined,
    );
  });
});
