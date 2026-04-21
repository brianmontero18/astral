const ASSET_CONNECTIVITY_MARKERS = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
] as const;

export function getAssetFailureMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const normalized = error.message.trim();

  if (normalized === "No file uploaded") {
    return "Elegí un archivo antes de continuar.";
  }

  if (normalized.startsWith("Invalid file type:")) {
    return "Podés subir PDF, PNG, JPG o TXT.";
  }

  if (normalized === "File exceeds 10MB limit") {
    return "El archivo supera el límite de 10 MB.";
  }

  if (normalized === "Asset not found") {
    return "Ese archivo ya no está disponible.";
  }

  if (normalized === "asset_forbidden") {
    return "No tenés acceso a este archivo.";
  }

  if (
    normalized ===
    "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas."
  ) {
    return normalized;
  }

  if (
    ASSET_CONNECTIVITY_MARKERS.some((marker) => normalized.includes(marker))
  ) {
    return "No pudimos conectar tus archivos en este momento. Reintentá en unos segundos.";
  }

  return fallback;
}
