import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

import type { UserProfile } from "../types/agent.js";

const runAstralAgentV2Mock = vi.fn();
const getTransitSnapshotCachedMock = vi.fn();
const analyzeTransitImpactMock = vi.fn();

vi.mock("../llm/model-config.js", () => ({
  CHAT_MODEL: "future-model",
  hashSystemPrompt: (input: string) => input.slice(0, 16),
}));

vi.mock("../agent-service-v2.js", () => ({
  runAstralAgentV2: runAstralAgentV2Mock,
  runAstralAgentStreamV2: vi.fn(),
}));

vi.mock("../transit-service.js", async () => {
  const actual = await vi.importActual<typeof import("../transit-service.js")>("../transit-service.js");
  return {
    ...actual,
    analyzeTransitImpact: analyzeTransitImpactMock,
    getTransitSnapshotCached: getTransitSnapshotCachedMock,
  };
});

const { runGuideTurn } = await import("../services/guide-service.js");

const profile: UserProfile = {
  humanDesign: {
    type: "Generator",
    strategy: "Respond",
    authority: "Sacral",
    profile: "2/4",
    definition: "Single Definition",
    incarnationCross: "Right Angle Cross",
    channels: [],
    activatedGates: [{ number: 1 }],
    definedCenters: ["Sacral"],
    undefinedCenters: ["Head"],
  },
};

const transitSnapshot = {
  id: "instant:2026-05-24T12:00:00.000Z",
  targetAt: "2026-05-24T12:00:00.000Z",
  calculatedAt: "2026-05-24T12:00:01.000Z",
  label: "Ahora",
  collective: {
    planets: [],
    activatedGates: [],
    activatedChannels: [],
    activatedCenters: [],
    temporarilyDefinedCenters: [],
  },
};

describe("runGuideTurn context selection", () => {
  it("logs conservative context mode for unknown chat models", async () => {
    const logWarn = vi.fn();
    const app = {
      log: {
        info: vi.fn(),
        warn: logWarn,
      },
    } as unknown as FastifyInstance;

    getTransitSnapshotCachedMock.mockResolvedValueOnce(transitSnapshot);
    analyzeTransitImpactMock.mockReturnValueOnce({
      personalChannels: [],
      conditionedCenters: [],
      reinforcedGates: [],
      educationalChannels: [],
    });
    runAstralAgentV2Mock.mockResolvedValueOnce({
      content: "respuesta",
      usage: { promptTokens: 1, completionTokens: 1 },
      latencyMs: 1,
      systemPrompt: "TEST",
    });

    await runGuideTurn({
      app,
      profile,
      messages: [
        { role: "user", content: "old question" },
        { role: "assistant", content: "old answer" },
        { role: "user", content: "current question" },
      ],
    });

    expect(runAstralAgentV2Mock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      [{ role: "user", content: "current question" }],
      expect.any(String),
      expect.any(Object),
      undefined,
      undefined,
      expect.objectContaining({
        model: "future-model",
        percentUsed: null,
        selection: expect.objectContaining({
          reason: "unknown_model_conservative",
          omittedMessageCount: 2,
        }),
      }),
    );
    expect(logWarn).toHaveBeenCalledWith(
      {
        model: "future-model",
        userId: undefined,
      },
      "chat_context_unknown_model",
    );
  });
});
