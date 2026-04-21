const AUTH_ERROR_MARKERS = [
  "authentication_required",
  "identity_not_linked",
  "client_identity_mismatch",
  "Backend error 401",
  "Backend error 403",
  "Backend error 409",
];

const NETWORK_ERROR_MARKERS = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
  "fetch failed",
];

const TIMEOUT_ERROR_MARKERS = [
  "timeout",
  "timed out",
  "AbortError",
  "aborted",
];

export function getChatFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (AUTH_ERROR_MARKERS.some((marker) => message.includes(marker))) {
    return "Tu sesión se cerró o venció. Volvé a entrar para seguir.";
  }

  if (NETWORK_ERROR_MARKERS.some((marker) => message.includes(marker))) {
    return "No pudimos conectar con Astral Guide en este momento. Revisá tu conexión y reintentá.";
  }

  const lowerMessage = message.toLowerCase();
  if (TIMEOUT_ERROR_MARKERS.some((marker) => lowerMessage.includes(marker.toLowerCase()))) {
    return "La respuesta tardó demasiado. Probá de nuevo.";
  }

  return "No se pudo responder en este momento. Probá de nuevo.";
}
