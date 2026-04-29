import { useState, useRef, useEffect, useCallback } from "react";
import { transcribeAudio } from "../api";
import { getAudioErrorMessage, detectAudioMime } from "../utils/audio";

interface Props {
  onTranscription: (text: string) => void;
  onCancel: () => void;
}

const BAR_COUNT = 50;

export function VoiceRecorder({ onTranscription, onCancel }: Props) {
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const barsRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef("audio/webm");

  const drawBars = useCallback(() => {
    const analyser = analyserRef.current;
    const container = barsRef.current;
    if (!analyser || !container) return;

    const data = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      analyser!.getByteFrequencyData(data);
      const bars = container!.children;
      const step = Math.max(1, Math.floor(data.length / bars.length));

      for (let i = 0; i < bars.length; i++) {
        const value = data[Math.min(i * step, data.length - 1)] / 255;
        const height = Math.max(3, value * 30);
        (bars[i] as HTMLElement).style.height = `${height}px`;
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Pre-check permission state if API available
      try {
        if (navigator.permissions?.query) {
          const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") {
            setError("Micrófono bloqueado. Habilitalo en la configuración del navegador (ícono de candado en la barra de dirección).");
            return;
          }
        }
      } catch {
        // permissions.query not supported for microphone (Safari) — continue anyway
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyserRef.current = analyser;

        const mime = detectAudioMime();
        mimeRef.current = mime;

        const recorder = new MediaRecorder(stream, { mimeType: mime });
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;

        drawBars();
      } catch (err) {
        setError(getAudioErrorMessage(err));
      }
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    };
  }, [drawBars]);

  const cleanup = () => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
  };

  const handleConfirm = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const ext = mimeRef.current.includes("mp4") ? "audio/mp4" : "audio/webm";
        resolve(new Blob(chunksRef.current, { type: ext }));
      };
      recorder.stop();
    });

    cleanup();
    setTranscribing(true);

    try {
      const ext = mimeRef.current.includes("mp4") ? "voice.mp4" : "voice.webm";
      const { text } = await transcribeAudio(blob, ext);
      if (text.trim()) {
        onTranscription(text.trim());
      } else {
        onCancel();
      }
    } catch {
      setError("Error al transcribir el audio");
    }
  };

  const handleCancel = () => {
    mediaRecorderRef.current?.stop();
    cleanup();
    onCancel();
  };

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        <span style={{ color: "#f3c2c2", fontSize: 12, fontWeight: 400, lineHeight: 1.4, flex: 1 }}>
          {error}
        </span>
        <button
          onClick={onCancel}
          style={{
            background: "transparent",
            border: "1px solid rgba(248, 244, 232, 0.18)",
            color: "var(--text-muted)",
            borderRadius: 8,
            padding: "5px 12px",
            fontSize: 11,
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "var(--font-sans)",
          }}
        >
          Cerrar
        </button>
      </div>
    );
  }

  if (transcribing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" }}>
        <div
          style={{
            width: 14,
            height: 14,
            border: "2px solid var(--color-primary-dim)",
            borderTopColor: "var(--color-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 300 }}>Transcribiendo...</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
      <button
        onClick={handleCancel}
        aria-label="Cancelar grabación"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "1px solid rgba(248, 244, 232, 0.2)",
          background: "transparent",
          color: "var(--text-muted)",
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.2s ease",
        }}
      >
        ✕
      </button>

      <div
        ref={barsRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          height: 36,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 2,
              minHeight: 3,
              height: 3,
              borderRadius: 1,
              background: "var(--color-primary)",
              opacity: 0.7,
              transition: "height 0.06s ease-out",
            }}
          />
        ))}
      </div>

      <button
        onClick={handleConfirm}
        aria-label="Enviar nota de voz"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #e0c081 0%, #9d7f4d 100%)",
          color: "var(--surface-deeper)",
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.2s ease",
        }}
      >
        ✓
      </button>
    </div>
  );
}
