import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

const analyzeTransitImpactMock = vi.fn();
const getTransitSnapshotCachedMock = vi.fn();

vi.mock("../auth/session.js", () => mockSessionModule());

vi.mock("../transit-service.js", async () => {
  const actual = await vi.importActual<typeof import("../transit-service.js")>("../transit-service.js");
  return {
    ...actual,
    analyzeTransitImpact: analyzeTransitImpactMock,
    getTransitSnapshotCached: getTransitSnapshotCachedMock,
  };
});

const {
  createLinkedTestUser,
  createTestApp,
  seedUserMessages,
  sessionHeaders,
} = await import("./helpers.js");
const { updateUserMemory } = await import("../db.js");

let app: FastifyInstance;

const MOCK_TRANSITS = {
  fetchedAt: "2026-05-24T12:00:00.000Z",
  weekRange: "May 24 - May 30, 2026",
  planets: [
    {
      name: "Sun",
      longitude: 63,
      sign: "Gemini",
      degree: 3,
      isRetrograde: false,
      hdGate: 35,
      hdLine: 2,
    },
  ],
  activatedChannels: [],
};

const MOCK_TRANSIT_SNAPSHOT = {
  id: "instant:2026-05-24T12:00:00.000Z",
  targetAt: MOCK_TRANSITS.fetchedAt,
  calculatedAt: "2026-05-24T12:00:01.000Z",
  label: MOCK_TRANSITS.weekRange,
  collective: {
    planets: MOCK_TRANSITS.planets,
    activatedGates: [],
    activatedChannels: [],
    activatedCenters: [],
    temporarilyDefinedCenters: [],
  },
};

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(() => {
  getTransitSnapshotCachedMock.mockResolvedValue(MOCK_TRANSIT_SNAPSHOT);
  analyzeTransitImpactMock.mockReturnValue({
    personalChannels: [],
    conditionedCenters: [],
    reinforcedGates: [],
    educationalChannels: [],
  });
});

describe("GET /api/me/chat/context-budget", () => {
  it("returns authentication_required without a linked session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/me/chat/context-budget",
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "authentication_required" });
  });

  it("returns current persisted chat context budget for the linked user", async () => {
    const userId = await createLinkedTestUser(app, "ctx-budget-user");
    await updateUserMemory(userId, "## Facts\n- Daniela sells premium retreats.");
    await seedUserMessages(app, userId, 2);

    const res = await app.inject({
      method: "GET",
      url: "/api/me/chat/context-budget",
      headers: sessionHeaders("ctx-budget-user"),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      model: "gpt-4o-mini",
      provider: "openai",
      limit: 128000,
      breakdown: {
        system: expect.any(Number),
        memory: expect.any(Number),
        history: expect.any(Number),
        tools: expect.any(Number),
        response: expect.any(Number),
      },
    });
    expect(body.used).toBeGreaterThan(0);
    expect(body.breakdown.system).toBeGreaterThan(0);
    expect(body.breakdown.memory).toBeGreaterThan(0);
    expect(body.breakdown.history).toBeGreaterThan(0);
    expect(body.breakdown.tools).toBeGreaterThan(0);
    expect(body.breakdown.response).toBeGreaterThan(0);
    expect(body.blocks.map((block: { id: string }) => block.id)).toContain("memory");
  });
});
