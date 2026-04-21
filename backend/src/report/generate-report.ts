import { createHash } from "node:crypto";
import type { UserProfile } from "../agent-service.js";
import {
  TYPE_DESCRIPTIONS,
  AUTHORITY_DESCRIPTIONS,
  PROFILE_DESCRIPTIONS,
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
  } catch (err) {
    console.error("[report] LLM call failed, retrying in 1.5s:", (err as Error).message);
    await new Promise((r) => setTimeout(r, 1500));
    try {
      return await callLLM(system, user, openaiKey);
    } catch (retryErr) {
      console.error("[report] LLM retry failed:", (retryErr as Error).message);
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

  // Parse LLM outputs by [SECTION] marker (fallback to double-newline / --- for robustness)
  const splitSections = (text: string): string[] => {
    if (text.includes("[SECTION]")) return text.split(/\[SECTION\]/).map(s => s.trim()).filter(Boolean);
    if (text.includes("---")) return text.split(/---+/).map(s => s.trim()).filter(Boolean);
    return text.split(/\n\n+/).filter(Boolean);
  };
  const call1Parts = splitSections(call1Result.content);
  const call2Parts = splitSections(call2Result.content);
  const call3Parts = splitSections(call3Result.content);

  // Build sections
  const sections: ReportSection[] = SECTION_META.map((meta) => {
    const section: ReportSection = {
      id: meta.id,
      title: meta.title,
      icon: meta.icon,
      tier: meta.tier,
      staticContent: "",
      previewContent: meta.previewContent,
      teaser: meta.id === "profile" && tier === "free",
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
      case "work-rhythm":
        section.llmContent = tier === "premium" ? (call1Parts[3] ?? "") : "";
        break;
      case "decision-style":
        section.llmContent = tier === "premium" ? (call2Parts[0] ?? "") : "";
        break;
      case "positioning-offer":
        section.llmContent = tier === "premium" ? (call2Parts[1] ?? "") : "";
        break;
      case "client-dynamics":
        section.llmContent = tier === "premium" ? (call2Parts[2] ?? "") : "";
        break;
      case "visibility-sales":
        section.llmContent = tier === "premium" ? (call3Parts[0] ?? "") : "";
        break;
      case "next-30-days":
        section.llmContent = tier === "premium" ? (call3Parts[1] ?? "") : "";
        break;
    }

    return section;
  });

  const degraded = (tier === "free" && !call1Result.content)
    || (tier === "premium" && (!call1Result.content || !call2Result.content || !call3Result.content));

  if (degraded) {
    console.warn("[report] Report generated in degraded mode — one or more LLM calls returned empty");
  }

  return {
    tier,
    profileHash,
    sections,
    tokensUsed,
    costUsd: Math.round(costUsd * 1000000) / 1000000,
    degraded,
  };
}
