/**
 * Agent Service
 *
 * Takes a user profile + real transit data and generates the weekly report
 * via Claude API. No hallucinated transits — only real ephemeris data.
 */

import type { WeeklyTransits, PlanetTransit } from "./transit-service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NatalPlanet {
  name: string;
  sign: string;
  house: number;
  degree: number;
}

export interface UserProfile {
  name: string;
  birthData?: {
    date: string;      // ej: "18 February 1989"
    time: string;      // ej: "08:00"
    location: string;  // ej: "Punta Cardón, Falcón, Venezuela"
  };
  natal: {
    planets: NatalPlanet[];
    ascendant: string;
    midheaven: string;
    nodes: { north: string; south: string };
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

function buildSystemPrompt(profile: UserProfile, transits: WeeklyTransits): string {
  const { natal, humanDesign: hd } = profile;
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

  return `Eres un astrólogo y especialista en Diseño Humano de alto nivel. Generás reportes semanales profundos y accionables cruzando tránsitos reales con la carta personal. También podés responder preguntas puntuales sobre la carta natal o el diseño humano del usuario usando los datos provistos.

PERFIL — ${profile.name}${birthBlock}

CARTA NATAL:
${natal.planets.map(p => `- ${p.name}: ${p.sign}, Casa ${p.house}, ${p.degree}°`).join("\n")}
- Ascendente: ${natal.ascendant}
- Medio Cielo: ${natal.midheaven}
- Nodo Norte: ${natal.nodes.north} | Nodo Sur: ${natal.nodes.south}

DISEÑO HUMANO:
- Tipo: ${hd.type}${strategyBlock}
- Autoridad: ${hd.authority}
- Perfil: ${hd.profile}
- Definición: ${hd.definition}${crossBlock}${notSelfBlock}${variableBlock}
- Canales natales: ${hd.channels.map(c => `${c.name} (${c.id})`).join(", ") || "—"}${gatesBlock}
- Centros definidos: ${hd.definedCenters.join(", ") || "—"}
- Centros indefinidos: ${hd.undefinedCenters.join(", ") || "—"}

${transitsBlock}

INSTRUCCIONES CRÍTICAS:
1. Usá ÚNICAMENTE los tránsitos reales provistos arriba. No inventes ni asumas posiciones planetarias.
2. Cruzá cada tránsito con la carta natal y HD del usuario. Sé específico: mencioná grados, puertas y aspectos concretos.
3. Cuando un tránsito active una puerta del usuario (natal o de canal), destacalo.
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
): Promise<string> {
  const systemPrompt = buildSystemPrompt(profile, transits);
  return callOpenAI(messages, systemPrompt, openaiKey);
}
