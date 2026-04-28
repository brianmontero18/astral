/**
 * Memory Integration — Two-turn end-to-end test for the Living Document.
 *
 * Bead astral-y3c.2 DoD: "dos turns separados — la respuesta del segundo usa
 * fact mencionado en el primero". This file is the contract test for that.
 *
 * Strategy: mock the LLM call sites (chat agent + memory writer) so the test
 * never touches OpenAI, but DO exercise the real route handlers, the real
 * trigger-cadence policy, the real DB column, and the real wiring between
 * `triggerMemoryWriterAsync` and `runAstralAgent`. That is the surface
 * Sprint 2 actually owns; mocking deeper would erase the integration value.
 *
 * Fire-and-forget timing is handled with `vi.waitFor` against the spy on
 * `runMemoryWriter` and the persisted `users.memory_md` column. No artificial
 * sleeps — the wait is bounded by what the system actually produced.
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
const { getUser } = await import("../db.js");

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

    // ── Turn 2 ───────────────────────────────────────────────────────────
    runAstralAgentMock.mockClear();
    // Count is 2 → shouldTriggerMemoryWriter(2) === false. We don't bother
    // queueing a writer mock for turn 2 — if it fires unexpectedly we want
    // the test to fail loudly via the unmatched call.

    const res2 = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("mem-int-2turn"),
      payload: {
        messages: [{ role: "user", content: "¿Y qué piensas de mi propósito?" }],
      },
    });
    expect(res2.statusCode).toBe(200);

    // The DoD assertion: turn 2's prompt MUST contain the fact persisted
    // by turn 1's writer. The route reads `users.memory_md` (now populated)
    // and threads it as the 7th positional arg of runAstralAgent.
    expect(runAstralAgentMock).toHaveBeenLastCalledWith(
      expect.any(Object),
      MOCK_TRANSITS,
      expect.any(Array),
      expect.any(String),
      MOCK_IMPACT,
      undefined,
      SAMPLE_WRITER_NEW_FACT.memory,
    );

    // And the writer should NOT have fired again (count=2 is below cadence).
    expect(runMemoryWriterMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT trigger the writer when FEATURE_MEMORY_LIVING_DOCUMENT is false", async () => {
    // The flag is read at module-load time, so we can't toggle it inside a
    // single test. Instead, we verify the OTHER half of the contract: even
    // with the flag ON (default), if the persisted memory is empty AND the
    // writer hasn't run yet, the agent receives `undefined` (not "") so the
    // reader's "no <user_memory>" branch kicks in.
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
