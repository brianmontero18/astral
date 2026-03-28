import { useState, useRef, useCallback, useEffect } from "react";
import { transcribeAudio } from "../api";

const MIC_BLOCKED_MSG =
  "Micrófono bloqueado. Habilitalo en la configuración del navegador.";

function getErrorMessage(err: unknown): string {
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

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef("audio/webm");

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      mimeRef.current = mime;

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      setIsRecording(false);
      return null;
    }

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const type = mimeRef.current.includes("mp4") ? "audio/mp4" : "audio/webm";
        resolve(new Blob(chunksRef.current, { type }));
      };
      recorder.stop();
    });

    cleanup();
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const ext = mimeRef.current.includes("mp4") ? "voice.mp4" : "voice.webm";
      const { text } = await transcribeAudio(blob, ext);
      setIsTranscribing(false);
      return text.trim() || null;
    } catch {
      setError("Error al transcribir el audio");
      setIsTranscribing(false);
      return null;
    }
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    cleanup();
    setIsRecording(false);
    setError(null);
  }, [cleanup]);

  return { isRecording, isTranscribing, error, startRecording, stopRecording, cancelRecording };
}
