const AUTH_ERROR_MARKERS = [
  "authentication_required",
  "identity_not_linked",
  "client_identity_mismatch",
  "Transits error 401",
  "Transits error 403",
  "Transits error 409",
];

const NETWORK_ERROR_MARKERS = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
  "fetch failed",
];

export function getTransitFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (AUTH_ERROR_MARKERS.some((marker) => message.includes(marker))) {
    return "Tu sesión se cerró o venció. Volvé a entrar para ver tus tránsitos.";
  }

  if (NETWORK_ERROR_MARKERS.some((marker) => message.includes(marker))) {
    return "No pudimos cargar tus tránsitos ahora. Revisá tu conexión y reintentá.";
  }

  return "No pudimos cargar tus tránsitos ahora. Probá de nuevo.";
}
