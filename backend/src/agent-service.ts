/**
 * Agent Service
 *
 * Takes a user profile + real transit data and generates the weekly report
 * via Claude API. No hallucinated transits — only real ephemeris data.
 */

import { createHash } from "node:crypto";

import type { WeeklyTransits, TransitImpact } from "./transit-service.js";
import type { Intake } from "./report/types.js";
import { HD_CONDENSED } from "./knowledge/hd-condensed.js";
import { BUSINESS_PACK_V1 } from "./knowledge/business-pack-v1.js";
import { HD_DETECTION_RULES } from "./knowledge/detection-rules.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface AgentCallMeta {
  usage: LlmUsage;
  latencyMs: number;
  systemPrompt: string;
}

export interface AgentResult extends AgentCallMeta {
  content: string;
}

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

const TIPO_NEGOCIO_PROMPT_LABELS: Record<NonNullable<Intake["tipo_de_negocio"]>, string> = {
  mentora: "mentora",
  coach: "coach",
  marca_personal: "marca personal",
  servicios_premium: "servicios premium / high-ticket",
  branding: "branding",
  otro: "otro",
};

/**
 * Builds the optional `<business_context>` block injected into the system
 * prompt when the user has filled the intake. Returns an empty string when
 * the intake is missing or has no usable fields, so callers can interpolate
 * unconditionally without producing dangling whitespace.
 *
 * The leading `\n` is intentional: it sits right after `</user_profile>` so
 * the block visually anchors to the user's identity in the prompt.
 */
function buildBusinessContextBlock(intake?: Intake): string {
  if (!intake) return "";
  const parts: string[] = [];
  if (intake.actividad)        parts.push(`  <actividad>${intake.actividad}</actividad>`);
  if (intake.tipo_de_negocio)  parts.push(`  <tipo_de_negocio>${TIPO_NEGOCIO_PROMPT_LABELS[intake.tipo_de_negocio]}</tipo_de_negocio>`);
  if (intake.desafio_actual)   parts.push(`  <desafio_actual>${intake.desafio_actual}</desafio_actual>`);
  if (intake.objetivo_12m)     parts.push(`  <objetivo_12m>${intake.objetivo_12m}</objetivo_12m>`);
  if (intake.voz_marca)        parts.push(`  <voz_marca>${intake.voz_marca}</voz_marca>`);
  if (parts.length === 0) return "";
  return `\n<business_context>\n${parts.join("\n")}\n</business_context>`;
}

/**
 * Wraps the persisted Living Document markdown verbatim inside `<user_memory>`
 * so the LLM treats it as a stable, append-only source of facts. Returns ""
 * on empty input so callers can interpolate unconditionally without producing
 * an empty tag.
 *
 * Cache-friendly: this block must NOT contain timestamps or anything that
 * mutates without a real fact change. Position is also chosen for caching —
 * the block sits between the stable `<business_context>` and the volatile
 * `<transits>` so a future cache-discipline pass that splits prefix from
 * suffix needs no rework here.
 */
function buildUserMemoryBlock(memory?: string): string {
  if (!memory) return "";
  const trimmed = memory.trim();
  if (!trimmed) return "";
  return `\n<user_memory>\n${trimmed}\n</user_memory>`;
}

export function hashSystemPrompt(systemPrompt: string): string {
  return createHash("sha256").update(systemPrompt).digest("hex").slice(0, 16);
}

export function buildSystemPrompt(
  profile: UserProfile,
  transits: WeeklyTransits,
  impact?: TransitImpact,
  intake?: Intake,
  memory?: string,
): string {
  const { humanDesign: hd } = profile;

  const gatesDesign = hd.activatedGates.filter(g => !g.isPersonality);
  const gatesPersonality = hd.activatedGates.filter(g => g.isPersonality);
  const hasGates = hd.activatedGates.length > 0;

  const variableDetails: string[] = [];
  if (hd.digestion) variableDetails.push(`Digestión: ${hd.digestion}`);
  if (hd.environment) variableDetails.push(`Ambiente: ${hd.environment}`);
  if (hd.strongestSense) variableDetails.push(`Sentido más fuerte: ${hd.strongestSense}`);
  const hasVariable = variableDetails.length > 0 || !!hd.variable;

  const businessContextBlock = buildBusinessContextBlock(intake);
  const hasBusinessContext = businessContextBlock.length > 0;

  const userMemoryBlock = buildUserMemoryBlock(memory);
  const hasUserMemory = userMemoryBlock.length > 0;

  return `# Rol y objetivo

Sos un AI Mentor que unifica Diseño Humano, tránsitos planetarios reales y estrategia de marketing consciente en una sola voz. Servís a coaches, terapeutas, facilitadores y marcas personales del mundo del bienestar.

Tu función: leer la energía disponible en los tránsitos, cruzarla con el bodygraph de la persona, y traducirla en dirección concreta para su vida, su comunicación y su negocio. Las tres capas van siempre juntas.

# Instrucciones

## Filosofía

- **Regla madre**: el Diseño Humano no reemplaza la estrategia. Informa cómo diseñar una estrategia que la persona pueda sostener sin traicionarse. Lo usás para verificar sostenibilidad, no para sustituir criterio de negocio.
- El tránsito dicta el cuándo (timing). El diseño dicta el cómo (forma sostenible). La estrategia decide el qué (oferta, posicionamiento, decisión).
- Antes de recomendar más visibilidad, más contenido o más canal, chequeá si el problema real es de **arquitectura del negocio** (oferta inestable, dependencia de la fundadora, conversión caótica, falta de sistema). Si falta estructura, eso se diseña primero — no se tapa con marketing.
- Marketing consciente: venta ética, narrativa de propósito, liderazgo energético. Sin manipulación, sin urgencia artificial, sin fórmulas universales.

## Tono

- Elegante, elevado, directo. Un mentor que te respeta demasiado para darte respuestas tibias.
- Sparring siempre activo: si algo no está alineado, lo decís. Si la persona está desperdiciando una energía disponible, se lo señalás con claridad.
- Cada insight está anclado en datos reales del tránsito y del diseño de la persona. Si no podés conectar lo que decís con una puerta, canal o centro específico, no lo digas.
- Hablás en segunda persona (vos/tú), con calidez pero sin complacencia.

## Reglas de datos

- Usá ÚNICAMENTE los tránsitos reales provistos en <transits>. No inventes ni asumas posiciones planetarias.${impact ? `\n- Usá los datos de IMPACTO provistos en <impact>. Son pre-calculados — no los recalcules ni contradigas.` : ""}${hasBusinessContext ? `\n- Si hay <business_context>, integrá los campos disponibles del usuario (actividad, tipo de negocio, desafío actual, objetivo a 12 meses, voz de marca) en cada respuesta concreta. El consejo aterriza en su negocio; no es decoración.` : ""}${hasUserMemory ? `\n- Si hay <user_memory>, considéralo como hechos verificados sobre la persona que aprendiste en sesiones anteriores. Referenciá estos hechos cuando sea relevante (sin re-preguntar lo que ya sabés). Si un hecho del memory contradice lo que la persona acaba de decir, priorizá el mensaje actual y notalo en tu próxima oportunidad.` : ""}
- Cuando un tránsito active una puerta del usuario o complete un canal, destacalo y conectá con qué significa para su comunicación, su oferta o su energía de marca.
- Cuando un tránsito toque un centro indefinido, mencioná el condicionamiento potencial y cómo evitar decisiones de negocio desde el no-self.
- Integrá la Cruz de Encarnación, la estrategia y el tema del No-Self cuando sean relevantes para el propósito y posicionamiento.
- **La cita HD debe CAMBIAR la recomendación, no decorarla.** Si quitás "tu canal X / tu autoridad Y / tu centro Z" del consejo y la recomendación queda igual, no la cites. La técnica HD se incluye solo cuando es la razón del consejo, no como adorno de autoridad.
- Tratá tipo/autoridad/perfil como **patrón energético**, no etiqueta. Nunca digas "sos Projector entonces no vendas" o "sos MG entonces hacé varias cosas" — traducí el patrón a una pregunta estratégica concreta ("¿la estructura actual respeta el ritmo invitación-reconocimiento de un Projector?", "¿la oferta puede sostener el rango multi-temático de un MG sin que se desordene?").

## Comportamiento de respuesta

- Pregunta puntual: respondé directo, sin secciones. Integrá las tres capas (energía, diseño, estrategia) cuando sea relevante. Extensión: 3 a 8 oraciones según la complejidad.
- Pregunta sobre marketing, contenido, ventas, lanzamientos o posicionamiento: primero diagnosticá si el problema real es de **estrategia, arquitectura o sostenibilidad** — no des respuesta de comunicación si lo que falta es estructura. La recomendación tiene que poder sostenerse: el cruce tránsito + diseño + arquitectura del negocio del usuario debe bancarla. Nunca consejos genéricos de marketing.
- Reporte semanal: usá el formato exacto especificado en "Formato de salida".

## Formato

- NO uses asteriscos, markdown ni símbolos de formato. Solo texto plano.
- No escribas texto introductorio antes del primer emoji en reportes.

# Marco de Conocimiento

Esta sección te da el knowledge canónico para anclar tus respuestas. NO la cites textualmente — usala como referencia interna y traduciendo a la situación específica del usuario.

${HD_CONDENSED}

${BUSINESS_PACK_V1}

${HD_DETECTION_RULES}

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
</user_profile>${businessContextBlock}${userMemoryBlock}

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

interface OpenAICallResult {
  content: string;
  usage: LlmUsage;
}

async function callOpenAI(
  messages: ChatMessage[],
  systemPrompt: string,
  openaiKey: string,
): Promise<OpenAICallResult> {
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
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? "",
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

// ─── Main agent function ──────────────────────────────────────────────────────

export const CHAT_MODEL = MODEL;

export async function runAstralAgent(
  profile: UserProfile,
  transits: WeeklyTransits,
  messages: ChatMessage[],
  openaiKey: string,
  impact?: TransitImpact,
  intake?: Intake,
  memory?: string,
): Promise<AgentResult> {
  const systemPrompt = buildSystemPrompt(profile, transits, impact, intake, memory);
  const start = Date.now();
  const { content, usage } = await callOpenAI(messages, systemPrompt, openaiKey);
  const latencyMs = Date.now() - start;
  return { content, usage, latencyMs, systemPrompt };
}

// ─── Streaming agent function ────────────────────────────────────────────────

export type AgentStreamCompleteHandler = (meta: AgentCallMeta) => void;

export async function* runAstralAgentStream(
  profile: UserProfile,
  transits: WeeklyTransits,
  messages: ChatMessage[],
  openaiKey: string,
  impact?: TransitImpact,
  intake?: Intake,
  memory?: string,
  onComplete?: AgentStreamCompleteHandler,
): AsyncGenerator<string> {
  const systemPrompt = buildSystemPrompt(profile, transits, impact, intake, memory);
  const start = Date.now();

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
      // Ask OpenAI to send a final chunk with prompt/completion token counts
      // so the chat path can persist telemetry without a second round-trip.
      stream_options: { include_usage: true },
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
  let usage: LlmUsage = { promptTokens: 0, completionTokens: 0 };
  let completed = false;

  const finish = () => {
    if (completed) return;
    completed = true;
    onComplete?.({ usage, latencyMs: Date.now() - start, systemPrompt });
  };

  try {
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
        if (payload === "[DONE]") {
          finish();
          return;
        }

        try {
          const parsed = JSON.parse(payload) as {
            choices: Array<{ delta: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          if (parsed.usage) {
            usage = {
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
            };
          }
          const content = parsed.choices[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } finally {
    finish();
  }
}
