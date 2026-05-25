import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { generateReport } from "../src/report/generate-report.js";
import { runAstralAgentStreamV2, runAstralAgentV2 } from "../src/agent-service-v2.js";
import { runMemoryWriter } from "../src/memory-writer.js";
import { calculateCost } from "../src/llm/pricing.js";
import {
  buildOpenAiLiveEvalPlan,
  formatConsentRequest,
  requireLiveEvalConsent,
  type OpenAiLiveEvalRoute,
} from "../src/evals/openai-live-eval.js";
import {
  evalMentionsCanonicalChannel,
  evalRejectsInvalidChannelPair,
  type ChannelExpectation,
} from "../src/evals/prompt-eval.js";
import type { ChatMessage, UserProfile } from "../src/types/agent.js";
import type { WeeklyTransits } from "../src/transit-service.js";
import type { Intake } from "../src/report/types.js";

interface CliOptions {
  confirmRealTokens: boolean;
  maxCostUsd?: number;
  includeTranscribe: boolean;
  audioFixturePath?: string;
  audioExpected?: string;
  outPath: string;
}

interface EvalRow {
  route: OpenAiLiveEvalRoute;
  model: string;
  fixtureId: string;
  pass: boolean;
  reason: string;
  toolCalls: string[];
  toolsUsed: string[];
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  costUsd: number | null;
  latencyMs: number | null;
  outputPreview: string;
}

interface ChatFixture {
  id: string;
  message: string;
  evaluate: (output: string, toolsUsed: string[]) => { pass: boolean; reason: string };
}

interface MemoryFixture {
  id: string;
  currentMemory: string;
  messages: ChatMessage[];
  evaluate: (result: { memory: string; noop: boolean }) => { pass: boolean; reason: string };
}

const CHAT_MODELS = ["gpt-4o-mini", "gpt-5.4-mini"];
const REPORT_MODELS = ["gpt-4o-mini", "gpt-5.4-mini", "gpt-5.4"];
const MEMORY_MODELS = ["gpt-4o-mini", "gpt-5.4-nano"];
const TRANSCRIBE_MODELS = ["whisper-1", "gpt-4o-mini-transcribe"];
const CHAT_ROUTES: OpenAiLiveEvalRoute[] = ["chat_stream", "chat", "mcp_ask"];

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
    channels: [
      { id: "1-8", name: "Canal de Inspiración", circuit: "Individual Knowing" },
      { id: "5-15", name: "Canal del Ritmo", circuit: "Collective Understanding" },
    ],
    activatedGates: [
      { number: 1, line: 3, planet: "Mercury", isPersonality: true },
      { number: 8, line: 4, planet: "Saturn", isPersonality: true },
      { number: 5, line: 2, planet: "Moon", isPersonality: true },
      { number: 15, line: 5, planet: "Venus", isPersonality: true },
    ],
    definedCenters: ["G", "Throat"],
    undefinedCenters: ["Head", "Ajna", "Spleen"],
  },
};

const transits: WeeklyTransits = {
  fetchedAt: "2026-05-15T17:00:00Z",
  weekRange: "2026-05-11 / 2026-05-17",
  planets: [
    { name: "Sun", longitude: 54.5, sign: "Tauro", degree: 24.5, isRetrograde: false, hdGate: 8, hdLine: 4 },
  ],
  activatedChannels: [],
};

const intake: Intake = {
  actividad: "Mentora y creadora de contenido",
  desafio_actual: "Ordenar mejor mi oferta sin sobreexigirme",
  tipo_de_negocio: "mentora",
  objetivo_12m: "Vender un programa premium sostenible",
  voz_marca: "Clara, cálida y directa",
};

function parseCli(args: string[]): CliOptions {
  const options: CliOptions = {
    confirmRealTokens: false,
    includeTranscribe: false,
    outPath: path.join("live-eval-results", `openai-e2h15-${Date.now()}.json`),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--confirm-real-tokens") {
      options.confirmRealTokens = true;
    } else if (arg === "--include-transcribe") {
      options.includeTranscribe = true;
    } else if (arg === "--max-cost-usd") {
      options.maxCostUsd = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--audio-fixture") {
      options.audioFixturePath = args[index + 1];
      index += 1;
    } else if (arg === "--audio-expected") {
      options.audioExpected = args[index + 1];
      index += 1;
    } else if (arg === "--out") {
      options.outPath = args[index + 1] ?? options.outPath;
      index += 1;
    }
  }

  return options;
}

function costFor(model: string, promptTokens: number, completionTokens: number, cachedTokens: number): number | null {
  const cost = calculateCost(model, promptTokens, completionTokens, {
    cachedInputTokens: cachedTokens,
  });
  return cost === 0 ? null : Math.round(cost * 1_000_000) / 1_000_000;
}

function preview(output: string): string {
  return output.replace(/\s+/g, " ").trim().slice(0, 240);
}

function channelEval(expected: ChannelExpectation) {
  return (output: string, toolsUsed: string[]) => {
    if (toolsUsed.length === 0) {
      return { pass: false, reason: "No hubo tool call HD." };
    }
    const result = evalMentionsCanonicalChannel(output, expected);
    return result.pass
      ? { pass: true, reason: result.reason }
      : { pass: false, reason: result.reason };
  };
}

function invalidPairEval(id: string) {
  return (output: string, toolsUsed: string[]) => {
    if (toolsUsed.length === 0) {
      return { pass: false, reason: "No hubo tool call HD." };
    }
    const result = evalRejectsInvalidChannelPair(output, id);
    return result.pass
      ? { pass: true, reason: result.reason }
      : { pass: false, reason: result.reason };
  };
}

function smallTalkEval(output: string, toolsUsed: string[]) {
  if (toolsUsed.length > 0) {
    return { pass: false, reason: `Small talk no deberia usar tools: ${toolsUsed.join(",")}` };
  }
  return output.trim().length > 0
    ? { pass: true, reason: "Respuesta conversacional sin tool innecesaria." }
    : { pass: false, reason: "Respuesta vacia." };
}

function chatFixtures(): ChatFixture[] {
  return [
    {
      id: "daniela-gate-8",
      message: "Tengo la Puerta 8 activa. ¿Qué canal forma la Puerta 8? Nombre del canal, las dos puertas y circuito.",
      evaluate: channelEval({ id: "1-8", gates: [1, 8], name: "Canal de Inspiración" }),
    },
    ...["1-2", "5-6", "12-20", "30-31"].map((id) => ({
      id: `invalid-${id}`,
      message: `¿Qué significa el canal ${id} en Diseño Humano?`,
      evaluate: invalidPairEval(id),
    })),
    {
      id: "valid-5-15",
      message: "Confirmame el canal 5-15: nombre, puertas y circuito.",
      evaluate: channelEval({ id: "5-15", gates: [5, 15], name: "Canal del Ritmo" }),
    },
    {
      id: "valid-1-8",
      message: "Confirmame el canal 1-8: nombre, puertas y circuito.",
      evaluate: channelEval({ id: "1-8", gates: [1, 8], name: "Canal de Inspiración" }),
    },
    {
      id: "small-talk",
      message: "Hola, ¿cómo estás?",
      evaluate: smallTalkEval,
    },
  ];
}

function memoryFixtures(): MemoryFixture[] {
  return [
    {
      id: "noop",
      currentMemory: "## Identidad\n- Camila es mentora.",
      messages: [{ role: "user", content: "Gracias, seguimos después." }],
      evaluate: (result) => result.noop
        ? { pass: true, reason: "NOOP correcto." }
        : { pass: false, reason: "Debia ser NOOP." },
    },
    {
      id: "add",
      currentMemory: "",
      messages: [{ role: "user", content: "Soy Camila y acompaño a emprendedoras con mentorías premium." }],
      evaluate: (result) => !result.noop && /Camila|mentor/i.test(result.memory)
        ? { pass: true, reason: "Agrego fact nuevo." }
        : { pass: false, reason: "No agrego el fact esperado." },
    },
    {
      id: "update",
      currentMemory: "## Negocio\n- Camila ofrece sesiones sueltas.",
      messages: [{ role: "user", content: "Actualización: ya no vendo sesiones sueltas, ahora vendo un programa premium grupal." }],
      evaluate: (result) => !result.noop &&
        /programa premium/i.test(result.memory) &&
        (!/sesiones sueltas/i.test(result.memory) || /ya no vende sesiones sueltas/i.test(result.memory))
        ? { pass: true, reason: "Actualizo fact contradicho." }
        : { pass: false, reason: "No reemplazo el fact viejo correctamente." },
    },
    {
      id: "delete",
      currentMemory: "## Negocio\n- Camila ofrece tarot.\n- Camila ofrece mentorías.",
      messages: [{ role: "user", content: "No ofrezco tarot. Eso fue un error. Solo mentorías." }],
      evaluate: (result) => !result.noop && !/tarot/i.test(result.memory)
        ? { pass: true, reason: "Borro fact contradicho explicitamente." }
        : { pass: false, reason: "No borro el fact contradicho." },
    },
    {
      id: "no-invented-facts",
      currentMemory: "",
      messages: [{ role: "user", content: "Me llamo Camila." }],
      evaluate: (result) => /Camila/i.test(result.memory) && !/coach|astrolog|diseñadora|premium/i.test(result.memory)
        ? { pass: true, reason: "No invento negocio ni rol." }
        : { pass: false, reason: "Invento o omitio facts simples." },
    },
  ];
}

async function runChatFixture(route: OpenAiLiveEvalRoute, model: string, fixture: ChatFixture, openaiKey: string): Promise<EvalRow> {
  const started = Date.now();
  let output = "";
  let toolCalls: string[] = [];
  let toolsUsed: string[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let cachedTokens = 0;

  if (route === "chat_stream") {
    for await (const chunk of runAstralAgentStreamV2(
      profile,
      transits,
      [{ role: "user", content: fixture.message }],
      openaiKey,
      undefined,
      intake,
      undefined,
      (meta) => {
        toolCalls = meta.toolCalls ?? [];
        toolsUsed = meta.toolsUsed ?? [];
        promptTokens = meta.usage.promptTokens;
        completionTokens = meta.usage.completionTokens;
        cachedTokens = meta.usage.cachedTokens ?? 0;
      },
      undefined,
      { model },
    )) {
      output += chunk;
    }
  } else {
    const result = await runAstralAgentV2(
      profile,
      transits,
      [{ role: "user", content: fixture.message }],
      openaiKey,
      undefined,
      intake,
      undefined,
      undefined,
      { model },
    );
    output = result.content;
    toolCalls = result.toolCalls ?? [];
    toolsUsed = result.toolsUsed ?? [];
    promptTokens = result.usage.promptTokens;
    completionTokens = result.usage.completionTokens;
    cachedTokens = result.usage.cachedTokens ?? 0;
  }

  const verdict = fixture.evaluate(output, toolsUsed);

  return {
    route,
    model,
    fixtureId: fixture.id,
    pass: verdict.pass,
    reason: verdict.reason,
    toolCalls,
    toolsUsed,
    promptTokens,
    completionTokens,
    cachedTokens,
    costUsd: costFor(model, promptTokens, completionTokens, cachedTokens),
    latencyMs: Date.now() - started,
    outputPreview: preview(output),
  };
}

function evaluateReportSections(sections: Awaited<ReturnType<typeof generateReport>>["sections"]) {
  const missing = sections
    .filter((section) => section.id !== "mechanical-chart")
    .filter((section) => !section.staticContent && !section.llmContent && !section.previewContent)
    .map((section) => section.id);
  if (missing.length > 0) {
    return { pass: false, reason: `Secciones vacias: ${missing.join(", ")}` };
  }
  const premiumMissing = sections
    .filter((section) => section.tier === "premium")
    .filter((section) => !section.llmContent?.trim())
    .map((section) => section.id);
  if (premiumMissing.length > 0) {
    return { pass: false, reason: `Premium incompleto: ${premiumMissing.join(", ")}` };
  }
  return { pass: true, reason: "Reporte premium completo y parseable." };
}

async function runReportEval(model: string, openaiKey: string): Promise<EvalRow> {
  const started = Date.now();
  const report = await generateReport(profile, "premium", openaiKey, intake, { model });
  const verdict = report.degraded
    ? { pass: false, reason: "Reporte degradado." }
    : evaluateReportSections(report.sections);
  const output = report.sections
    .map((section) => `${section.title}\n${section.staticContent}\n${section.llmContent ?? ""}`)
    .join("\n\n");

  return {
    route: "report",
    model,
    fixtureId: "premium-report",
    pass: verdict.pass,
    reason: verdict.reason,
    toolCalls: [],
    toolsUsed: [],
    promptTokens: report.llmUsage?.promptTokens ?? 0,
    completionTokens: report.llmUsage?.completionTokens ?? 0,
    cachedTokens: 0,
    costUsd: report.costUsd,
    latencyMs: Date.now() - started,
    outputPreview: preview(output),
  };
}

async function runMemoryEval(model: string, fixture: MemoryFixture, openaiKey: string): Promise<EvalRow> {
  const result = await runMemoryWriter(
    fixture.currentMemory,
    fixture.messages,
    openaiKey,
    { model },
  );
  const verdict = fixture.evaluate(result);

  return {
    route: "memory_writer",
    model,
    fixtureId: fixture.id,
    pass: verdict.pass,
    reason: verdict.reason,
    toolCalls: [],
    toolsUsed: [],
    promptTokens: result.meta.usage.promptTokens,
    completionTokens: result.meta.usage.completionTokens,
    cachedTokens: result.meta.usage.cachedTokens ?? 0,
    costUsd: costFor(model, result.meta.usage.promptTokens, result.meta.usage.completionTokens, result.meta.usage.cachedTokens ?? 0),
    latencyMs: result.meta.latencyMs,
    outputPreview: preview(result.memory),
  };
}

async function runTranscribeEval(model: string, audioPath: string, expected: string, openaiKey: string): Promise<EvalRow> {
  const started = Date.now();
  const buffer = await readFile(audioPath);
  const formData = new FormData();
  formData.append("file", new Blob([buffer]), path.basename(audioPath));
  formData.append("model", model);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Transcribe API error ${response.status}: ${body}`);
  }
  const data = await response.json() as { text?: string };
  const text = data.text ?? "";
  const pass = text.toLowerCase().includes(expected.toLowerCase());

  return {
    route: "transcribe",
    model,
    fixtureId: "consented-audio",
    pass,
    reason: pass ? "Transcript contiene el texto esperado." : "Transcript no contiene el texto esperado.",
    toolCalls: [],
    toolsUsed: [],
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    costUsd: null,
    latencyMs: Date.now() - started,
    outputPreview: preview(text),
  };
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const includeTranscribe =
    options.includeTranscribe &&
    Boolean(options.audioFixturePath) &&
    Boolean(options.audioExpected);
  const plan = buildOpenAiLiveEvalPlan({
    includeTranscribe,
    audioFixturePath: options.audioFixturePath,
  });

  if (!options.confirmRealTokens) {
    console.log(formatConsentRequest(plan));
    console.log("");
    console.log("Para correr: npm run eval:openai-live -- --confirm-real-tokens --max-cost-usd <cap>");
    return;
  }

  requireLiveEvalConsent(plan, {
    confirmed: options.confirmRealTokens,
    maxCostUsd: options.maxCostUsd,
  });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const rows: EvalRow[] = [];
  for (const route of CHAT_ROUTES) {
    for (const model of CHAT_MODELS) {
      for (const fixture of chatFixtures()) {
        rows.push(await runChatFixture(route, model, fixture, openaiKey));
      }
    }
  }
  for (const model of REPORT_MODELS) {
    rows.push(await runReportEval(model, openaiKey));
  }
  for (const model of MEMORY_MODELS) {
    for (const fixture of memoryFixtures()) {
      rows.push(await runMemoryEval(model, fixture, openaiKey));
    }
  }
  if (includeTranscribe && options.audioFixturePath && options.audioExpected) {
    for (const model of TRANSCRIBE_MODELS) {
      rows.push(await runTranscribeEval(model, options.audioFixturePath, options.audioExpected, openaiKey));
    }
  }

  const passCount = rows.filter((row) => row.pass).length;
  const knownCostUsd = rows.reduce((total, row) => total + (row.costUsd ?? 0), 0);
  const result = {
    plan,
    summary: {
      rows: rows.length,
      pass: passCount,
      fail: rows.length - passCount,
      knownCostUsd: Math.round(knownCostUsd * 1_000_000) / 1_000_000,
    },
    rows,
  };

  await mkdir(path.dirname(options.outPath), { recursive: true });
  await writeFile(options.outPath, JSON.stringify(result, null, 2));
  console.log(`Wrote ${options.outPath}`);
  console.log(`PASS ${passCount}/${rows.length}; known cost USD ${result.summary.knownCostUsd}`);
  process.exitCode = passCount === rows.length ? 0 : 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
