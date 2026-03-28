/**
 * Report Generation — Hybrid Static + LLM
 *
 * Builds a DesignReport from:
 * - 75% pre-written static descriptions (static-content.ts)
 * - 25% personalized LLM interpretations (3 parallel calls for premium, 1 for free)
 *
 * Caching: reports are stored by (userId, tier, profileHash).
 * If the hash matches, the cached report is returned.
 */

import { createHash } from "node:crypto";
import type { UserProfile } from "../agent-service.js";
import {
  TYPE_DESCRIPTIONS,
  AUTHORITY_DESCRIPTIONS,
  PROFILE_DESCRIPTIONS,
  DEFINITION_DESCRIPTIONS,
  CHANNEL_DESCRIPTIONS,
  CENTER_UNDEFINED_DESCRIPTIONS,
  DIGESTION_DESCRIPTIONS,
  ENVIRONMENT_DESCRIPTIONS,
  STRONGEST_SENSE_DESCRIPTIONS,
} from "./static-content.js";
import { centerToSpanish } from "./hd-i18n.js";
import { SECTION_META } from "./types.js";
import type { Intake, ReportTier, ReportSection, DesignReport } from "./types.js";
import {
  buildCall1FreePrompt,
  buildCall1PremiumPrompt,
  buildCall2Prompt,
  buildCall3Prompt,
} from "./prompts.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export function computeProfileHash(profile: UserProfile, intake?: Intake): string {
  const data = JSON.stringify({ profile: profile.humanDesign, intake: intake ?? null });
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

// ─── OpenAI helper ───────────────────────────────────────────────────────────

interface LLMResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

async function callLLM(
  system: string,
  user: string,
  openaiKey: string,
): Promise<LLMResult> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? "",
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callLLMWithRetry(
  system: string,
  user: string,
  openaiKey: string,
): Promise<LLMResult> {
  try {
    return await callLLM(system, user, openaiKey);
  } catch {
    try {
      return await callLLM(system, user, openaiKey);
    } catch {
      return { content: "", promptTokens: 0, completionTokens: 0 };
    }
  }
}

// ─── Static section builders ─────────────────────────────────────────────────

function buildMechanicalChart(profile: UserProfile): string {
  const hd = profile.humanDesign;
  const lines: string[] = [];
  lines.push(`Tipo: ${hd.type}`);
  lines.push(`Estrategia: ${hd.strategy}`);
  lines.push(`Autoridad: ${hd.authority}`);
  lines.push(`Perfil: ${hd.profile}`);
  lines.push(`Definición: ${hd.definition}`);
  if (hd.incarnationCross) lines.push(`Cruz de Encarnación: ${hd.incarnationCross}`);
  if (hd.notSelfTheme) lines.push(`Tema del no-ser: ${hd.notSelfTheme}`);
  if (hd.channels.length) {
    lines.push(`\nCanales (${hd.channels.length}):`);
    for (const c of hd.channels) {
      lines.push(`  • ${c.name} (${c.id})`);
    }
  }
  if (hd.definedCenters.length) {
    lines.push(`\nCentros definidos: ${hd.definedCenters.map(c => centerToSpanish(c)).join(", ")}`);
  }
  if (hd.undefinedCenters.length) {
    lines.push(`Centros indefinidos: ${hd.undefinedCenters.map(c => centerToSpanish(c)).join(", ")}`);
  }
  if (hd.digestion) lines.push(`\nDigestión: ${hd.digestion}`);
  if (hd.environment) lines.push(`Ambiente: ${hd.environment}`);
  if (hd.strongestSense) lines.push(`Sentido más fuerte: ${hd.strongestSense}`);
  return lines.join("\n");
}

function getStaticType(profile: UserProfile): string {
  return TYPE_DESCRIPTIONS[profile.humanDesign.type] ?? "";
}

function getStaticAuthority(profile: UserProfile): string {
  return AUTHORITY_DESCRIPTIONS[profile.humanDesign.authority] ?? "";
}

function getStaticProfile(profile: UserProfile): string {
  return PROFILE_DESCRIPTIONS[profile.humanDesign.profile] ?? "";
}

function getStaticDefinition(profile: UserProfile): string {
  return DEFINITION_DESCRIPTIONS[profile.humanDesign.definition] ?? "";
}

function getStaticChannels(profile: UserProfile): string {
  const hd = profile.humanDesign;
  if (!hd.channels.length) return "No tenés canales definidos en tu diseño.";
  return hd.channels
    .map((c) => {
      const desc = CHANNEL_DESCRIPTIONS[c.id];
      return desc ? `${c.name} (${c.id})\n${desc}` : `${c.name} (${c.id})`;
    })
    .join("\n\n");
}

function getStaticUndefinedCenters(profile: UserProfile): string {
  const hd = profile.humanDesign;
  if (!hd.undefinedCenters.length) return "Todos tus centros están definidos.";
  return hd.undefinedCenters
    .map((c) => {
      const desc = CENTER_UNDEFINED_DESCRIPTIONS[c];
      const name = centerToSpanish(c);
      return desc ? `${name}\n${desc}` : name;
    })
    .join("\n\n");
}

function getStaticVariables(profile: UserProfile): string {
  const hd = profile.humanDesign;
  const parts: string[] = [];
  if (hd.digestion) {
    const desc = DIGESTION_DESCRIPTIONS[hd.digestion];
    parts.push(desc ? `Digestión: ${hd.digestion}\n${desc}` : `Digestión: ${hd.digestion}`);
  }
  if (hd.environment) {
    const desc = ENVIRONMENT_DESCRIPTIONS[hd.environment];
    parts.push(desc ? `Ambiente: ${hd.environment}\n${desc}` : `Ambiente: ${hd.environment}`);
  }
  if (hd.strongestSense) {
    const desc = STRONGEST_SENSE_DESCRIPTIONS[hd.strongestSense];
    parts.push(
      desc
        ? `Sentido más fuerte: ${hd.strongestSense}\n${desc}`
        : `Sentido más fuerte: ${hd.strongestSense}`,
    );
  }
  return parts.length ? parts.join("\n\n") : "No hay datos de variables disponibles en tu perfil.";
}

// ─── Report generation ───────────────────────────────────────────────────────

export async function generateReport(
  profile: UserProfile,
  tier: ReportTier,
  openaiKey: string,
  intake?: Intake,
): Promise<Omit<DesignReport, "id" | "userId" | "createdAt">> {
  const profileHash = computeProfileHash(profile, intake);

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let call1Result: LLMResult = { content: "", promptTokens: 0, completionTokens: 0 };
  let call2Result: LLMResult = { content: "", promptTokens: 0, completionTokens: 0 };
  let call3Result: LLMResult = { content: "", promptTokens: 0, completionTokens: 0 };

  if (tier === "free") {
    const prompt = buildCall1FreePrompt(profile, intake);
    call1Result = await callLLMWithRetry(prompt.system, prompt.user, openaiKey);
  } else {
    const p1 = buildCall1PremiumPrompt(profile, intake);
    const p2 = buildCall2Prompt(profile, intake);
    const p3 = buildCall3Prompt(profile, intake);

    [call1Result, call2Result, call3Result] = await Promise.all([
      callLLMWithRetry(p1.system, p1.user, openaiKey),
      callLLMWithRetry(p2.system, p2.user, openaiKey),
      callLLMWithRetry(p3.system, p3.user, openaiKey),
    ]);
  }

  totalPromptTokens = call1Result.promptTokens + call2Result.promptTokens + call3Result.promptTokens;
  totalCompletionTokens = call1Result.completionTokens + call2Result.completionTokens + call3Result.completionTokens;
  const tokensUsed = totalPromptTokens + totalCompletionTokens;

  // gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output
  const costUsd = (totalPromptTokens * 0.00000015) + (totalCompletionTokens * 0.0000006);

  // Parse LLM outputs
  const call1Parts = call1Result.content.split(/\n\n+/).filter(Boolean);
  const call2Parts = call2Result.content.split(/---+/).map(s => s.trim()).filter(Boolean);
  const call3Parts = call3Result.content.split(/---+/).map(s => s.trim()).filter(Boolean);

  // Build sections
  const sections: ReportSection[] = SECTION_META.map((meta) => {
    const section: ReportSection = {
      id: meta.id,
      title: meta.title,
      icon: meta.icon,
      tier: meta.tier,
      staticContent: "",
      teaser: meta.teaser,
    };

    switch (meta.id) {
      case "mechanical-chart":
        section.staticContent = buildMechanicalChart(profile);
        break;
      case "type":
        section.staticContent = getStaticType(profile);
        section.llmContent = call1Parts[0] ?? "";
        break;
      case "authority":
        section.staticContent = getStaticAuthority(profile);
        section.llmContent = call1Parts[1] ?? "";
        break;
      case "profile":
        section.staticContent = getStaticProfile(profile);
        section.llmContent = call1Parts[2] ?? "";
        break;
      case "definition":
        section.staticContent = getStaticDefinition(profile);
        section.llmContent = tier === "premium" ? (call1Parts[3] ?? "") : "";
        break;
      case "channels":
        section.staticContent = getStaticChannels(profile);
        section.llmContent = call2Parts[0] ?? "";
        break;
      case "undefined-centers":
        section.staticContent = getStaticUndefinedCenters(profile);
        section.llmContent = call2Parts[1] ?? "";
        break;
      case "variables":
        section.staticContent = getStaticVariables(profile);
        section.llmContent = call2Parts[2] ?? "";
        break;
      case "incarnation-cross":
        section.staticContent = profile.humanDesign.incarnationCross || "Cruz de Encarnación no disponible.";
        section.llmContent = call3Parts[0] ?? "";
        break;
      case "strengths-shadows":
        section.staticContent = "";
        section.llmContent = call3Parts[1] ?? "";
        break;
    }

    return section;
  });

  return {
    tier,
    profileHash,
    sections,
    tokensUsed,
    costUsd: Math.round(costUsd * 1000000) / 1000000,
  };
}
