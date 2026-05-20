/**
 * MyChartReplaceView — pantalla "Reemplazar carta".
 *
 * Toggle de dos caminos:
 * - Datos de nacimiento (path principal, recomendado).
 * - PDF de Genetic Matrix / Jovian Archive (secundario, advanced).
 *
 * En esta versión solo hay una carta activa por usuario, así que ambos
 * caminos REEMPLAZAN la actual. El upload PDF reusa el flow existente
 * (replaceBodygraph → /api/me/bodygraph). El de datos reusa el endpoint
 * autenticado /api/me/bodygraph/from-birth.
 */
import { useEffect, useRef, useState } from "react";
import type { LocalUser, UserProfile } from "../types";
import {
  PlacesTimeoutError,
  replaceBodygraph,
  searchPlaces,
  submitBodygraphFromBirth,
  type PlaceResult,
  type ReplaceBodygraphResponse,
} from "../api";
import { getAssetFailureMessage } from "../asset-errors";

interface Props {
  onCancel: () => void;
  onBodygraphReplaced: (result: ReplaceBodygraphResponse) => void;
  onProfileUpdated: (user: LocalUser, profile: UserProfile) => void;
}

type Mode = "data" | "pdf";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function formatPlaceLabel(p: PlaceResult): string {
  const parts = [p.name, p.admin1, p.country].filter((s) => s && s.length > 0);
  if (parts.length >= 2 && parts[1] === parts[0]) parts.splice(1, 1);
  return parts.join(", ");
}

export function MyChartReplaceView({ onCancel, onBodygraphReplaced, onProfileUpdated }: Props) {
  const [mode, setMode] = useState<Mode>("data");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Birth data state
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeSlow, setPlaceSlow] = useState(false);
  const [placeTimedOut, setPlaceTimedOut] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const placeBoxRef = useRef<HTMLDivElement>(null);

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Places autocomplete: debounce 250ms + slow signal a los 2.5s + timeout 30s.
  useEffect(() => {
    if (selectedPlace && placeQuery === formatPlaceLabel(selectedPlace)) return;
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaceResults([]);
      setPlaceTimedOut(false);
      setPlaceSlow(false);
      return;
    }
    const callerCtrl = new AbortController();
    let cancelled = false;
    let slowTimer: number | undefined;
    const debounceTimer = window.setTimeout(async () => {
      setPlaceLoading(true);
      setPlaceTimedOut(false);
      setPlaceSlow(false);
      slowTimer = window.setTimeout(() => {
        if (!cancelled) setPlaceSlow(true);
      }, 2500);
      try {
        const results = await searchPlaces(q, { signal: callerCtrl.signal });
        if (!cancelled) {
          setPlaceResults(results);
          setPlaceOpen(true);
          setPlaceError(null);
          setPlaceTimedOut(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof PlacesTimeoutError) {
          setPlaceTimedOut(true);
          setPlaceError(null);
        } else if (!(err instanceof DOMException && err.name === "AbortError")) {
          setPlaceError(err instanceof Error ? err.message : String(err));
        }
        setPlaceResults([]);
      } finally {
        if (!cancelled) {
          setPlaceLoading(false);
          setPlaceSlow(false);
        }
        if (slowTimer !== undefined) window.clearTimeout(slowTimer);
      }
    }, 250);
    return () => {
      cancelled = true;
      callerCtrl.abort();
      window.clearTimeout(debounceTimer);
      if (slowTimer !== undefined) window.clearTimeout(slowTimer);
    };
  }, [placeQuery, selectedPlace]);

  // Click outside cierra el dropdown.
  useEffect(() => {
    if (!placeOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!placeBoxRef.current) return;
      if (!placeBoxRef.current.contains(ev.target as Node)) {
        setPlaceOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [placeOpen]);

  const handlePlacePick = (p: PlaceResult) => {
    setSelectedPlace(p);
    setPlaceQuery(formatPlaceLabel(p));
    setPlaceResults([]);
    setPlaceOpen(false);
    setPlaceError(null);
  };

  const handlePlaceInputChange = (value: string) => {
    setPlaceQuery(value);
    if (selectedPlace && value !== formatPlaceLabel(selectedPlace)) {
      setSelectedPlace(null);
    }
    setError(null);
  };

  const handleSubmitData = async () => {
    if (!DATE_RE.test(birthDate)) {
      setError("Ingresá una fecha válida (formato YYYY-MM-DD).");
      return;
    }
    if (!TIME_RE.test(birthTime)) {
      setError("Ingresá una hora válida (formato HH:mm 24h).");
      return;
    }
    if (!selectedPlace) {
      setError("Elegí un lugar de la lista para que podamos resolver tu zona horaria.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { user, profile } = await submitBodygraphFromBirth({
        date: birthDate,
        time: birthTime,
        place: {
          lat: selectedPlace.lat,
          lon: selectedPlace.lon,
          label: formatPlaceLabel(selectedPlace),
        },
      });
      onProfileUpdated(
        { id: user.id, name: user.name, plan: user.plan, role: user.role, status: user.status },
        profile,
      );
    } catch (err) {
      setError(getAssetFailureMessage(err, "No pudimos calcular tu carta ahora."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPdf = async () => {
    if (!pdfFile) {
      setError("Subí un PDF para reemplazar tu carta.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await replaceBodygraph(pdfFile);
      onBodygraphReplaced(result);
    } catch (err) {
      setError(getAssetFailureMessage(err, "No pudimos sincronizar el archivo."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (file: File | null) => {
    setError(null);
    setPdfFile(file);
  };

  if (submitting) {
    return (
      <div className="mychart-replace-shell">
        <div className="mychart-replace-card mychart-replace-loading">
          <div className="mychart-spinner" aria-hidden="true" />
          <h2 className="mychart-replace-loading-title">
            {mode === "data" ? "Calculando tu carta…" : "Leyendo tu carta…"}
          </h2>
          <p className="mychart-replace-loading-body">
            {mode === "data"
              ? "Sincronizando coordenadas astronómicas con tu Diseño Humano."
              : "Nuestro motor está extrayendo tu Diseño Humano."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mychart-replace-shell">
      <button
        type="button"
        className="astral-auth-text-link mychart-replace-back"
        onClick={onCancel}
      >
        ← Volver a mi carta
      </button>

      <div className="mychart-replace-card">
        <div className="mychart-replace-kicker">REEMPLAZAR CARTA</div>
        <h2 className="mychart-replace-title">¿Cómo querés cargar tu Diseño Humano?</h2>
        <p className="mychart-replace-sub">
          Vas a reemplazar tu carta activa. Elegí el método que prefieras.
        </p>

        <div className="mychart-replace-toggle" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "data"}
            className={"mychart-replace-pill" + (mode === "data" ? " is-active" : "")}
            onClick={() => { setMode("data"); setError(null); }}
          >
            Datos de nacimiento
          </button>
          <button
            role="tab"
            aria-selected={mode === "pdf"}
            className={"mychart-replace-pill" + (mode === "pdf" ? " is-active" : "")}
            onClick={() => { setMode("pdf"); setError(null); }}
          >
            PDF
          </button>
        </div>

        {error && (
          <div className="onboarding-inline-error" style={{ marginBottom: 20 }}>{error}</div>
        )}

        {mode === "data" && (
          <div className="mychart-replace-fields">
            <BirthField label="Fecha de nacimiento">
              <input
                type="date"
                value={birthDate}
                onChange={(e) => { setBirthDate(e.target.value); setError(null); }}
                className="onboarding-birth-input"
                max={new Date().toISOString().slice(0, 10)}
              />
            </BirthField>

            <BirthField label="Hora local">
              <input
                type="time"
                value={birthTime}
                onChange={(e) => { setBirthTime(e.target.value); setError(null); }}
                className="onboarding-birth-input"
              />
            </BirthField>

            <BirthField label="Lugar de nacimiento">
              <div ref={placeBoxRef} style={{ position: "relative" }}>
                <input
                  type="text"
                  value={placeQuery}
                  onChange={(e) => handlePlaceInputChange(e.target.value)}
                  onFocus={() => { if (placeResults.length > 0) setPlaceOpen(true); }}
                  placeholder="Empezá a escribir (ej. Buenos Aires, Bogotá...)"
                  className="onboarding-birth-input"
                  autoComplete="off"
                  spellCheck={false}
                />
                {placeLoading && !placeSlow && (
                  <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-sans)" }}>
                    buscando…
                  </div>
                )}
                {placeLoading && placeSlow && (
                  <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-sans)" }}>
                    Está tardando más de lo normal… seguimos buscando.
                  </div>
                )}
                {placeTimedOut && (
                  <div className="onboarding-inline-error" style={{ marginTop: 8, fontSize: 13 }}>
                    La búsqueda tardó demasiado. Probá de nuevo en un momento.
                  </div>
                )}
                {placeOpen && placeResults.length > 0 && (
                  <ul role="listbox" className="mychart-place-listbox">
                    {placeResults.map((p) => (
                      <li key={p.geonameId}>
                        <button
                          type="button"
                          className="mychart-place-option"
                          onClick={() => handlePlacePick(p)}
                        >
                          <span className="mychart-place-option-name">{p.name}</span>
                          <span className="mychart-place-option-sub">
                            {[p.admin1, p.country].filter(Boolean).join(", ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {placeError && (
                  <div className="onboarding-inline-error" style={{ marginTop: 8, fontSize: 13 }}>
                    No pudimos buscar lugares ahora. Intentá de nuevo en un momento.
                  </div>
                )}
                {!placeError && !placeLoading && !selectedPlace && placeQuery.trim().length >= 2 && placeResults.length === 0 && (
                  <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-sans)" }}>
                    No encontramos ese lugar. Probá con otro nombre o ortografía.
                  </div>
                )}
              </div>
            </BirthField>

            <button
              type="button"
              className="astral-auth-primary"
              onClick={handleSubmitData}
              style={{ width: "100%", marginTop: 12 }}
            >
              Calcular y guardar
            </button>
          </div>
        )}

        {mode === "pdf" && (
          <div className="mychart-replace-fields">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault(); setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                if (file.type !== "application/pdf") {
                  setError("Solo aceptamos PDF.");
                  return;
                }
                handleFileChange(file);
              }}
              role="button"
              tabIndex={0}
              aria-label={pdfFile ? `Archivo seleccionado: ${pdfFile.name}` : "Subí tu PDF"}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); }
              }}
              className={"onboarding-dropzone" + (pdfFile ? " has-file" : "") + (isDragging ? " is-dragging" : "")}
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <div className="onboarding-dropzone-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4" />
                  <path d="M6 10l6-6 6 6" />
                  <path d="M4 20h16" />
                </svg>
              </div>
              <div className="onboarding-dropzone-label">Tu carta en PDF</div>
              <div className="onboarding-dropzone-hint">
                {pdfFile ? pdfFile.name : isDragging ? "Soltá tu archivo aquí" : "Arrastrá tu PDF o hacé clic para elegirlo"}
              </div>
            </div>
            <div className="mychart-replace-disclaimer">
              ⓘ Solo aceptamos PDFs de Genetic Matrix o Jovian Archive. Hasta 10 MB.
            </div>
            <button
              type="button"
              className="astral-auth-primary"
              onClick={handleSubmitPdf}
              style={{ width: "100%", marginTop: 12 }}
            >
              Subir y canalizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BirthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          color: "var(--text-muted)",
          fontFamily: "var(--font-sans)",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
