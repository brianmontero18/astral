export const MIC_BLOCKED_MSG =
  "Micrófono bloqueado. Habilitalo en la configuración del navegador.";

export function getAudioErrorMessage(err: unknown): string {
  if (!(err instanceof DOMException)) return "Error al acceder al micrófono";
  switch (err.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return MIC_BLOCKED_MSG;
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No se detectó ningún micrófono.";
    case "NotReadableError":
    case "TrackStartError":
      return "El micrófono está siendo usado por otra app.";
    default:
      return "No se pudo acceder al micrófono";
  }
}

export function detectAudioMime(): string {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "audio/mp4";
}
