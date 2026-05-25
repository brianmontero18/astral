const REPORT_FAILURE_MESSAGES = {
  profile_incomplete: "Tu perfil HD no está completo. Revisá la carta cargada.",
  no_active_bodygraph: "Necesitamos una carta activa para generar tu informe. Cargá o calculá tu carta desde Mi Carta.",
  report_rate_limited: "Esperá unos segundos antes de generar otro informe.",
  extraction_failed: "No pudimos procesar esta carta. Probá subirla nuevamente.",
  model_failed: "Hubo un error temporal. Intentá en unos minutos.",
  intake_required: "Completá tu intake antes de generar el informe.",
  onboarding_required: "Terminá tu onboarding antes de generar el informe.",
  report_tier_not_allowed: "Tu plan actual no incluye este informe.",
} as const;

const NETWORK_ERROR_MARKERS = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
  "fetch failed",
] as const;

export type ReportFailureCode = keyof typeof REPORT_FAILURE_MESSAGES;

export function isReportFailureCode(value: unknown): value is ReportFailureCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(REPORT_FAILURE_MESSAGES, value)
  );
}

export function getReportFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = error instanceof Error
    ? (error as { code?: unknown }).code
    : undefined;

  if (isReportFailureCode(code)) {
    return REPORT_FAILURE_MESSAGES[code];
  }

  if (isReportFailureCode(message)) {
    return REPORT_FAILURE_MESSAGES[message];
  }

  if (NETWORK_ERROR_MARKERS.some((marker) => message.includes(marker))) {
    return "No pudimos conectar con Astral en este momento. Revisá tu conexión y reintentá.";
  }

  return "No se pudo generar el informe. Intentá de nuevo.";
}
