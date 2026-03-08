/**
 * Agent Service
 *
 * Takes a user profile + real transit data and generates the weekly report
 * via Claude API. No hallucinated transits — only real ephemeris data.
 */

import type { WeeklyTransits, PlanetTransit, TransitImpact } from "./transit-service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  birthData?: {
    date: string;      // ej: "18 February 1989"
    time: string;      // ej: "08:00"
    location: string;  // ej: "Punta Cardón, Falcón, Venezuela"
  };
  humanDesign: {
    type: string;
    strategy: string;
    authority: string;
    profile: string;
    definition: string;
    incarnationCross: string;
    notSelfTheme: string;
    variable: string;
    digestion: string;
    environment: string;
    strongestSense: string;
    channels: Array<{ id: string; name: string; circuit: string }>;
    activatedGates: Array<{ number: number; line: number; planet: string; isPersonality: boolean }>;
    definedCenters: string[];
    undefinedCenters: string[];
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function formatTransitsForPrompt(transits: WeeklyTransits): string {
  const retroTag = (p: PlanetTransit) => p.isRetrograde ? " [RETRÓGRADO]" : "";

  const lines = transits.planets.map(p =>
    `- ${p.name}: ${p.sign} ${p.degree}°${retroTag(p)} | HD Puerta ${p.hdGate}.${p.hdLine}`
  );

  const channelsBlock = transits.activatedChannels.length
    ? `\nCANALES ACTIVADOS POR TRÁNSITOS HOY:\n${transits.activatedChannels.map(c => `- ${c}`).join("\n")}`
    : "\nNo hay canales completos activados por tránsitos esta semana.";

  return `TRÁNSITOS REALES — Semana del ${transits.weekRange}\n(Fuente: Swiss Ephemeris vía AstrologyAPI, datos calculados el ${transits.fetchedAt})\n\n${lines.join("\n")}${channelsBlock}`;
}

function buildSystemPrompt(profile: UserProfile, transits: WeeklyTransits, impact?: TransitImpact): string {
  const { humanDesign: hd } = profile;
  const transitsBlock = formatTransitsForPrompt(transits);

  // Build optional sections only if data exists
  const birthBlock = profile.birthData
    ? `\nNACIMIENTO: ${profile.birthData.date}, ${profile.birthData.time} — ${profile.birthData.location}`
    : "";

  const crossBlock = hd.incarnationCross ? `\n- Cruz de Encarnación: ${hd.incarnationCross}` : "";
  const strategyBlock = hd.strategy ? `\n- Estrategia: ${hd.strategy}` : "";
  const notSelfBlock = hd.notSelfTheme ? `\n- Tema del No-Self: ${hd.notSelfTheme}` : "";

  const variableDetails: string[] = [];
  if (hd.digestion) variableDetails.push(`Digestión: ${hd.digestion}`);
  if (hd.environment) variableDetails.push(`Ambiente: ${hd.environment}`);
  if (hd.strongestSense) variableDetails.push(`Sentido más fuerte: ${hd.strongestSense}`);
  const variableBlock = variableDetails.length
    ? `\n- Variable: ${hd.variable || "—"} (${variableDetails.join(" | ")})`
    : hd.variable ? `\n- Variable: ${hd.variable}` : "";

  const gatesDesign = hd.activatedGates.filter(g => !g.isPersonality);
  const gatesPersonality = hd.activatedGates.filter(g => g.isPersonality);

  const gatesBlock = hd.activatedGates.length
    ? `\n- Puertas Personalidad (consciente): ${gatesPersonality.map(g => `${g.number}.${g.line} via ${g.planet}`).join(", ") || "—"}\n- Puertas Diseño (inconsciente): ${gatesDesign.map(g => `${g.number}.${g.line} via ${g.planet}`).join(", ") || "—"}`
    : "";

  const impactBlock = impact ? `

IMPACTO EN TU DISEÑO ESTA SEMANA:

CANALES PERSONALES ACTIVADOS (tránsito completa tu canal):
${impact.personalChannels.map(c =>
    `- ${c.channelName} (${c.channelId}): tu Puerta ${c.userGate} + ${c.transitPlanet} en Puerta ${c.transitGate}`
  ).join("\n") || "- Ninguno esta semana"}

CENTROS CONDICIONADOS (tránsito activa tu centro indefinido):
${impact.conditionedCenters.map(c =>
    `- ${c.center}: ${c.gates.map(g => `${g.planet} en Puerta ${g.gate}`).join(", ")}`
  ).join("\n") || "- Ninguno esta semana"}

PUERTAS REFORZADAS (tránsito toca puerta que ya tenés):
${impact.reinforcedGates.map(r =>
    `- Tu Puerta ${r.gate} reforzada por ${r.planet}`
  ).join("\n") || "- Ninguna esta semana"}` : "";

  return `Eres un especialista en Diseño Humano de alto nivel. Generás reportes semanales profundos y accionables cruzando tránsitos reales con la carta personal. También podés responder preguntas puntuales sobre el diseño humano del usuario usando los datos provistos.

PERFIL — ${profile.name}${birthBlock}

DISEÑO HUMANO:
- Tipo: ${hd.type}${strategyBlock}
- Autoridad: ${hd.authority}
- Perfil: ${hd.profile}
- Definición: ${hd.definition}${crossBlock}${notSelfBlock}${variableBlock}
- Canales natales: ${hd.channels.map(c => `${c.name} (${c.id})`).join(", ") || "—"}${gatesBlock}
- Centros definidos: ${hd.definedCenters.join(", ") || "—"}
- Centros indefinidos: ${hd.undefinedCenters.join(", ") || "—"}

${transitsBlock}${impactBlock}

INSTRUCCIONES CRÍTICAS:
1. Usá ÚNICAMENTE los tránsitos reales provistos arriba. No inventes ni asumas posiciones planetarias.
2. Usá los datos de IMPACTO EN TU DISEÑO provistos arriba. Son calculados, no los recalcules ni contradigas.
3. Cuando un tránsito active una puerta del usuario o de canal, destacalo.
4. Cuando un tránsito toque un centro indefinido del usuario, mencioná el condicionamiento potencial.
5. Integrá la Cruz de Encarnación, la estrategia y el tema del No-Self cuando sean relevantes.
6. NO uses asteriscos, markdown ni símbolos de formato. Solo texto plano.
7. Si el usuario pide un reporte semanal, estructuralo con exactamente estas 6 secciones, cada una comenzando con su emoji:

🔭 PANORAMA GENERAL
⚡ ENERGÍA & CUERPO
💼 TRABAJO & CREATIVIDAD
❤️ VÍNCULOS & AMOR
🧭 ESTRATEGIA DE LA SEMANA
⚠️ PUNTOS DE ATENCIÓN

8. Cada sección del reporte: mínimo 3 oraciones sustanciosas y específicas. Sin generalidades.
9. Si el usuario hace una pregunta puntual (no un reporte), respondé directamente sin usar las 6 secciones.
10. Tono cálido, segunda persona, como un guía de confianza.
11. No escribas texto introductorio antes del primer emoji en reportes.`;
}

// ─── Claude API call ──────────────────────────────────────────────────────────

// ─── LLM config ──────────────────────────────────────────────────────────────
// To switch model: change MODEL constant.
// GPT-4o-mini → cheap, great for MVP
// GPT-4o      → better quality, higher cost

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini"; // swap to "gpt-4o" for higher quality

// ─── OpenAI API call ──────────────────────────────────────────────────────────

async function callOpenAI(
  messages: ChatMessage[],
  systemPrompt: string,
  openaiKey: string,
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? "";
}

// ─── Main agent function ──────────────────────────────────────────────────────

export async function runAstralAgent(
  profile: UserProfile,
  transits: WeeklyTransits,
  messages: ChatMessage[],
  openaiKey: string,
  impact?: TransitImpact,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(profile, transits, impact);
  return callOpenAI(messages, systemPrompt, openaiKey);
}

// ─── Streaming agent function ────────────────────────────────────────────────

export async function* runAstralAgentStream(
  profile: UserProfile,
  transits: WeeklyTransits,
  messages: ChatMessage[],
  openaiKey: string,
  impact?: TransitImpact,
): AsyncGenerator<string> {
  const systemPrompt = buildSystemPrompt(profile, transits, impact);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  if (!response.body) {
    throw new Error("OpenAI response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Keep the last incomplete line in the buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") return;

      try {
        const parsed = JSON.parse(payload) as {
          choices: Array<{ delta: { content?: string } }>;
        };
        const content = parsed.choices[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // Skip malformed JSON lines
      }
    }
  }
}
