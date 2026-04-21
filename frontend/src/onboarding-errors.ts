const CONNECTIVITY_MARKERS = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
] as const;

const PDF_ONLY_MESSAGE =
  "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas.";
const UNSUPPORTED_SOURCE_MESSAGE =
  "Solo aceptamos PDFs oficiales de MyHumanDesign o Genetic Matrix. Reexporta el bodygraph desde la fuente oficial.";
const UNREADABLE_PDF_MESSAGE =
  "No pudimos leer tu PDF. Reexporta el bodygraph desde la fuente oficial y vuelve a subirlo.";
const GENERIC_ONBOARDING_FAILURE =
  "No pudimos leer tu carta ahora. Reintentá con otro PDF o probá de nuevo.";

export function getOnboardingFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return GENERIC_ONBOARDING_FAILURE;
  }

  const normalized = error.message.trim();

  if (
    normalized === PDF_ONLY_MESSAGE ||
    normalized === UNSUPPORTED_SOURCE_MESSAGE ||
    normalized === UNREADABLE_PDF_MESSAGE
  ) {
    return normalized;
  }

  if (normalized === "No file uploaded") {
    return "Elegí un PDF antes de continuar.";
  }

  if (normalized.startsWith("Invalid file type:")) {
    return PDF_ONLY_MESSAGE;
  }

  if (
    CONNECTIVITY_MARKERS.some((marker) => normalized.includes(marker))
  ) {
    return "No pudimos leer tu carta ahora. Reintentá en unos segundos.";
  }

  return GENERIC_ONBOARDING_FAILURE;
}
