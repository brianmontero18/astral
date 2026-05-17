/**
 * Shared helpers for building the chat system prompt.
 *
 * Used by both v1 (`agent-service.ts:buildSystemPrompt`) and v2
 * (`agent-service-v2-prompt.ts:buildSystemPromptV2`). Single source of truth
 * for the optional `<business_context>` and `<user_memory>` blocks plus the
 * intake label table — every prompt builder must emit these identically so
 * they share cache prefixes when the rest of the prompt allows it.
 */

import type { Intake } from "./report/types.js";

export interface PromptBirthData {
  dateLocalIso: string;
  dateUtcIso: string;
  placeLabel: string;
  timezoneOffsetHours: number;
  ageYears: number;
}

export const TIPO_NEGOCIO_PROMPT_LABELS: Record<
  NonNullable<Intake["tipo_de_negocio"]>,
  string
> = {
  sin_negocio: "sin_negocio",
  mentora: "mentora",
  coach: "coach",
  marca_personal: "marca personal",
  servicios_premium: "servicios premium / high-ticket",
  branding: "branding",
  otro: "otro",
};

/**
 * Builds the optional `<business_context>` block. Returns "" when the intake
 * is missing or has no usable fields, so callers can interpolate
 * unconditionally without producing dangling whitespace.
 *
 * The leading `\n` is intentional: it sits right after `</user_profile>` so
 * the block visually anchors to the user's identity in the prompt.
 */
export function buildBusinessContextBlock(intake?: Intake): string {
  if (!intake) return "";
  const parts: string[] = [];
  if (intake.actividad) parts.push(`  <actividad>${intake.actividad}</actividad>`);
  if (intake.tipo_de_negocio === "sin_negocio") {
    // User explicitly opted out of the negocio framing. Signal so the LLM
    // avoids marketing-heavy interpretations and stays in personal /
    // vocational language.
    parts.push(`  <situacion>sin_emprendimiento_actualmente</situacion>`);
  } else if (intake.tipo_de_negocio) {
    parts.push(
      `  <tipo_de_negocio>${TIPO_NEGOCIO_PROMPT_LABELS[intake.tipo_de_negocio]}</tipo_de_negocio>`,
    );
  }
  if (intake.desafio_actual) parts.push(`  <desafio_actual>${intake.desafio_actual}</desafio_actual>`);
  if (intake.objetivo_12m)   parts.push(`  <objetivo_12m>${intake.objetivo_12m}</objetivo_12m>`);
  if (intake.voz_marca)      parts.push(`  <voz_marca>${intake.voz_marca}</voz_marca>`);
  if (parts.length === 0) return "";
  return `\n<business_context>\n${parts.join("\n")}\n</business_context>`;
}

/**
 * Wraps the persisted Living Document markdown verbatim inside `<user_memory>`
 * so the LLM treats it as a stable, append-only source of facts. Returns ""
 * on empty input.
 *
 * Cache-friendly: this block must NOT contain timestamps or anything that
 * mutates without a real fact change.
 */
export function buildUserMemoryBlock(memory?: string): string {
  if (!memory) return "";
  const trimmed = memory.trim();
  if (!trimmed) return "";
  return `\n<user_memory>\n${trimmed}\n</user_memory>`;
}

export function formatBirthForPrompt(birth: PromptBirthData): string {
  return [
    birth.dateLocalIso,
    `UTC ${birth.dateUtcIso}`,
    birth.placeLabel,
    `edad ${birth.ageYears}`,
  ].join(" | ");
}
