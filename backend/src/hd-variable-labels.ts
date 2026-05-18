/**
 * Variable Wheel labels (semantic) — Foundation Chart de Genetic Matrix.
 *
 * Capa CÁLCULO. Cero geometría / rendering.
 *
 * Mapea las 4 Variables HD (digestion, awareness, environment, perspective)
 * a los 13 labels textuales que Genetic Matrix muestra en el Foundation
 * Chart (Brain, Determination, Cognition, Environment, Environment Style,
 * Personality, Motivation, Sense, Trajectory, View Perspective, View,
 * Transferred Motivation, Transferred View).
 *
 * Fuentes (multi-agent cross-validation 2026-05-17):
 *  - Jovian Archive (oficial Ra Uru Hu): Motivation, View, Environment,
 *    leftness/rightness mechanics.
 *  - SharpAstrology.HumanDesign (MIT, CReizner): Variable assignments
 *    (digestion=D.Sun, awareness=P.Sun, environment=D.NN, perspective=P.NN)
 *    + tone→orientation (1-3=left, 4-6=right).
 *  - pyhd (MIT, ppo): tablas de Determinations, Environments, Trajectory pairs
 *    by Motivation, transference logic (color +3 mod 6).
 *  - eCarlsson-r/HumanDesign-API (.NET): enums de Motivation, Sense.
 *  - SharonGKAstro/Energetic-Blueprint (GPL): cutoff de orientation y labels
 *    Strategic/Receptive/Active/Passive/Focused/Peripheral/Observer/Observed.
 *
 * Ground truth ÚNICO disponible: Agostina Faedda (1988-12-28 06:13 UTC).
 * Los 13 labels validan 13/13 contra su Foundation Chart de Genetic Matrix.
 *
 * Confianza por label:
 *  - 11 labels: triple-source consensus (alta) — Brain, Cognition, Environment,
 *    Environment Style, Personality, Motivation, Sense, View Perspective,
 *    View, Transferred Motivation, Transferred View.
 *  - 2 labels: double-source consensus (alta-media) — Determination (color 1
 *    sub-expression L/R), Trajectory (pair names para color 4-6).
 *
 * 2do ground truth (TODO): cualquier chart con motivation != Fear permite
 * confirmar las pair names de Trajectory (Hope/Desire/Need/Guilt/Innocence).
 */

import type { HdVariable } from "./agent-service.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Para tone 1..6, retorna true si está en el lado izquierdo (1-3) del wheel.
 * Source: SharpAstrology Enums/Tone.cs `ToOrientation()`.
 */
function isLeftTone(tone: number): boolean {
  return tone >= 1 && tone <= 3;
}

/**
 * Transferencia canónica HD: el color "opuesto" en el wheel hexagrámico,
 * desplazado +3 mod 6. Pares: 1↔4, 2↔5, 3↔6.
 * Source: pyhd `VariableEnum.transference`.
 */
function transferColor(color: number): number {
  if (!Number.isInteger(color) || color < 1 || color > 6) return 0;
  return ((color - 1 + 3) % 6) + 1;
}

// ─── Color/tone tables (1..6 indexed) ───────────────────────────────────────

/** Cognition — awareness.color. */
const COGNITION_BY_COLOR: Record<number, string> = {
  1: "Smell",
  2: "Taste",
  3: "Outer Vision",
  4: "Inner Vision",
  5: "Feeling",
  6: "Touch",
};

/** Motivation — awareness.color. */
const MOTIVATION_BY_COLOR: Record<number, string> = {
  1: "Fear",
  2: "Hope",
  3: "Desire",
  4: "Need",
  5: "Guilt",
  6: "Innocence",
};

/** Sense — awareness.tone. */
const SENSE_BY_TONE: Record<number, string> = {
  1: "Security",
  2: "Uncertainty",
  3: "Action",
  4: "Meditation",
  5: "Judgment",
  6: "Acceptance",
};

/** Environment color — environment.color (D.NN.color). */
const ENVIRONMENT_BY_COLOR: Record<number, string> = {
  1: "Caves",
  2: "Markets",
  3: "Kitchens",
  4: "Mountains",
  5: "Valleys",
  6: "Shores",
};

/**
 * Sub-expression de Environment por color (L/R). Genetic Matrix muestra
 * "Mountains - Passive" para color=4 + tone right (=Passive).
 * Source: pyhd `Environments`, eCarlsson `Environment.cs`.
 */
const ENVIRONMENT_SUB_BY_COLOR: Record<number, { left: string; right: string }> = {
  1: { left: "Selective", right: "Blending" },
  2: { left: "Internal", right: "External" },
  3: { left: "Wet", right: "Dry" },
  4: { left: "Active", right: "Passive" },
  5: { left: "Narrow", right: "Wide" },
  6: { left: "Natural", right: "Artificial" },
};

/** View — perspective.color (P.NN.color). */
const VIEW_BY_COLOR: Record<number, string> = {
  1: "Survival",
  2: "Possibility",
  3: "Power",
  4: "Wanting",
  5: "Probability",
  6: "Personal",
};

/**
 * Determination color name + L/R sub-expression. Genetic Matrix muestra
 * solo la sub-expression para color=N (ej "Open" para color=2 + tone left).
 * Color 1 sub-expression: Agent 1+2 consensus (Consecutive/Alternating).
 */
const DETERMINATION_COLOR_NAMES: Record<number, string> = {
  1: "Appetite",
  2: "Taste",
  3: "Thirst",
  4: "Touch",
  5: "Sound",
  6: "Light",
};

const DETERMINATION_SUB_BY_COLOR: Record<number, { left: string; right: string }> = {
  1: { left: "Consecutive", right: "Alternating" },
  2: { left: "Open", right: "Closed" },
  3: { left: "Hot", right: "Cold" },
  4: { left: "Calm", right: "Nervous" },
  5: { left: "High", right: "Low" },
  6: { left: "Direct", right: "Indirect" },
};

/**
 * Trajectory pairs por Motivation color (awareness.color). El lado L/R
 * lo elige awareness.tone (≤3 = left = primer label).
 * Pair names: pyhd + IHDS canon.
 */
const TRAJECTORY_PAIRS_BY_COLOR: Record<number, { left: string; right: string }> = {
  1: { left: "Communalist", right: "Separatist" },         // Fear
  2: { left: "Theist", right: "Anti-Theist" },             // Hope
  3: { left: "Leader", right: "Follower" },                // Desire
  4: { left: "Master", right: "Novice" },                  // Need
  5: { left: "Conditioner", right: "Conditioned" },        // Guilt
  6: { left: "Observer", right: "Observed" },              // Innocence
};

// ─── Public API ─────────────────────────────────────────────────────────────

export interface VariableLabels {
  /** From digestion.tone L/R. */
  brain: "Active" | "Passive";
  /** From digestion.color + tone L/R sub-expression. Genetic Matrix surfaces just the sub-expression (e.g. "Open"). */
  determination: string;
  /** From digestion.color (the noun, e.g. "Taste"). Útil cuando se necesita el color name sin sub-expression. */
  determinationCategory: string;
  /** From awareness.color. */
  cognition: string;
  /** From environment.color (e.g. "Mountains"). */
  environment: string;
  /** From environment.color + tone L/R (e.g. "Mountains - Passive"). */
  environmentDetail: string;
  /** From environment.tone L/R (universal observer/observed). */
  environmentStyle: "Observed" | "Observer";
  /** From awareness.tone L/R. */
  personality: "Strategic" | "Receptive";
  /** From awareness.color. */
  motivation: string;
  /** From awareness.tone (the tone-keynote). */
  sense: string;
  /** From awareness.color → pair, awareness.tone L/R → side. */
  trajectory: string;
  /** From perspective.tone L/R. */
  viewPerspective: "Focused" | "Peripheral";
  /** From perspective.color. */
  view: string;
  /** awareness.color +3 mod 6 → Motivation table. */
  transferredMotivation: string;
  /** perspective.color +3 mod 6 → View table. */
  transferredView: string;
}

/**
 * Computa los 13 labels semánticos del Variable Wheel a partir de las 4
 * Variables canónicas. Retorna strings vacíos si los inputs no son válidos
 * (color/tone fuera de rango).
 */
export function computeVariableLabels(vars: {
  digestion: HdVariable;
  awareness: HdVariable;
  environment: HdVariable;
  perspective: HdVariable;
}): VariableLabels {
  const dig = vars.digestion;
  const aw = vars.awareness;
  const env = vars.environment;
  const persp = vars.perspective;

  // Brain — digestion.tone L/R.
  const brain: "Active" | "Passive" = isLeftTone(dig.tone) ? "Active" : "Passive";

  // Determination — digestion.color + tone L/R sub-expression.
  const detCategory = DETERMINATION_COLOR_NAMES[dig.color] ?? "";
  const detSub = DETERMINATION_SUB_BY_COLOR[dig.color];
  const determination = detSub
    ? isLeftTone(dig.tone) ? detSub.left : detSub.right
    : "";

  // Cognition — awareness.color.
  const cognition = COGNITION_BY_COLOR[aw.color] ?? "";

  // Environment — environment.color (e.g. "Mountains").
  const envName = ENVIRONMENT_BY_COLOR[env.color] ?? "";
  const envSub = ENVIRONMENT_SUB_BY_COLOR[env.color];
  const envSubLabel = envSub
    ? isLeftTone(env.tone) ? envSub.left : envSub.right
    : "";
  const environmentDetail = envName && envSubLabel ? `${envName} - ${envSubLabel}` : envName;

  // Environment Style — environment.tone L/R (universal).
  const environmentStyle: "Observed" | "Observer" = isLeftTone(env.tone) ? "Observed" : "Observer";

  // Personality — awareness.tone L/R.
  const personality: "Strategic" | "Receptive" = isLeftTone(aw.tone) ? "Strategic" : "Receptive";

  // Motivation — awareness.color.
  const motivation = MOTIVATION_BY_COLOR[aw.color] ?? "";

  // Sense — awareness.tone.
  const sense = SENSE_BY_TONE[aw.tone] ?? "";

  // Trajectory — awareness.color → pair, awareness.tone L/R → side.
  const trajPair = TRAJECTORY_PAIRS_BY_COLOR[aw.color];
  const trajectory = trajPair
    ? isLeftTone(aw.tone) ? trajPair.left : trajPair.right
    : "";

  // View Perspective — perspective.tone L/R.
  const viewPerspective: "Focused" | "Peripheral" = isLeftTone(persp.tone) ? "Focused" : "Peripheral";

  // View — perspective.color.
  const view = VIEW_BY_COLOR[persp.color] ?? "";

  // Transferred Motivation — awareness.color +3 mod 6 → MOTIVATION_BY_COLOR.
  const transferredMotivation = MOTIVATION_BY_COLOR[transferColor(aw.color)] ?? "";

  // Transferred View — perspective.color +3 mod 6 → VIEW_BY_COLOR.
  const transferredView = VIEW_BY_COLOR[transferColor(persp.color)] ?? "";

  return {
    brain,
    determination,
    determinationCategory: detCategory,
    cognition,
    environment: envName,
    environmentDetail,
    environmentStyle,
    personality,
    motivation,
    sense,
    trajectory,
    viewPerspective,
    view,
    transferredMotivation,
    transferredView,
  };
}
