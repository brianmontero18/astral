/**
 * Smoke test for the v2 chat path (Vercel AI SDK + HD tools).
 *
 * Validates against the real OpenAI API (no mocks) that the v2 stack
 * resolves the Daniela 2026-05-15 hallucination case ("Puerta 8 →
 * Canal del Carisma 20-34" — false; correct is Canal de Inspiración
 * 1-8).
 *
 * USAGE:
 *   cd backend && npm run smoke:chat-v2          # 5 runs (default)
 *   cd backend && npm run smoke:chat-v2 -- 10    # custom N
 *
 * EXIT CODES:
 *   0 = all runs PASS
 *   1 = at least one FAIL
 *   2 = setup error (missing env, etc)
 *
 * NOTE: requires OPENAI_API_KEY in env. Each run costs ~$0.002 with
 * gpt-4o-mini, so 5 runs ≈ $0.01. Safe to call repeatedly.
 */

import {
  runAstralAgentStreamV2,
} from "../src/agent-service-v2.js";
import { buildSystemPromptV2 } from "../src/agent-service-v2-prompt.js";
import type { UserProfile } from "../src/agent-service.js";
import type { AgentCallMeta } from "../src/agent-service.js";
import type { WeeklyTransits } from "../src/transit-service.js";

const openaiKey = process.env.OPENAI_API_KEY;
if (!openaiKey) {
  console.error("✘ Missing OPENAI_API_KEY");
  process.exit(2);
}

// Canonical Daniela case profile (HD that matches the prod row at the time
// of the bug). Gate 8 is in personality, Gate 1 also active — the bug was
// the model saying these two formed channels that they don't form.
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

const userMessage =
  "Tengo la Puerta 8 activa. ¿Qué canal forma la Puerta 8? Nombre del canal, las dos puertas que lo componen y el circuito al que pertenece. Sé específico.";

const N = Number(process.argv[2] ?? 5);
if (!Number.isFinite(N) || N < 1) {
  console.error(`✘ Invalid N (${process.argv[2]}). Expected a positive integer.`);
  process.exit(2);
}

interface RunResult {
  run: number;
  pass: boolean;
  text: string;
  toolsUsed: string[];
  reason?: string;
}

// PASS rules (anchored to the bug Daniela observed):
//   - The response must name "Canal de Inspiración" (the correct channel
//     for Gate 8) OR reference the gates 1 and 8 explicitly.
//   - The response must NOT associate Gate 8 with any of the known wrong
//     channels (Carisma 20-34, Aceptación 17-62, Apertura 12-22, etc).
const correctChannelRegex = /canal\s+de\s+(la\s+)?inspiraci[oó]n/i;
// `[\s\S]{0,160}` instead of `.{0,80}` so the match crosses newlines —
// the model often answers with bulleted lists where "Puerta 1" and
// "Puerta 8" sit on separate lines.
const correctPairRegex = /\b1-8\b|puertas?\s+1\b[\s\S]{0,160}puertas?\s+8\b|puertas?\s+8\b[\s\S]{0,160}puertas?\s+1\b/i;
const knownWrongAssociations = [
  /canal\s+(del?|de\s+la)\s+carisma[\s\S]{0,160}puerta\s*8|puerta\s*8[\s\S]{0,160}canal\s+(del?|de\s+la)\s+carisma/i,
  /canal\s+(del?|de\s+la)\s+aceptaci[oó]n[\s\S]{0,160}puerta\s*8|puerta\s*8[\s\S]{0,160}canal\s+(del?|de\s+la)\s+aceptaci[oó]n/i,
  /canal\s+(del?|de\s+la)\s+apertura[\s\S]{0,160}puerta\s*8|puerta\s*8[\s\S]{0,160}canal\s+(del?|de\s+la)\s+apertura/i,
];

function evaluate(
  text: string,
  toolsUsed: string[],
): { pass: boolean; reason?: string } {
  // Strip markdown emphasis (`**bold**`, `*italic*`) so regex anchored to
  // word boundaries still matches when the model wraps tokens in bold.
  const clean = text.replace(/\*+/g, "");

  if (toolsUsed.length === 0) {
    return { pass: false, reason: "No hay evidencia de uso de HD tool." };
  }
  for (const wrong of knownWrongAssociations) {
    if (wrong.test(clean)) {
      return { pass: false, reason: "Asocia la Puerta 8 con un canal incorrecto." };
    }
  }
  const correctChannel = correctChannelRegex.test(clean);
  const correctPair = correctPairRegex.test(clean);
  if (!correctChannel) {
    return { pass: false, reason: "No menciona 'Canal de Inspiración'." };
  }
  if (!correctPair) {
    return { pass: false, reason: "Menciona el canal pero no las puertas 1 y 8." };
  }
  return { pass: true };
}

const promptLength = buildSystemPromptV2(profile, transits, undefined, undefined, undefined).length;

console.log("──────────────────────────────────────────────────────────");
console.log("Smoke: chat v2 (Vercel AI SDK + HD tools) — caso Daniela");
console.log("──────────────────────────────────────────────────────────");
console.log(`Runs:               ${N}`);
console.log(`System prompt size: ${promptLength.toLocaleString()} chars`);
console.log(`User message:       "${userMessage.slice(0, 80)}..."`);
console.log();

const results: RunResult[] = [];

for (let i = 1; i <= N; i++) {
  let text = "";
  let meta: AgentCallMeta | null = null;
  try {
    for await (const chunk of runAstralAgentStreamV2(
      profile,
      transits,
      [{ role: "user", content: userMessage }],
      openaiKey,
      undefined,
      undefined,
      undefined,
      (completedMeta) => {
        meta = completedMeta;
      },
    )) {
      text += chunk;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`Run ${i}: ✘ ERROR — ${message}`);
    results.push({ run: i, pass: false, text: "", toolsUsed: [], reason: `stream error: ${message}` });
    continue;
  }

  const toolsUsed = meta?.toolsUsed ?? [];
  const verdict = evaluate(text, toolsUsed);
  const firstLine = text.split("\n").find((l) => l.trim().length > 0)?.slice(0, 140) ?? "(empty)";
  const icon = verdict.pass ? "✓" : "✘";
  const toolSummary = toolsUsed.length ? `tools=${toolsUsed.join(",")}` : "tools=none";
  console.log(`Run ${i}: ${icon} ${verdict.pass ? "PASS" : "FAIL"} (${toolSummary}) — ${firstLine}`);
  if (!verdict.pass && verdict.reason) {
    console.log(`        Reason: ${verdict.reason}`);
  }
  results.push({ run: i, pass: verdict.pass, text, toolsUsed, reason: verdict.reason });
}

const passed = results.filter((r) => r.pass).length;
const rate = Math.round((passed * 100) / N);

console.log();
console.log("──────────────────────────────────────────────────────────");
console.log(`PASS rate: ${passed}/${N} (${rate}%)`);
console.log("──────────────────────────────────────────────────────────");

// Exit policy: 100% PASS required for green CI. Anything else is a regression.
process.exit(passed === N ? 0 : 1);
