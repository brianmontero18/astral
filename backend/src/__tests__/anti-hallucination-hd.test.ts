import { beforeEach, describe, expect, it, vi } from "vitest";

import { runAstralAgentV2 } from "../agent-service-v2.js";
import type { HdChannel } from "../hd-channels.js";
import type { WeeklyTransits } from "../transit-service.js";
import type { ChatMessage, UserProfile } from "../types/agent.js";
import {
  evalMentionsCanonicalChannel,
  evalRejectsInvalidChannelPair,
  runEvals,
} from "./prompt-eval.js";

interface AiTool<TInput, TOutput> {
  execute?: (input: TInput, options?: unknown) => Promise<TOutput>;
}

interface HdToolsForTest {
  findChannelByGates: AiTool<{ gateA: number; gateB: number }, HdChannel | null>;
  findChannelsByGate: AiTool<{ gate: number }, HdChannel[]>;
  findChannelById: AiTool<{ id: string }, HdChannel | null>;
}

interface AgentGenerateOptions {
  model: { model: string };
  system: string;
  messages: ChatMessage[];
  tools: HdToolsForTest;
}

interface MockGenerateTextResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    inputTokenDetails: { cacheReadTokens: number };
  };
  steps: Array<{ toolCalls: Array<{ toolName: string }> }>;
}

interface ChannelCase {
  id: string;
  gates: readonly [number, number];
  name: string;
}

interface InvalidChannelCase {
  id: string;
}

const mocks = vi.hoisted(() => ({
  generateText: vi.fn<(options: AgentGenerateOptions) => Promise<MockGenerateTextResult>>(),
}));

vi.mock("ai", () => ({
  generateText: (options: AgentGenerateOptions) => mocks.generateText(options),
  stepCountIs: (maxSteps: number) => ({ maxSteps }),
  streamText: vi.fn(),
  tool: <TDefinition>(definition: TDefinition): TDefinition => definition,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => (model: string) => ({ model }),
}));

const invalidPairs: readonly InvalidChannelCase[] = [
  { id: "1-2" },
  { id: "5-6" },
  { id: "12-20" },
  { id: "30-31" },
];

const validChannels: readonly ChannelCase[] = [
  { id: "28-38", gates: [28, 38], name: "Canal de la Lucha" },
  { id: "5-15", gates: [5, 15], name: "Canal del Ritmo" },
  { id: "19-49", gates: [19, 49], name: "Canal de la Síntesis" },
];

const profile: UserProfile = {
  name: "Daniela Medina",
  humanDesign: {
    type: "Generador Manifestante",
    strategy: "Esperar para responder y luego informar",
    authority: "Emocional (Plexo Solar)",
    profile: "6/2",
    definition: "Definición dividida",
    incarnationCross: "",
    notSelfTheme: "Frustración",
    variable: "",
    digestion: "",
    environment: "",
    strongestSense: "",
    channels: [],
    activatedGates: [
      { number: 1, line: 3, planet: "Mercury", isPersonality: true },
      { number: 8, line: 4, planet: "Saturn", isPersonality: true },
      { number: 12, line: 2, planet: "Venus", isPersonality: true },
      { number: 20, line: 5, planet: "Sun", isPersonality: true },
    ],
    definedCenters: ["G", "Throat"],
    undefinedCenters: ["Head", "Ajna", "Spleen"],
  },
};

const transits: WeeklyTransits = {
  fetchedAt: "2026-05-15T17:00:00Z",
  weekRange: "2026-05-11 / 2026-05-17",
  planets: [
    {
      name: "Sun",
      longitude: 54.5,
      sign: "Tauro",
      degree: 24.5,
      isRetrograde: false,
      hdGate: 8,
      hdLine: 4,
    },
  ],
  activatedChannels: [],
};

function successResult(text: string, toolName: string): MockGenerateTextResult {
  return {
    text,
    usage: {
      inputTokens: 100,
      outputTokens: 40,
      cachedInputTokens: 0,
      inputTokenDetails: { cacheReadTokens: 0 },
    },
    steps: [{ toolCalls: [{ toolName }] }],
  };
}

function unsafeResult(text: string): MockGenerateTextResult {
  return {
    text,
    usage: {
      inputTokens: 100,
      outputTokens: 40,
      cachedInputTokens: 0,
      inputTokenDetails: { cacheReadTokens: 0 },
    },
    steps: [{ toolCalls: [] }],
  };
}

function lastUserMessage(messages: ChatMessage[]): string {
  return messages.at(-1)?.content ?? "";
}

function extractChannelPair(message: string): readonly [number, number] | null {
  const match = message.match(/\b(\d{1,2})-(\d{1,2})\b/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

async function executeTool<TInput, TOutput>(
  toolDef: AiTool<TInput, TOutput>,
  input: TInput,
  name: string,
): Promise<TOutput> {
  if (!toolDef.execute) {
    throw new Error(`${name} has no execute function`);
  }
  return toolDef.execute(input, {});
}

async function mockGenerateText(options: AgentGenerateOptions): Promise<MockGenerateTextResult> {
  const message = lastUserMessage(options.messages);

  if (/aprovecho esto esta semana/i.test(message)) {
    if (options.system.includes("LEAK_IMPACT_CHANNEL")) {
      return unsafeResult(
        "LEAK_IMPACT_CHANNEL te pide usar esa energía esta semana.",
      );
    }

    const channelId = options.system.match(/channel_id="(\d{1,2}-\d{1,2})"/)?.[1];
    if (!channelId) {
      throw new Error("Impact context did not provide a channel_id hint");
    }

    const channel = await executeTool(
      options.tools.findChannelById,
      { id: channelId },
      "findChannelById",
    );
    if (!channel) {
      throw new Error(`findChannelById did not resolve ${channelId}`);
    }
    return successResult(
      `${channel.name} (${channel.id}) está activado como contexto de la semana; usalo como foco, no como adorno.`,
      "findChannelById",
    );
  }

  if (/puerta\s+8/i.test(message)) {
    const channels = await executeTool(
      options.tools.findChannelsByGate,
      { gate: 8 },
      "findChannelsByGate",
    );
    const channel = channels.find((candidate) => candidate.id === "1-8");
    if (!channel) {
      throw new Error("findChannelsByGate did not resolve Gate 8 to 1-8");
    }
    return successResult(
      `${channel.name} (${channel.id}) une Puerta ${channel.gates[0]} y Puerta ${channel.gates[1]}. Circuito ${channel.circuit}/${channel.subCircuit}.`,
      "findChannelsByGate",
    );
  }

  const pair = extractChannelPair(message);
  if (!pair) {
    throw new Error(`Test prompt did not include a channel id: ${message}`);
  }

  const channel = await executeTool(
    options.tools.findChannelByGates,
    { gateA: pair[0], gateB: pair[1] },
    "findChannelByGates",
  );
  if (!channel) {
    return successResult(
      `El canal ${pair[0]}-${pair[1]} no existe en la tabla canónica. Las puertas ${pair[0]} y ${pair[1]} no forman un canal HD.`,
      "findChannelByGates",
    );
  }

  return successResult(
    `${channel.name} (${channel.id}) une Puerta ${channel.gates[0]} y Puerta ${channel.gates[1]}. Circuito ${channel.circuit}/${channel.subCircuit}.`,
    "findChannelByGates",
  );
}

async function askAgent(content: string) {
  return runAstralAgentV2(
    profile,
    transits,
    [{ role: "user", content }],
    "test-openai-key",
  );
}

async function askAgentWithModel(content: string, model: string) {
  return runAstralAgentV2(
    profile,
    transits,
    [{ role: "user", content }],
    "test-openai-key",
    undefined,
    undefined,
    undefined,
    undefined,
    { model },
  );
}

describe("anti-hallucination HD regression suite", () => {
  beforeEach(() => {
    mocks.generateText.mockReset();
    mocks.generateText.mockImplementation(mockGenerateText);
  });

  it.each(invalidPairs)("rejects invalid channel pair $id", async ({ id }) => {
    const result = await askAgent(`¿Qué significa el canal ${id} en Diseño Humano?`);
    const evals = runEvals([
      { name: `rejects ${id}`, fn: () => evalRejectsInvalidChannelPair(result.content, id) },
    ]);

    expect(evals.failed, evals.results.map((r) => r.reason).join("; ")).toBe(0);
    expect(result.toolCalls).toEqual(["findChannelByGates"]);
    expect(result.toolsUsed).toEqual(["findChannelByGates"]);
  });

  it("resolves Gate 8 to 1-8 / Canal de Inspiración", async () => {
    const result = await askAgent(
      "Tengo la Puerta 8 activa. ¿Qué canal forma la Puerta 8? Nombre del canal, las dos puertas y circuito.",
    );
    const evals = runEvals([
      {
        name: "Gate 8 resolves to Canal de Inspiración",
        fn: () =>
          evalMentionsCanonicalChannel(result.content, {
            id: "1-8",
            gates: [1, 8],
            name: "Canal de Inspiración",
          }),
      },
    ]);

    expect(evals.failed, evals.results.map((r) => r.reason).join("; ")).toBe(0);
    expect(result.toolCalls).toEqual(["findChannelsByGate"]);
    expect(result.toolsUsed).toEqual(["findChannelsByGate"]);
  });

  it("can run the same canonical chat path with an explicit eval model override", async () => {
    const result = await askAgentWithModel(
      "Tengo la Puerta 8 activa. ¿Qué canal forma la Puerta 8? Nombre del canal, las dos puertas y circuito.",
      "gpt-5.4-mini",
    );

    expect(result.contextBudget.model).toBe("gpt-5.4-mini");
    expect(result.contextBudget.contextWindowTokens).toBe(400_000);
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: { model: "gpt-5.4-mini" } }),
    );
  });

  it.each(validChannels)("resolves valid channel $id / $name", async (channelCase) => {
    const result = await askAgent(
      `Confirmame el canal ${channelCase.id}: nombre, puertas y circuito.`,
    );
    const evals = runEvals([
      {
        name: `valid ${channelCase.id}`,
        fn: () => evalMentionsCanonicalChannel(result.content, channelCase),
      },
    ]);

    expect(evals.failed, evals.results.map((r) => r.reason).join("; ")).toBe(0);
    expect(result.toolCalls).toEqual(["findChannelByGates"]);
    expect(result.toolsUsed).toEqual(["findChannelByGates"]);
  });

  it("does not let deterministic impact context replace channel tool lookup", async () => {
    const profileWithChannelLeak: UserProfile = {
      ...profile,
      humanDesign: {
        ...profile.humanDesign,
        channels: [{ id: "1-8", name: "LEAK_NATAL_CHANNEL", circuit: "Individual" }],
      },
    };
    const transitsWithChannelLeak: WeeklyTransits = {
      ...transits,
      activatedChannels: ["LEAK_TRANSIT_CHANNEL"],
    };

    const result = await runAstralAgentV2(
      profileWithChannelLeak,
      transitsWithChannelLeak,
      [{ role: "user", content: "¿Cómo aprovecho esto esta semana?" }],
      "test-openai-key",
      {
        personalChannels: [
          {
            channelId: "1-8",
            channelName: "LEAK_IMPACT_CHANNEL",
            userGate: 1,
            transitGate: 8,
            transitPlanet: "Sol",
          },
        ],
        educationalChannels: [],
        reinforcedGates: [],
        conditionedCenters: [],
      },
    );

    expect(result.content).toContain("Canal de Inspiración");
    expect(result.content).not.toContain("LEAK_IMPACT_CHANNEL");
    expect(result.toolCalls).toEqual(["findChannelById"]);
    expect(result.toolsUsed).toEqual(["findChannelById"]);
  });
});

describe("anti-hallucination output evaluators", () => {
  it("fails clearly when the Daniela 12-20 pair is hallucinated as a channel", () => {
    const verdict = evalRejectsInvalidChannelPair(
      "El Canal 12-20 existe y conecta la Puerta 12 con la Puerta 20.",
      "12-20",
    );

    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toContain("12-20");
  });

  it("accepts explicit rejection of the Daniela 12-20 pair", () => {
    const verdict = evalRejectsInvalidChannelPair(
      "El canal 12-20 no existe en la tabla canónica; las Puertas 12 y 20 no forman un canal HD.",
      "12-20",
    );

    expect(verdict.pass, verdict.reason).toBe(true);
  });
});
