/**
 * Memory Writer (Sprint 2 — Living Document pattern)
 *
 * Reads the user's current `memory_md` and the last few chat turns, asks a
 * cheap LLM to merge them, and returns either the updated markdown or a
 * NOOP signal when nothing relevant changed.
 *
 * Design notes — read before changing:
 *
 * 1. We deliberately avoid the "structured ops JSON" variant of the Mem0
 *    pattern. Returning a full markdown is harder to corrupt than a list of
 *    ADD/UPDATE/DELETE that the code then has to apply. The LLM still
 *    *thinks* in those operations (the system prompt forces it) — it just
 *    emits the merged result instead of describing the steps.
 *
 * 2. The writer is the ONLY caller of `updateUserMemory` in the chat path.
 *    No other code path mutates `memory_md`. This keeps the no-overwrite-
 *    blind invariant trivially auditable.
 *
 * 3. NOOP is a first-class output. The LLM is told to emit literally `NOOP`
 *    when nothing changed. Saving a no-op markdown would still bump
 *    `updated_at` and waste a write — instead the caller skips the DB
 *    update entirely. Tests assert this.
 *
 * 4. The system prompt is intentionally cache-friendly: zero timestamps,
 *    zero per-call data. The only volatile input is the user-message block.
 *    OpenAI auto-cache hits the system prompt across all writer calls.
 */

import type { AgentCallMeta, ChatMessage, LlmUsage } from "./agent-service.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const WRITER_MODEL = "gpt-4o-mini";

/**
 * Hard cap on the persisted markdown. The writer is told to condense if it
 * approaches this limit; we still slice as a defence-in-depth so a runaway
 * LLM can never blow up the system prompt of every subsequent chat turn.
 */
const MEMORY_MAX_CHARS = 4000;

export const MEMORY_WRITER_MODEL = WRITER_MODEL;

export interface MemoryWriterResult {
  /** Markdown to persist. Equals the input when `noop` is true. */
  memory: string;
  /** True when the writer judged no fact-change worth saving. */
  noop: boolean;
  /** Telemetry meta — always populated so callers can log to `llm_calls`. */
  meta: AgentCallMeta;
}

const SYSTEM_PROMPT = `Sos un componente de memoria de un asistente conversacional. Tu trabajo: leer la memoria actual del usuario (markdown) y los últimos mensajes de la conversación, y devolver la memoria actualizada en markdown.

Reglas:
1. Pensá en términos de cuatro acciones implícitas: ADD (agregar fact nuevo), UPDATE (modificar fact existente cuyo valor cambió), DELETE (sacar fact que el usuario contradijo), NOOP (no hay cambio relevante).
2. Si tras leer los mensajes nuevos NO hay cambio relevante, respondé exactamente con: NOOP
3. Si hay cambio, respondé con la memoria completa actualizada en markdown plano. NO devuelvas un diff. NO devuelvas operaciones JSON. Solo el markdown final.
4. Nunca borres un fact solo porque no aparece en los mensajes recientes — solo borralo si el usuario lo contradice explícitamente.
5. Cada bullet es un fact concreto y verificable, en oraciones cortas.
6. Estructurá la memoria en secciones markdown cortas (ej: ## Identidad, ## Negocio, ## Preferencias, ## Vínculos, ## Patrones recurrentes). Usá solo las secciones que tengan contenido — no fuerces todas.
7. NO inventes facts que no estén en los mensajes ni en la memoria actual.
8. NO incluyas timestamps, fechas relativas ("ayer", "hoy") ni metadatos volátiles. La memoria debe ser estable: si volvés a procesar los mismos inputs, el output debe ser idéntico.
9. Limitate a ${MEMORY_MAX_CHARS} caracteres como máximo. Si excedés, condensá los facts más viejos antes de agregar los nuevos.

Formato de salida (elegí UNO):
- Solo "NOOP" cuando no hay cambio relevante.
- O el markdown completo actualizado, sin code fences ni explicaciones, solo el contenido.`;

function buildUserPrompt(currentMemory: string, recentMessages: ChatMessage[]): string {
  const memoryBody = currentMemory.trim() || "(vacía — esta es la primera vez que actualizás esta memoria)";
  const messagesText = recentMessages
    .map(m => `${m.role === "user" ? "USUARIO" : "ASISTENTE"}: ${m.content}`)
    .join("\n\n");

  return `<current_memory>
${memoryBody}
</current_memory>

<recent_messages>
${messagesText}
</recent_messages>

Devolvé la memoria actualizada o "NOOP".`;
}

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Run a single writer pass. Throws on API error so the caller (chat route)
 * can decide whether to swallow the failure — telemetry-style — or surface
 * it. The route uses fire-and-forget so a failed update never blocks the
 * user-facing response.
 */
export async function runMemoryWriter(
  currentMemory: string,
  recentMessages: ChatMessage[],
  openaiKey: string,
): Promise<MemoryWriterResult> {
  const userPrompt = buildUserPrompt(currentMemory, recentMessages);
  const start = Date.now();

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: WRITER_MODEL,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Memory writer API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as OpenAIChatResponse;
  const raw = (data.choices[0]?.message?.content ?? "").trim();
  const usage: LlmUsage = {
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
  const meta: AgentCallMeta = {
    usage,
    latencyMs: Date.now() - start,
    systemPrompt: SYSTEM_PROMPT,
  };

  if (raw === "NOOP" || raw === "") {
    return { memory: currentMemory, noop: true, meta };
  }

  // Strip stray code fences if the LLM ignored rule 3.
  const cleaned = raw
    .replace(/^```(?:markdown|md)?\s*\n/, "")
    .replace(/\n```\s*$/, "")
    .trim();

  // Defence-in-depth on rule 9.
  const capped = cleaned.length > MEMORY_MAX_CHARS
    ? cleaned.slice(0, MEMORY_MAX_CHARS)
    : cleaned;

  // If the LLM came back with markdown that turns out to be byte-identical to
  // the current memory, treat it as a NOOP — saves a DB write and keeps
  // `updated_at` stable.
  if (capped === currentMemory.trim()) {
    return { memory: currentMemory, noop: true, meta };
  }

  return { memory: capped, noop: false, meta };
}

/**
 * Trigger policy: how many user messages between writer runs. The first run
 * happens at message #1 (so memory starts populating immediately); after that
 * every Nth user message kicks a refresh. Keeps the writer's average cost
 * bounded relative to the chat cost.
 */
export const MEMORY_WRITER_TRIGGER_EVERY_N_USER_TURNS = 3;

export function shouldTriggerMemoryWriter(userMessageCount: number): boolean {
  if (userMessageCount < 1) return false;
  if (userMessageCount === 1) return true;
  return userMessageCount % MEMORY_WRITER_TRIGGER_EVERY_N_USER_TURNS === 0;
}
