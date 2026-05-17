/**
 * Incarnation Cross — tabla canónica de 192 crosses (64 gates × 3 angles).
 *
 * Capa CÁLCULO. Lookup HD puro: cero geometría, cero rendering.
 *
 * Source: portado de SharpAstrology.HumanDesign (MIT)
 *   - Enums/IncarnationCross.cs (192 entries en `ToGeneKeys` + `ToText`)
 *   - Enums/Profiles.cs (`ToAngle()` mapping)
 *
 * Convención de keys
 * ──────────────────
 * Canon HD identifica el cross con dos datos: `(Personality.Sun.gate, angle)`,
 * donde `angle` deriva del profile completo (lines de Personality.Sun +
 * Design.Sun):
 *
 *   1/3, 1/4, 2/4, 2/5, 3/5, 3/6, 4/6  → "right"          (RAX)
 *   4/1                                → "juxtaposition"  (JUX)
 *   5/1, 5/2, 6/2, 6/3                 → "left"           (LAX)
 *
 * Los 4 gates "del cross" (Personality.Sun/Earth + Design.Sun/Earth) están
 * astronómicamente encadenados al Personality.Sun via oposición + offset 88°,
 * así que `(personalitySunGate, angle)` es suficiente. La firma se mantiene
 * mínima en vez de pedir los 4 gates redundantes que muestra el bead description.
 *
 * Formato del display (Genetic Matrix dialect)
 * ────────────────────────────────────────────
 * Genetic Matrix renderea el cross en forma corta: "RAX Service 4",
 * "LAX Industry 1", "JUX Conflict". Las tablas abajo almacenan ese formato
 * corto directo (vs el largo "The Right Angle Cross of Service 4" de Ra Uru
 * Hu canon).
 *
 * **Convención de sufijo numérico**: SharpAstrology canon usa el nombre sin
 * sufijo para la PRIMERA variante de un cross (ej. "RAX Sphinx" para gate 13).
 * Genetic Matrix display SIEMPRE muestra un número, incluso para la primera
 * variante: gate 13 aparece como "RAX Sphinx 1". Esta tabla aplica esa
 * convención sobre el canon SharpAstrology — las familias con 2+ miembros
 * tienen el sufijo " 1" en la primera variante. Las familias con un solo
 * miembro (todos los JUX) no llevan número.
 *
 * Validado contra Foundation Charts reales de Genetic Matrix:
 *   - Agos (gate=58, profile=4/6) → "RAX Service 4"
 *   - Brian (gate=30, profile=6/2) → "LAX Industry 1"
 */

export type IncarnationCrossAngle = "right" | "left" | "juxtaposition";

/**
 * Mapeo profile → angle. Indexado por el string canónico "L1/L2" (las líneas
 * Personality.Sun.line / Design.Sun.line).
 *
 * Source: SharpAstrology.HumanDesign Enums/Profiles.cs `ToAngle()`.
 */
const PROFILE_TO_ANGLE: Record<string, IncarnationCrossAngle> = {
  "1/3": "right",
  "1/4": "right",
  "2/4": "right",
  "2/5": "right",
  "3/5": "right",
  "3/6": "right",
  "4/6": "right",
  "4/1": "juxtaposition",
  "5/1": "left",
  "5/2": "left",
  "6/2": "left",
  "6/3": "left",
};

export function profileToAngle(profile: string): IncarnationCrossAngle | null {
  return PROFILE_TO_ANGLE[profile] ?? null;
}

const RIGHT_ANGLE_CROSSES: Record<number, string> = {
  1: "RAX Sphinx 4",
  2: "RAX Sphinx 2",
  3: "RAX Laws 1",
  4: "RAX Explanation 3",
  5: "RAX Consciousness 4",
  6: "RAX Eden 3",
  7: "RAX Sphinx 3",
  8: "RAX Contagion 2",
  9: "RAX Planning 4",
  10: "RAX Vessel of Love 4",
  11: "RAX Eden 4",
  12: "RAX Eden 2",
  13: "RAX Sphinx 1",
  14: "RAX Contagion 4",
  15: "RAX Vessel of Love 2",
  16: "RAX Planning 2",
  17: "RAX Service 1",
  18: "RAX Service 3",
  19: "RAX Four Ways 4",
  20: "RAX Sleeping Phoenix 2",
  21: "RAX Tension 1",
  22: "RAX Rulership 1",
  23: "RAX Explanation 2",
  24: "RAX Four Ways 1",
  25: "RAX Vessel of Love 1",
  26: "RAX Rulership 4",
  27: "RAX Unexpected 1",
  28: "RAX Unexpected 3",
  29: "RAX Contagion 3",
  30: "RAX Contagion 1",
  31: "RAX Unexpected 2",
  32: "RAX Maya 3",
  33: "RAX Four Ways 2",
  34: "RAX Sleeping Phoenix 4",
  35: "RAX Consciousness 2",
  36: "RAX Eden 1",
  37: "RAX Planning 1",
  38: "RAX Tension 4",
  39: "RAX Tension 2",
  40: "RAX Planning 3",
  41: "RAX Unexpected 4",
  42: "RAX Maya 1",
  43: "RAX Explanation 4",
  44: "RAX Four Ways 3",
  45: "RAX Rulership 2",
  46: "RAX Vessel of Love 3",
  47: "RAX Rulership 3",
  48: "RAX Tension 3",
  49: "RAX Explanation 1",
  50: "RAX Laws 3",
  51: "RAX Penetration 1",
  52: "RAX Service 2",
  53: "RAX Penetration 2",
  54: "RAX Penetration 4",
  55: "RAX Sleeping Phoenix 1",
  56: "RAX Laws 2",
  57: "RAX Penetration 3",
  58: "RAX Service 4",
  59: "RAX Sleeping Phoenix 3",
  60: "RAX Laws 4",
  61: "RAX Maya 4",
  62: "RAX Maya 2",
  63: "RAX Consciousness 1",
  64: "RAX Consciousness 3",
};

const LEFT_ANGLE_CROSSES: Record<number, string> = {
  1: "LAX Defiance 2",
  2: "LAX Defiance 1",
  3: "LAX Wishes 1",
  4: "LAX Revolution 2",
  5: "LAX Separation 2",
  6: "LAX Plane 2",
  7: "LAX Masks 2",
  8: "LAX Uncertainty 1",
  9: "LAX Identification 2",
  10: "LAX Prevention 2",
  11: "LAX Education 2",
  12: "LAX Education 1",
  13: "LAX Masks 1",
  14: "LAX Uncertainty 2",
  15: "LAX Prevention 1",
  16: "LAX Identification 1",
  17: "LAX Upheaval 1",
  18: "LAX Upheaval 2",
  19: "LAX Refinement 2",
  20: "LAX Duality 1",
  21: "LAX Endeavour 1",
  22: "LAX Informing 1",
  23: "LAX Dedication 1",
  24: "LAX Incarnation 1",
  25: "LAX Healing 1",
  26: "LAX Confrontation 2",
  27: "LAX Alignment 1",
  28: "LAX Alignment 2",
  29: "LAX Industry 2",
  30: "LAX Industry 1",
  31: "LAX Alpha 1",
  32: "LAX Limitation 2",
  33: "LAX Refinement 1",
  34: "LAX Duality 2",
  35: "LAX Separation 1",
  36: "LAX Plane 1",
  37: "LAX Migration 1",
  38: "LAX Individualism 2",
  39: "LAX Individualism 1",
  40: "LAX Migration 2",
  41: "LAX Alpha 2",
  42: "LAX Limitation 1",
  43: "LAX Dedication 2",
  44: "LAX Incarnation 2",
  45: "LAX Confrontation 1",
  46: "LAX Healing 2",
  47: "LAX Informing 2",
  48: "LAX Endeavour 2",
  49: "LAX Revolution 1",
  50: "LAX Wishes 2",
  51: "LAX Clarion 1",
  52: "LAX Demands 1",
  53: "LAX Cycles 1",
  54: "LAX Cycles 2",
  55: "LAX Spirit 1",
  56: "LAX Distraction 1",
  57: "LAX Clarion 2",
  58: "LAX Demands 2",
  59: "LAX Spirit 2",
  60: "LAX Distraction 2",
  61: "LAX Obscuration 2",
  62: "LAX Obscuration 1",
  63: "LAX Dominion 1",
  64: "LAX Dominion 2",
};

const JUXTAPOSITION_CROSSES: Record<number, string> = {
  1: "JUX Self-Expression",
  2: "JUX Driver",
  3: "JUX Mutation",
  4: "JUX Formulization",
  5: "JUX Habits",
  6: "JUX Conflict",
  7: "JUX Interaction",
  8: "JUX Contribution",
  9: "JUX Focus",
  10: "JUX Behavior",
  11: "JUX Ideas",
  12: "JUX Articulation",
  13: "JUX Listening",
  14: "JUX Empowering",
  15: "JUX Extremes",
  16: "JUX Experimentation",
  17: "JUX Opinions",
  18: "JUX Correction",
  19: "JUX Need",
  20: "JUX Now",
  21: "JUX Control",
  22: "JUX Grace",
  23: "JUX Assimilation",
  24: "JUX Rationalization",
  25: "JUX Innocence",
  26: "JUX Trickster",
  27: "JUX Caring",
  28: "JUX Risks",
  29: "JUX Commitment",
  30: "JUX Fates",
  31: "JUX Influence",
  32: "JUX Conservation",
  33: "JUX Retreat",
  34: "JUX Power",
  35: "JUX Experience",
  36: "JUX Crisis",
  37: "JUX Bargains",
  38: "JUX Opposition",
  39: "JUX Provocation",
  40: "JUX Denial",
  41: "JUX Fantasy",
  42: "JUX Completion",
  43: "JUX Insight",
  44: "JUX Alertness",
  45: "JUX Possession",
  46: "JUX Serendipity",
  47: "JUX Oppression",
  48: "JUX Depth",
  49: "JUX Principles",
  50: "JUX Values",
  51: "JUX Shock",
  52: "JUX Stillness",
  53: "JUX Beginnings",
  54: "JUX Ambition",
  55: "JUX Moods",
  56: "JUX Stimulation",
  57: "JUX Intuition",
  58: "JUX Vitality",
  59: "JUX Strategy",
  60: "JUX Limitation",
  61: "JUX Thinking",
  62: "JUX Detail",
  63: "JUX Doubts",
  64: "JUX Confusion",
};

/**
 * Returns the Incarnation Cross short name (Genetic Matrix dialect, ej
 * "RAX Service 4", "LAX Industry 1", "JUX Conflict") given the Personality.Sun
 * gate and the profile string.
 *
 * Returns `""` if inputs are invalid (gate out of [1..64] or profile not
 * recognized).
 */
export function lookupIncarnationCross(
  personalitySunGate: number,
  profile: string,
): string {
  if (!Number.isInteger(personalitySunGate) || personalitySunGate < 1 || personalitySunGate > 64) {
    return "";
  }
  const angle = profileToAngle(profile);
  if (!angle) return "";
  const table =
    angle === "right" ? RIGHT_ANGLE_CROSSES
    : angle === "left" ? LEFT_ANGLE_CROSSES
    : JUXTAPOSITION_CROSSES;
  return table[personalitySunGate] ?? "";
}
