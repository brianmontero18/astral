import { useEffect, useId, useRef, useState } from "react";
import {
  getActiveChartNameError,
  normalizeActiveChartName,
} from "../active-chart-name";

interface Props {
  value: string;
  variant: "heading" | "panel";
  onSave: (name: string) => Promise<void>;
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function ActiveChartNameEditor({ value, variant, onSave }: Props) {
  const errorId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayName = normalizeActiveChartName(value) || "Mi carta";
  const normalizedDraft = normalizeActiveChartName(draft);
  const validationError = getActiveChartNameError(draft);
  const unchanged = normalizedDraft === displayName;

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(displayName);
    setError(null);
    setSaved(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(value);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    const nextError = getActiveChartNameError(draft);
    if (nextError) {
      setError(nextError);
      return;
    }
    if (unchanged) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(normalizedDraft);
      setSaved(true);
      setEditing(false);
    } catch {
      setError("No pudimos guardar el nombre. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className={`active-chart-name active-chart-name--${variant}`}>
        <div className="active-chart-name-display">
          {variant === "heading" ? (
            <h2 className="mychart-name">{displayName}</h2>
          ) : (
            <span className="active-chart-name-value">{displayName}</span>
          )}
          <button
            type="button"
            className="active-chart-name-edit-button"
            aria-label="Editar nombre de esta carta"
            title="Editar nombre de esta carta"
            onClick={startEditing}
          >
            <PencilIcon />
          </button>
        </div>
        {saved && (
          <div className="active-chart-name-status" role="status">
            Nombre actualizado.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`active-chart-name-editor active-chart-name-editor--${variant}`}>
      <label className="active-chart-name-field">
        <span className="active-chart-name-label">Nombre de esta carta</span>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          disabled={saving}
          className="active-chart-name-input"
          aria-invalid={Boolean(error || validationError)}
          aria-describedby={(error || validationError) ? errorId : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancelEditing();
            }
          }}
        />
      </label>
      {(error || validationError) && (
        <div id={errorId} className="active-chart-name-error" role="alert">
          {error ?? validationError}
        </div>
      )}
      <div className="active-chart-name-actions">
        <button
          type="button"
          className="astral-auth-secondary active-chart-name-action"
          disabled={saving}
          onClick={cancelEditing}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="astral-auth-primary active-chart-name-action"
          disabled={saving || Boolean(validationError) || unchanged}
          onClick={() => void save()}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
