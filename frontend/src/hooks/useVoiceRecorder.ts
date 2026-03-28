import { useState, useRef, useCallback, useEffect } from "react";
import { transcribeAudio } from "../api";
import { getAudioErrorMessage, detectAudioMime } from "../utils/audio";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoResult, setAutoResult] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef("audio/webm");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopResolveRef = useRef<((blob: Blob) => void) | null>(null);

  const MAX_DURATION_MS = 60_000;

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stopResolveRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const transcribeBlob = useCallback(async (blob: Blob): Promise<string | null> => {
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

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      mimeRef.current = detectAudioMime();

      const recorder = new MediaRecorder(stream, { mimeType: mimeRef.current });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = mimeRef.current.includes("mp4") ? "audio/mp4" : "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (stopResolveRef.current) {
          stopResolveRef.current(blob);
          stopResolveRef.current = null;
        } else {
          // Auto-stop from timer — transcribe and surface via autoResult
          transcribeBlob(blob).then((text) => { if (text) setAutoResult(text); });
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      timerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, MAX_DURATION_MS);
    } catch (err) {
      setError(getAudioErrorMessage(err));
    }
  }, [transcribeBlob]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      setIsRecording(false);
      return null;
    }

    const blob = await new Promise<Blob>((resolve) => {
      stopResolveRef.current = resolve;
      recorder.stop();
    });

    return transcribeBlob(blob);
  }, [cleanup, transcribeBlob]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setIsRecording(false);
    setError(null);
  }, [cleanup]);

  const consumeAutoResult = useCallback(() => {
    const text = autoResult;
    setAutoResult(null);
    return text;
  }, [autoResult]);

  return { isRecording, isTranscribing, error, autoResult, startRecording, stopRecording, cancelRecording, consumeAutoResult };
}
