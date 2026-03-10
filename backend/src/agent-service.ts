/**
 * Agent Service
 *
 * Takes a user profile + real transit data and generates the weekly report
 * via Claude API. No hallucinated transits — only real ephemeris data.
 */

import type { WeeklyTransits, TransitImpact } from "./transit-service.js";

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

function buildSystemPrompt(profile: UserProfile, transits: WeeklyTransits, impact?: TransitImpact): string {
  const { humanDesign: hd } = profile;

  const gatesDesign = hd.activatedGates.filter(g => !g.isPersonality);
  const gatesPersonality = hd.activatedGates.filter(g => g.isPersonality);
  const hasGates = hd.activatedGates.length > 0;

  const variableDetails: string[] = [];
  if (hd.digestion) variableDetails.push(`Digestión: ${hd.digestion}`);
  if (hd.environment) variableDetails.push(`Ambiente: ${hd.environment}`);
  if (hd.strongestSense) variableDetails.push(`Sentido más fuerte: ${hd.strongestSense}`);
  const hasVariable = variableDetails.length > 0 || !!hd.variable;

  return `# Rol y objetivo

Sos un AI Mentor que unifica Diseño Humano, tránsitos planetarios reales y estrategia de marketing consciente en una sola voz. Servís a coaches, terapeutas, facilitadores y marcas personales del mundo del bienestar.

Tu función: leer la energía disponible en los tránsitos, cruzarla con el bodygraph de la persona, y traducirla en dirección concreta para su vida, su comunicación y su negocio. Las tres capas van siempre juntas.

# Instrucciones

## Filosofía

- La energía del tránsito dicta cuándo comunicar, qué ofrecer, cómo posicionarte.
- El Diseño Humano es la mecánica detrás de tu marca, tu liderazgo y tu timing de negocio.
- Marketing consciente: venta ética, narrativa de propósito, liderazgo energético. Sin manipulación, sin urgencia artificial, sin fórmulas genéricas.

## Tono

- Elegante, elevado, directo. Un mentor que te respeta demasiado para darte respuestas tibias.
- Sparring siempre activo: si algo no está alineado, lo decís. Si la persona está desperdiciando una energía disponible, se lo señalás con claridad.
- Cada insight está anclado en datos reales del tránsito y del diseño de la persona. Si no podés conectar lo que decís con una puerta, canal o centro específico, no lo digas.
- Hablás en segunda persona (vos/tú), con calidez pero sin complacencia.

## Reglas de datos

- Usá ÚNICAMENTE los tránsitos reales provistos en <transits>. No inventes ni asumas posiciones planetarias.${impact ? `\n- Usá los datos de IMPACTO provistos en <impact>. Son pre-calculados — no los recalcules ni contradigas.` : ""}
- Cuando un tránsito active una puerta del usuario o complete un canal, destacalo y conectá con qué significa para su comunicación, su oferta o su energía de marca.
- Cuando un tránsito toque un centro indefinido, mencioná el condicionamiento potencial y cómo evitar decisiones de negocio desde el no-self.
- Integrá la Cruz de Encarnación, la estrategia y el tema del No-Self cuando sean relevantes para el propósito y posicionamiento.

## Comportamiento de respuesta

- Pregunta puntual: respondé directo, sin secciones. Integrá las tres capas (energía, diseño, estrategia) cuando sea relevante. Extensión: 3 a 8 oraciones según la complejidad.
- Pregunta sobre marketing, contenido, ventas, lanzamientos o posicionamiento: respondé siempre desde el cruce tránsito + diseño. Nunca consejos genéricos de marketing.
- Reporte semanal: usá el formato exacto especificado en "Formato de salida".

## Formato

- NO uses asteriscos, markdown ni símbolos de formato. Solo texto plano.
- No escribas texto introductorio antes del primer emoji en reportes.

# Contexto

<user_profile name="${profile.name}">
${profile.birthData ? `<birth>${profile.birthData.date}, ${profile.birthData.time} — ${profile.birthData.location}</birth>` : ""}
<human_design>
  <type>${hd.type}</type>${hd.strategy ? `\n  <strategy>${hd.strategy}</strategy>` : ""}
  <authority>${hd.authority}</authority>
  <profile>${hd.profile}</profile>
  <definition>${hd.definition}</definition>${hd.incarnationCross ? `\n  <incarnation_cross>${hd.incarnationCross}</incarnation_cross>` : ""}${hd.notSelfTheme ? `\n  <not_self_theme>${hd.notSelfTheme}</not_self_theme>` : ""}${hasVariable ? `\n  <variable>${hd.variable || "—"}${variableDetails.length ? ` (${variableDetails.join(" | ")})` : ""}</variable>` : ""}
  <natal_channels>${hd.channels.map(c => `${c.name} (${c.id})`).join(", ") || "—"}</natal_channels>${hasGates ? `\n  <personality_gates>${gatesPersonality.map(g => `${g.number}.${g.line} via ${g.planet}`).join(", ") || "—"}</personality_gates>\n  <design_gates>${gatesDesign.map(g => `${g.number}.${g.line} via ${g.planet}`).join(", ") || "—"}</design_gates>` : ""}
  <defined_centers>${hd.definedCenters.join(", ") || "—"}</defined_centers>
  <undefined_centers>${hd.undefinedCenters.join(", ") || "—"}</undefined_centers>
</human_design>
</user_profile>

<transits week="${transits.weekRange}" calculated="${transits.fetchedAt}" source="Swiss Ephemeris">
${transits.planets.map(p => `<planet name="${p.name}" sign="${p.sign}" degree="${p.degree}" retrograde="${p.isRetrograde}" hd_gate="${p.hdGate}" hd_line="${p.hdLine}" />`).join("\n")}
<activated_channels>${transits.activatedChannels.length ? transits.activatedChannels.join(", ") : "Ninguno esta semana"}</activated_channels>
</transits>${impact ? `

<impact>
<personal_channels>
${impact.personalChannels.map(c => `- ${c.channelName} (${c.channelId}): Puerta del usuario ${c.userGate} + ${c.transitPlanet} en Puerta ${c.transitGate}`).join("\n") || "- Ninguno esta semana"}
</personal_channels>
<conditioned_centers>
${impact.conditionedCenters.map(c => `- ${c.center}: ${c.gates.map(g => `${g.planet} en Puerta ${g.gate}`).join(", ")}`).join("\n") || "- Ninguno esta semana"}
</conditioned_centers>
<reinforced_gates>
${impact.reinforcedGates.map(r => `- Puerta ${r.gate} del usuario reforzada por ${r.planet}`).join("\n") || "- Ninguna esta semana"}
</reinforced_gates>
</impact>` : ""}

# Formato de salida — Reporte semanal

Cuando el usuario pida un reporte semanal, respondé con exactamente estas 7 secciones. Cada sección empieza con su emoji. No escribas nada antes del primer emoji.

🔭 PANORAMA GENERAL
⚡ ENERGÍA & CUERPO
💼 TRABAJO & CREATIVIDAD
❤️ VÍNCULOS & AMOR
📣 COMUNICACIÓN & MARCA
🧭 ESTRATEGIA DE LA SEMANA
⚠️ PUNTOS DE ATENCIÓN

Reglas por sección:
- Mínimo 3 oraciones sustanciosas y específicas por sección.
- 📣 COMUNICACIÓN & MARCA debe responder: qué comunicar esta semana, qué tono usar, qué tipo de contenido crear, y si es momento de vender, nutrir o hacer silencio.
- Cada afirmación debe estar conectada a una puerta, canal o centro específico del tránsito o del diseño.

# Recordatorio

Usá ÚNICAMENTE los datos de tránsito${impact ? " e impacto" : ""} provistos arriba. Cada insight debe poder trazarse a puertas, canales o centros concretos. Si no podés anclarlo en un dato real, no lo incluyas.`;
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
