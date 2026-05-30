/**
 * Post-hoc chat evals — Integration tests (astral-y3c.3)
 *
 * Strategy mirrors memory-integration.test.ts: mock the LLM call sites + transits
 * so the test never touches OpenAI, but exercise the real /api/chat route, the
 * real fire-and-forget wiring, and the real eval suite + eval_results column.
 *
 * Flags are mocked as a mutable object so each test flips POST_HOC_EVAL_CHAT and
 * the closure in guide-service reads the live value. MEMORY_LIVING_DOCUMENT and
 * LLM_TELEMETRY are off to keep the test focused on the eval side-effect.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

const runAstralAgentV2Mock = vi.fn();
const analyzeTransitImpactMock = vi.fn();
const getTransitSnapshotCachedMock = vi.fn();

const { mockFlags } = vi.hoisted(() => ({
  mockFlags: {
    CHAT_INTAKE_CONTEXT: true,
    LLM_TELEMETRY: false,
    MEMORY_LIVING_DOCUMENT: false,
    REMOTE_MCP: false,
    POST_HOC_EVAL_CHAT: true,
    POST_HOC_EVAL_REPORT: false,
  },
}));

vi.mock("../auth/session.js", () => mockSessionModule());
vi.mock("../config/flags.js", () => ({ FLAGS: mockFlags }));
vi.mock("../llm/model-config.js", () => ({
  hashSystemPrompt: (input: string) => input.slice(0, 16),
  CHAT_MODEL: "gpt-4o-mini",
  CHAT_SIMPLE_MODEL: "gpt-4o-mini",
  CHAT_COMPLEX_MODEL: "gpt-4o-mini",
}));
vi.mock("../agent-service-v2.js", () => ({
  runAstralAgentV2: runAstralAgentV2Mock,
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
const db = await import("../db.js");
const { getEvalResultsForUser } = db;

const MOCK_TRANSIT_SNAPSHOT = {
  id: "instant:2026-04-27T00:00:00.000Z",
  targetAt: "2026-04-27T00:00:00.000Z",
  calculatedAt: "2026-04-27T00:00:01.000Z",
  label: "Apr 27 – May 3, 2026",
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

// Plan-proposing question + a generic, sycophantic reply: must fail
// no-generic-advisor-language and anti-sycophancy, pass the rest.
const PLAN_MESSAGE = "Quiero relanzar mi programa y vender ya.";
const GENERIC_REPLY = {
  content:
    "Esta semana es propicia para tu negocio. Es una gran oportunidad, así que relanzá con confianza y aprovechá el momento.",
  usage: { promptTokens: 100, completionTokens: 50 },
  latencyMs: 200,
  systemPrompt: "TEST_CHAT_PROMPT",
};

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  mockFlags.POST_HOC_EVAL_CHAT = true;
  getTransitSnapshotCachedMock.mockResolvedValue(MOCK_TRANSIT_SNAPSHOT);
  analyzeTransitImpactMock.mockReturnValue(MOCK_IMPACT);
  runAstralAgentV2Mock.mockResolvedValue(GENERIC_REPLY);
});

afterEach(() => {
  vi.restoreAllMocks();
  runAstralAgentV2Mock.mockReset();
  getTransitSnapshotCachedMock.mockReset();
});

async function sendChat(slug: string): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: "/api/chat",
    headers: sessionHeaders(slug),
    payload: { messages: [{ role: "user", content: PLAN_MESSAGE }] },
  });
  expect(res.statusCode).toBe(200);
}

describe("post-hoc chat evals", () => {
  it("persists the full heuristic suite anchored to the assistant message when the flag is ON", async () => {
    const slug = "evals-on";
    const userId = await createLinkedTestUser(app, slug);

    await sendChat(slug);

    const rows = await vi.waitFor(async () => {
      const found = await getEvalResultsForUser(userId, { surface: "chat" });
      expect(found.length).toBeGreaterThan(0);
      return found;
    });

    // Whole suite landed, all heuristic, all on the same assistant-message anchor.
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.source === "heuristic")).toBe(true);
    expect(rows.every((r) => r.surface === "chat")).toBe(true);
    const targetIds = new Set(rows.map((r) => r.targetId));
    expect(targetIds.size).toBe(1);
    expect([...targetIds][0]).toMatch(/^\d+$/);

    // The generic, sycophantic reply fails exactly the expected dimensions.
    const byName = new Map(rows.map((r) => [r.evalName, r]));
    expect(byName.get("anti-sycophancy")?.pass).toBe(false);
    expect(byName.get("no-generic-advisor-language")?.pass).toBe(false);
    expect(byName.get("spanish")?.pass).toBe(true);

    // Context snapshot is stored once (first row), not duplicated per check.
    const withSnapshot = rows.filter((r) => r.contextSnapshotJson !== null);
    expect(withSnapshot).toHaveLength(1);
    expect(JSON.parse(withSnapshot[0].contextSnapshotJson ?? "{}")).toMatchObject({
      model: "gpt-4o-mini",
      hdSummary: { type: expect.any(String) },
    });
  });

  it("persists nothing when the flag is OFF", async () => {
    mockFlags.POST_HOC_EVAL_CHAT = false;
    const slug = "evals-off";
    const userId = await createLinkedTestUser(app, slug);

    await sendChat(slug);

    // Flag-off path returns synchronously before any async work; no rows ever.
    expect(await getEvalResultsForUser(userId, { surface: "chat" })).toHaveLength(0);
  });

  it("never breaks the reply when the eval persistence throws", async () => {
    vi.spyOn(db, "insertEvalResults").mockRejectedValueOnce(new Error("boom"));
    const slug = "evals-throw";
    const userId = await createLinkedTestUser(app, slug);

    // The chat response itself must still succeed (asserted inside sendChat).
    await sendChat(slug);

    // The rejected insert means no rows persisted, but the user got their reply.
    expect(await getEvalResultsForUser(userId, { surface: "chat" })).toHaveLength(0);
  });
});
