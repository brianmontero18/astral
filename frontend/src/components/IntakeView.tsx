import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import type { Intake, TipoNegocio } from "../types";

interface SecondaryAction {
  label: string;
  onClick: () => void;
}

interface Props {
  initialIntake?: Intake;
  /** Texto del botón primario. Default: "Continuar". */
  submitLabel?: string;
  /** Subtítulo bajo el header (descripción del paso). Default: copy genérico. */
  description?: string;
  /** Opcional: botón secundario (ej: "Volver al informe", "Cancelar"). */
  secondaryAction?: SecondaryAction;
  /**
   * Callback al confirmar. Puede retornar Promise — si rechaza, el form
   * se reactiva para reintentar. Si resuelve, lo normal es que el caller
   * navegue a otra view y este componente se desmonte.
   */
  onSubmit: (intake: Intake) => Promise<void> | void;
}

type TextField = {
  kind: "textarea";
  key: "actividad" | "desafio_actual" | "objetivo_12m" | "voz_marca";
  label: string;
  placeholder: string;
  required: boolean;
};

type SelectField = {
  kind: "select";
  key: "tipo_de_negocio";
  label: string;
  options: { value: TipoNegocio; label: string }[];
};

type FieldDef = TextField | SelectField;

const TIPO_NEGOCIO_OPTIONS: { value: TipoNegocio; label: string }[] = [
  { value: "mentora", label: "Mentora" },
  { value: "coach", label: "Coach" },
  { value: "marca_personal", label: "Marca personal" },
  { value: "servicios_premium", label: "Servicios premium / high-ticket" },
  { value: "branding", label: "Branding" },
  { value: "otro", label: "Otro" },
];

const FIELDS: FieldDef[] = [
  {
    kind: "textarea",
    key: "actividad",
    label: "¿A qué te dedicás?",
    placeholder: "Ej: Mentora de mujeres que están armando su negocio holístico",
    required: true,
  },
  {
    kind: "textarea",
    key: "desafio_actual",
    label: "¿Qué desafío tenés ahora?",
    placeholder: "Ej: Me cuesta sostener el ritmo de contenido sin sentirme drenada",
    required: true,
  },
  {
    kind: "select",
    key: "tipo_de_negocio",
    label: "Tipo de negocio (opcional)",
    options: TIPO_NEGOCIO_OPTIONS,
  },
  {
    kind: "textarea",
    key: "objetivo_12m",
    label: "¿Qué querés concretar en los próximos 12 meses? (opcional)",
    placeholder: "Ej: Lanzar mi programa grupal con 15 mujeres y dejar de hacer 1:1",
    required: false,
  },
  {
    kind: "textarea",
    key: "voz_marca",
    label: "¿Cómo describirías el tono de tu marca? (opcional)",
    placeholder: "Ej: Cálido pero directo, con humor seco",
    required: false,
  },
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
          color: isRecording ? "#f0a0b0" : "var(--text-gold)",
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
            background: "transparent", border: "none", color: "#f0a0b0",
            fontSize: 11, cursor: "pointer", padding: "2px 4px",
          }}
        >
          ✕
        </button>
      )}
      {error && (
        <span style={{ color: "#f0a0b0", fontSize: 10, maxWidth: 120, lineHeight: 1.3 }}>
          {error}
        </span>
      )}
    </div>
  );
}

const DEFAULT_DESCRIPTION =
  "Completá estos campos para que las respuestas y reportes lleguen específicas a tu negocio. Los dos primeros son obligatorios — los demás te ayudan a profundizar pero podés saltarlos.";

export function IntakeView({
  initialIntake,
  submitLabel = "Continuar",
  description = DEFAULT_DESCRIPTION,
  secondaryAction,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<Intake>({
    actividad: initialIntake?.actividad ?? "",
    desafio_actual: initialIntake?.desafio_actual ?? "",
    tipo_de_negocio: initialIntake?.tipo_de_negocio,
    objetivo_12m: initialIntake?.objetivo_12m ?? "",
    voz_marca: initialIntake?.voz_marca ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [showRequiredHint, setShowRequiredHint] = useState(false);

  // Tracks mount status so we can safely reset submitting after onSubmit
  // resolves/rejects: in the happy path the parent navigates away and the
  // setState would target an unmounted component (React warning); the ref
  // lets us skip that no-op cleanly.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const handleTextChange = (key: TextField["key"], value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (showRequiredHint) setShowRequiredHint(false);
  };

  const handleSelectChange = (key: SelectField["key"], value: string) => {
    setValues((prev) => ({
      ...prev,
      [key]: value === "" ? undefined : (value as TipoNegocio),
    }));
    if (showRequiredHint) setShowRequiredHint(false);
  };

  const requiredOk =
    (values.actividad ?? "").trim().length > 0 &&
    (values.desafio_actual ?? "").trim().length > 0;

  const handleSubmit = async () => {
    if (submitting) return;
    if (!requiredOk) {
      setShowRequiredHint(true);
      return;
    }
    setSubmitting(true);
    // Strip empty optionals so the persisted JSON stays clean.
    const cleaned: Intake = {
      actividad: values.actividad?.trim(),
      desafio_actual: values.desafio_actual?.trim(),
      tipo_de_negocio: values.tipo_de_negocio,
      objetivo_12m: values.objetivo_12m?.trim() || undefined,
      voz_marca: values.voz_marca?.trim() || undefined,
    };
    try {
      await onSubmit(cleaned);
    } finally {
      // Re-enable the form on failure (or on success without nav). Skip when
      // unmounted to avoid React's "setState on unmounted" warning.
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px",
      }}
    >
      <div style={{ maxWidth: 760, width: "100%" }}>
        <div
          style={{
            color: "var(--color-primary)",
            fontSize: 10,
            letterSpacing: "0.2em",
            fontWeight: 600,
            marginBottom: 8,
            fontFamily: "var(--font-sans)",
          }}
        >
          ✦ TU NEGOCIO
        </div>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--text-main)",
            fontSize: 24,
            fontWeight: 400,
            margin: "0 0 8px",
          }}
        >
          Contame de tu negocio
        </h2>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            lineHeight: 1.6,
            margin: "0 0 28px",
            fontWeight: 300,
          }}
        >
          {description}
        </p>

        {FIELDS.map((field) => (
          <div key={field.key} style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <label
                htmlFor={`intake-${field.key}`}
                style={{
                  color: "var(--text-main)",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {field.label}
                {field.kind === "textarea" && field.required && (
                  <span style={{ color: "var(--color-primary)", marginLeft: 4 }}>*</span>
                )}
              </label>
              {field.kind === "textarea" && (
                <MicButton
                  onTranscription={(text) =>
                    handleTextChange(
                      field.key,
                      (values[field.key] ?? "") + (values[field.key] ? " " : "") + text,
                    )
                  }
                />
              )}
            </div>

            {field.kind === "textarea" ? (
              <textarea
                id={`intake-${field.key}`}
                value={values[field.key] ?? ""}
                onChange={(e) => handleTextChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                style={{
                  width: "100%",
                  background: "rgba(124,111,205,0.06)",
                  border: "1px solid rgba(124,111,205,0.2)",
                  borderRadius: 10,
                  color: "var(--text-main)",
                  padding: "12px 14px",
                  fontSize: 13,
                  fontFamily: "var(--font-sans)",
                  resize: "vertical",
                  lineHeight: 1.6,
                  outline: "none",
                  transition: "border-color 0.2s ease",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(124,111,205,0.5)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(124,111,205,0.2)";
                }}
              />
            ) : (
              <select
                id={`intake-${field.key}`}
                value={values[field.key] ?? ""}
                onChange={(e) => handleSelectChange(field.key, e.target.value)}
                style={{
                  width: "100%",
                  background: "rgba(124,111,205,0.06)",
                  border: "1px solid rgba(124,111,205,0.2)",
                  borderRadius: 10,
                  color: "var(--text-main)",
                  padding: "12px 14px",
                  fontSize: 13,
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <option value="">Sin elegir</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value} style={{ background: "var(--bg-dark)" }}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}

        {showRequiredHint && (
          <div
            style={{
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 14,
              background: "rgba(201,107,122,0.08)",
              border: "1px solid rgba(201,107,122,0.35)",
              color: "#f0a0b0",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Necesitamos al menos los dos campos marcados con * para que tu agente arranque con contexto real.
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          {secondaryAction && (
            <button
              onClick={() => {
                if (!submitting) secondaryAction.onClick();
              }}
              disabled={submitting}
              style={{
                flex: 1,
                padding: "14px 20px",
                borderRadius: 30,
                background: "transparent",
                border: "1px solid rgba(124,111,205,0.3)",
                color: "var(--text-muted)",
                fontSize: 13,
                fontWeight: 500,
                cursor: submitting ? "default" : "pointer",
                fontFamily: "var(--font-sans)",
                letterSpacing: "0.03em",
                transition: "all 0.3s ease",
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {secondaryAction.label}
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              flex: secondaryAction ? 2 : 1,
              padding: "14px 20px",
              borderRadius: 30,
              background: "var(--color-primary-dim)",
              border: "none",
              color: "var(--text-main)",
              fontSize: 13,
              fontWeight: 600,
              cursor: submitting ? "default" : "pointer",
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.03em",
              transition: "all 0.3s ease",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Procesando..." : `✦ ${submitLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
