/**
 * Quality Eval Suites
 *
 * Mapea el contexto de runtime (profile / intake / memory / output) a un EvalSuite[]
 * listo para runEvals(). Mantiene prompt-eval.ts como librería pura, desacoplada del
 * runtime. Combina grounding HD (data verificada del profile) con la rúbrica de
 * advisor quality de docs/ai-refactor/06-advisor-quality-audit.md.
 */

import type { Intake } from "../report/types.js";
import type { UserProfile } from "../types/agent.js";
import {
  type EvalSuite,
  evalAntiSycophancy,
  evalEmotionalAltitude,
  evalHdCitationChangesAdvice,
  evalLegacyWeeklyReportMinSentencesPerSection,
  evalLegacyWeeklyReportNoMarkdown,
  evalLegacyWeeklyReportNoPreText,
  evalLegacyWeeklyReportSections,
  evalNoDefaultReportScaffold,
  evalNoGenericAdvisorLanguage,
  evalNoHallucinatedGates,
  evalSpanish,
  evalUsesBusinessContext,
} from "./prompt-eval.js";

export interface ChatEvalContext {
  output: string;
  userInput: string;
  profile: UserProfile;
  intake?: Intake;
  memory?: string;
  /**
   * Gates currently activated by transit (planets' hdGate this week). Counted as
   * valid grounding alongside natal gates: a weekly reading legitimately cites
   * transit gates, so they must NOT register as hallucinations.
   */
  transitGates?: number[];
}

export interface ReportEvalContext {
  output: string;
  profile: UserProfile;
  intake?: Intake;
  memory?: string;
  /** Formato legacy semanal (7 secciones con emoji). Activa los checks de scaffold. */
  legacyFormat?: boolean;
}

/** Grounding HD verificado: solo se deriva de la carta calculada, no del prompt (e2h.18). */
function validGatesOf(profile: UserProfile): number[] {
  return profile.humanDesign.activatedGates.map((g) => g.number);
}

/**
 * Suite para output de chat. NO incluye evalMentionsGates/Centers a propósito:
 * exigir mención de HD en cada turno contradice la rúbrica (HD solo si cambia el
 * consejo; turnos emocionales no deben citar puertas). El grounding acá es
 * anti-alucinación (evalNoHallucinatedGates: pasa si no menciona, falla si inventa).
 */
export function runChatQualityEvals(ctx: ChatEvalContext): EvalSuite[] {
  const validGates = [...new Set([...validGatesOf(ctx.profile), ...(ctx.transitGates ?? [])])];
  return [
    { name: "no-hallucinated-gates", fn: () => evalNoHallucinatedGates(ctx.output, validGates) },
    { name: "spanish", fn: () => evalSpanish(ctx.output) },
    { name: "uses-business-context", fn: () => evalUsesBusinessContext(ctx.output, ctx.intake, ctx.memory) },
    { name: "hd-citation-changes-advice", fn: () => evalHdCitationChangesAdvice(ctx.output) },
    { name: "no-generic-advisor-language", fn: () => evalNoGenericAdvisorLanguage(ctx.output) },
    { name: "emotional-altitude", fn: () => evalEmotionalAltitude(ctx.userInput, ctx.output) },
    { name: "anti-sycophancy", fn: () => evalAntiSycophancy(ctx.userInput, ctx.output) },
    { name: "no-default-report-scaffold", fn: () => evalNoDefaultReportScaffold(ctx.userInput, ctx.output) },
  ];
}

/**
 * Suite para reports. Un report ES un informe, así que NO aplican altitude /
 * anti-sycophancy / no-scaffold. Reusa los legacy structural checks solo si el tier
 * usa el formato semanal de 7 secciones.
 */
export function runReportQualityEvals(ctx: ReportEvalContext): EvalSuite[] {
  const validGates = validGatesOf(ctx.profile);
  const suites: EvalSuite[] = [
    { name: "spanish", fn: () => evalSpanish(ctx.output) },
    { name: "no-hallucinated-gates", fn: () => evalNoHallucinatedGates(ctx.output, validGates) },
    { name: "no-generic-advisor-language", fn: () => evalNoGenericAdvisorLanguage(ctx.output) },
    { name: "uses-business-context", fn: () => evalUsesBusinessContext(ctx.output, ctx.intake, ctx.memory) },
    { name: "hd-citation-changes-advice", fn: () => evalHdCitationChangesAdvice(ctx.output) },
  ];
  if (ctx.legacyFormat) {
    suites.push(
      { name: "legacy-sections", fn: () => evalLegacyWeeklyReportSections(ctx.output) },
      { name: "legacy-no-pre-text", fn: () => evalLegacyWeeklyReportNoPreText(ctx.output) },
      { name: "legacy-min-sentences", fn: () => evalLegacyWeeklyReportMinSentencesPerSection(ctx.output) },
      { name: "legacy-no-markdown", fn: () => evalLegacyWeeklyReportNoMarkdown(ctx.output) },
    );
  }
  return suites;
}
