/**
 * Tablas canónicas Human Design chicas + helpers de derivación pura.
 *
 * Capa CÁLCULO. Estos lookups son intrínsecos al canon HD, no son geometría
 * visual — viven al lado de hd-gates.ts y hd-channels.ts.
 *
 * Reglas:
 * - Cero dependencias del módulo `bodygraph/` (es downstream).
 * - Solo lookups y derivaciones puras — sin I/O, sin tiempo (excepto el
 *   parámetro explícito en `calcAgeYears`).
 */

// ─── Profile line names ─────────────────────────────────────────────────────

/**
 * Nombres canónicos de las 6 líneas de profile, traducidos al español.
 * Genetic Matrix usa "Opportunistic"/"Role Model"/etc (inglés); las traducimos
 * acá para que el UI sea consistente con el resto del proyecto (que está en
 * español). Source of truth para SVG y HTML.
 */
export const PROFILE_LINE_NAMES: Record<number, string> = {
  1: "Investigador",
  2: "Ermitaño",
  3: "Mártir",
  4: "Oportunista",
  5: "Hereje",
  6: "Modelo a Seguir",
};

/**
 * Devuelve el nombre canónico del profile, ej. "4/6" → "Opportunist / Role Model".
 * Retorna "" si el formato no matchea o las líneas no son válidas.
 */
export function lookupProfileName(profile: string): string {
  const m = profile.match(/^(\d)\/(\d)$/);
  if (!m) return "";
  const na = PROFILE_LINE_NAMES[Number(m[1])];
  const nb = PROFILE_LINE_NAMES[Number(m[2])];
  if (!na || !nb) return "";
  return `${na} / ${nb}`;
}

// ─── Themes positivos por type ──────────────────────────────────────────────
//
// Cada type HD tiene un theme positivo (alineado a estrategia) y uno no-self
// (cuando no se sigue la autoridad). `notSelfTheme` ya vive en UserProfile;
// esta tabla agrega el lado positivo. Type names en español canónico (ver
// `TYPE_ES` en bodygraph/calculate.ts).

export const TYPE_POSITIVE_THEME: Record<string, string> = {
  "Proyector": "Éxito",
  "Generador": "Satisfacción",
  "Generador Manifestante": "Satisfacción",
  "Manifestador": "Paz",
  "Reflector": "Sorpresa",
};

export function lookupPositiveTheme(type: string): string {
  return TYPE_POSITIVE_THEME[type] ?? "";
}

// ─── Type qualifier (prefijo en display) ────────────────────────────────────
//
// Genetic Matrix prefija el type según la authority: un Projector con Solar
// Plexus definido aparece como "Emotional Projector". Indexado por authority
// canónica (ver `deriveAuthority` en bodygraph/calculate.ts).
//
// El qualifier "" significa "no prefix" — para Generators con Sacral authority
// el display canónico es solo el type ("Generator" / "Manifesting Generator").

export const TYPE_QUALIFIER_BY_AUTHORITY: Record<string, string> = {
  "Emocional (Plexo Solar)": "Emocional",
  "Sacral": "",
  "Esplénica": "Esplénica",
  "Ego/Corazón": "Ego",
  "Auto-proyectada": "Auto-Proyectada",
  "Mental/Ambiente": "Mental",
  "Lunar": "Lunar",
};

export function lookupTypeQualifier(authority: string): string {
  return TYPE_QUALIFIER_BY_AUTHORITY[authority] ?? "";
}

// ─── Variable orientation ───────────────────────────────────────────────────
//
// Tone (1..6) → Orientation (left/right). Tone 1-3 are Left, 4-6 are Right.
// Source: SharpAstrology.HumanDesign Enums/Tone.cs `ToOrientation()`.
// Used by the Variable Wheel: Orientation of each Variable (Digestion,
// Awareness, Environment, Perspective) is derived from the Tone of the
// corresponding planet activation (Sun / NorthNode at design / personality).

export type Orientation = "left" | "right";

export function toneToOrientation(tone: number): Orientation {
  return tone <= 3 ? "left" : "right";
}

// ─── Age years ──────────────────────────────────────────────────────────────

/**
 * Edad cumplida (años enteros) entre `birthDateIso` y `now`. Todo el cómputo
 * va en UTC para evitar discrepancias por timezone del runtime.
 *
 * Acepta cualquier ISO 8601 parseable por `Date`. Retorna 0 si la fecha es
 * inválida o futura.
 */
export function calcAgeYears(birthDateIso: string, now: Date = new Date()): number {
  const birth = new Date(birthDateIso);
  if (Number.isNaN(birth.getTime())) return 0;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return Math.max(0, age);
}
