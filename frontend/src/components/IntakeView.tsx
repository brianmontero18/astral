import { useState, useEffect } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import type { Intake } from "../types";

interface Props {
  initialIntake?: Intake;
  hasExistingReport?: boolean;
  onSubmit: (intake: Intake) => void;
  onSkip: () => void;
}

const FIELDS: { key: keyof Intake; label: string; placeholder: string }[] = [
  { key: "actividad", label: "¿A qué te dedicás?", placeholder: "Ej: Soy diseñadora freelance..." },
  { key: "objetivos", label: "¿Qué buscás en este momento?", placeholder: "Ej: Quiero entender por qué me agoto..." },
  { key: "desafios", label: "¿Cuál es tu mayor desafío?", placeholder: "Ej: Me cuesta decir que no a proyectos..." },
];

function MicButton({ onTranscription }: { onTranscription: (text: string) => void }) {
  const { isRecording, isTranscribing, error, autoResult, startRecording, stopRecording, cancelRecording, consumeAutoResult } = useVoiceRecorder();

  useEffect(() => {
    if (autoResult) {
      onTranscription(autoResult);
      consumeAutoResult();
    }
  }, [autoResult, onTranscription, consumeAutoResult]);

  const handleClick = async () => {
    if (isRecording) {
      const text = await stopRecording();
      if (text) onTranscription(text);
    } else {
      startRecording();
    }
  };

  if (isTranscribing) {
    return (
      <div style={{
        width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 14, height: 14,
          border: "2px solid var(--color-primary-dim)",
          borderTopColor: "var(--color-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button
        type="button"
        onClick={handleClick}
        title={isRecording ? "Detener grabación" : "Grabar con voz"}
        style={{
          width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, transition: "all 0.2s ease",
          background: isRecording ? "rgba(201,107,122,0.2)" : "var(--color-primary-faint)",
          color: isRecording ? "#f3c2c2" : "var(--text-gold)",
          animation: isRecording ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        {isRecording ? "⏹" : "🎤"}
      </button>
      {isRecording && (
        <button
          type="button"
          onClick={cancelRecording}
          style={{
            background: "transparent", border: "none", color: "#f3c2c2",
            fontSize: 11, cursor: "pointer", padding: "2px 4px",
          }}
        >
          ✕
        </button>
      )}
      {error && (
        <span style={{ color: "#f3c2c2", fontSize: 10, maxWidth: 120, lineHeight: 1.3 }}>
          {error}
        </span>
      )}
    </div>
  );
}

export function IntakeView({ initialIntake, hasExistingReport, onSubmit, onSkip }: Props) {
  const [values, setValues] = useState<Intake>({
    actividad: initialIntake?.actividad ?? "",
    objetivos: initialIntake?.objetivos ?? "",
    desafios: initialIntake?.desafios ?? "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key: keyof Intake, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{
      flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
      alignItems: "center", padding: "32px 16px",
    }}>
      <div style={{ maxWidth: 760, width: "100%" }}>
        <div style={{
          color: "var(--color-gold-deep)", fontSize: 10, letterSpacing: "0.22em",
          fontWeight: 700, marginBottom: 8, fontFamily: "var(--font-sans)", textTransform: "uppercase",
        }}>
          Contexto personal
        </div>
        <h2 style={{
          fontFamily: "var(--font-serif)", color: "var(--text-on-light)",
          fontSize: 26, fontWeight: 500, margin: "0 0 8px",
        }}>
          Personalizá tu informe
        </h2>
        <p style={{
          color: "var(--text-on-light-muted)", fontSize: 14, lineHeight: 1.65,
          margin: "0 0 28px", fontWeight: 400,
        }}>
          Completá estos campos para que tu informe incluya interpretaciones conectadas
          con tu vida real. Podés escribir o usar el micrófono.
        </p>

        <div style={{
          background: "var(--surface-dark)",
          border: "1px solid rgba(33, 41, 30, 0.32)",
          borderRadius: 18,
          padding: "22px 22px 18px",
          marginBottom: 20,
          color: "var(--text-main)",
        }}>
          {FIELDS.map(({ key, label, placeholder }, idx) => (
            <div key={key} style={{ marginBottom: idx === FIELDS.length - 1 ? 0 : 18 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 8,
              }}>
                <label htmlFor={`intake-${key}`} style={{
                  color: "var(--text-main)", fontSize: 13, fontWeight: 600,
                  fontFamily: "var(--font-sans)",
                }}>
                  {label}
                </label>
                <MicButton
                  onTranscription={(text) => handleChange(key, (values[key] ?? "") + (values[key] ? " " : "") + text)}
                />
              </div>
              <textarea
                id={`intake-${key}`}
                value={values[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                rows={3}
                style={{
                  width: "100%", background: "rgba(248, 244, 232, 0.06)",
                  border: "1px solid rgba(248, 244, 232, 0.18)", borderRadius: 10,
                  color: "var(--text-main)", padding: "12px 14px", fontSize: 13,
                  fontFamily: "var(--font-sans)", resize: "vertical", lineHeight: 1.6,
                  outline: "none", transition: "border-color 0.2s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--color-primary)" }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(248, 244, 232, 0.18)" }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button
            onClick={() => { if (!submitting) { if (hasExistingReport) { onSkip(); } else { setSubmitting(true); onSkip(); } } }}
            disabled={submitting}
            style={{
              flex: 1, padding: "14px 20px", borderRadius: 8,
              background: "transparent", border: "1px solid var(--surface-deeper)",
              color: "var(--text-on-light)", fontSize: 12, fontWeight: 600,
              cursor: submitting ? "default" : "pointer", fontFamily: "var(--font-sans)",
              letterSpacing: "0.14em", textTransform: "uppercase",
              transition: "all 0.3s ease", opacity: submitting ? 0.5 : 1,
            }}
          >
            {hasExistingReport ? "Volver al informe" : "Omitir"}
          </button>
          <button
            onClick={() => { if (!submitting) { setSubmitting(true); onSubmit(values); } }}
            disabled={submitting}
            style={{
              flex: 2, padding: "14px 20px", borderRadius: 8,
              background: "linear-gradient(135deg, #e0c081 0%, #9d7f4d 100%)",
              border: "1px solid var(--color-primary)",
              color: "var(--surface-deeper)", fontSize: 12, fontWeight: 700,
              cursor: submitting ? "default" : "pointer", fontFamily: "var(--font-sans)",
              letterSpacing: "0.14em", textTransform: "uppercase",
              transition: "all 0.3s ease", opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Generando..." : hasExistingReport ? "Regenerar mi informe" : "Generar mi informe"}
          </button>
        </div>
      </div>
    </div>
  );
}
