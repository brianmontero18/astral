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

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}

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
      <div className="intake-mic-button is-transcribing" aria-label="Transcribiendo audio">
        <span className="intake-mic-spinner" />
      </div>
    );
  }

  return (
    <div className="intake-mic-cluster">
      <button
        type="button"
        onClick={handleClick}
        title={isRecording ? "Detener grabación" : "Grabar con voz"}
        aria-label={isRecording ? "Detener grabación" : "Grabar con voz"}
        className={"intake-mic-button" + (isRecording ? " is-recording" : "")}
      >
        {isRecording ? <StopIcon /> : <MicIcon />}
      </button>
      {isRecording && (
        <button
          type="button"
          onClick={cancelRecording}
          title="Cancelar grabación"
          aria-label="Cancelar grabación"
          className="intake-mic-cancel"
        >
          <CancelIcon />
        </button>
      )}
      {error && <span className="intake-mic-error">{error}</span>}
    </div>
  );
}

const DEFAULT_DESCRIPTION =
  "Completá los campos clave para que tu agente arranque con contexto real. Los dos primeros son obligatorios.";

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
    <div className="intake-stage">
      <div className="intake-card">
        <div className="intake-kicker">Tu negocio</div>
        <h2 className="intake-title">Contame de tu negocio</h2>
        <p className="intake-description">{description}</p>

        <div className="intake-fields">
          {FIELDS.map((field) => (
            <div key={field.key} className="intake-field">
              <div className="intake-field-header">
                <label htmlFor={`intake-${field.key}`} className="intake-field-label">
                  {field.label}
                  {field.kind === "textarea" && field.required && (
                    <span className="intake-field-required" aria-hidden="true">*</span>
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
                  className="intake-textarea"
                />
              ) : (
                <div className="intake-select-wrapper">
                  <select
                    id={`intake-${field.key}`}
                    value={values[field.key] ?? ""}
                    onChange={(e) => handleSelectChange(field.key, e.target.value)}
                    className="intake-select"
                  >
                    <option value="">Sin elegir</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="intake-select-chevron" aria-hidden="true">▾</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {showRequiredHint && (
          <div className="onboarding-inline-error" role="alert">
            Necesitamos al menos los dos campos marcados con * para arrancar con contexto real.
          </div>
        )}

        <div className="intake-actions">
          {secondaryAction && (
            <button
              type="button"
              onClick={() => {
                if (!submitting) secondaryAction.onClick();
              }}
              disabled={submitting}
              className="astral-auth-secondary"
              style={{ flex: 1 }}
            >
              {secondaryAction.label}
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="astral-auth-primary"
            style={{ flex: secondaryAction ? 2 : 1 }}
          >
            {submitting ? "Procesando..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
