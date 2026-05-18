/**
 * POC: pantalla aislada que pide birth data y muestra el bodygraph
 * calculado por el backend. Accesible por URL `/bodygraph-poc`.
 *
 * No requiere autenticación. No persiste nada. El objetivo es validar
 * la UX del flow nuevo antes de integrarlo al onboarding real.
 */
import { useState } from "react";
import BodygraphView from "./BodygraphView";

interface ActivatedGate {
  number: number;
  line: number;
  planet: string;
  isPersonality: boolean;
  isRetrograde?: boolean;
  fixingState?: "exalted" | "detriment" | null;
  color?: number;
  tone?: number;
  base?: number;
}

interface Channel {
  id: string;
  name: string;
  nameEn?: string;
  circuit?: string;
}

interface HdVariable {
  orientation: "left" | "right";
  color: number;
  tone: number;
  base: number;
}

interface HumanDesignProfile {
  type: string;
  typeQualifier?: string;
  strategy: string;
  authority: string;
  profile: string;
  profileName?: string;
  definition: string;
  incarnationCross: string;
  themes?: { positive: string; notSelf: string };
  notSelfTheme: string;
  design?: { date: string };
  variables?: {
    digestion: HdVariable;
    awareness: HdVariable;
    environment: HdVariable;
    perspective: HdVariable;
  };
  variableLabels?: {
    brain: string;
    determination: string;
    determinationCategory: string;
    cognition: string;
    environment: string;
    environmentDetail: string;
    environmentStyle: string;
    personality: string;
    motivation: string;
    sense: string;
    trajectory: string;
    viewPerspective: string;
    view: string;
    transferredMotivation: string;
    transferredView: string;
  };
  channels: Channel[];
  activatedGates: ActivatedGate[];
  definedCenters: string[];
  undefinedCenters: string[];
}

interface UserProfileResponse {
  name: string;
  birthData?: {
    dateLocalIso: string;
    dateUtcIso: string;
    placeLabel?: string;
    ageYears: number;
  };
  humanDesign: HumanDesignProfile;
}

const TIMEZONE_OPTIONS = [
  { label: "UTC-12 (Baker Island)", value: -12 },
  { label: "UTC-10 (Hawaii)", value: -10 },
  { label: "UTC-8 (Los Angeles)", value: -8 },
  { label: "UTC-6 (México)", value: -6 },
  { label: "UTC-5 (NYC, Bogotá)", value: -5 },
  { label: "UTC-4 (Caracas, Halifax)", value: -4 },
  { label: "UTC-3 (Buenos Aires, São Paulo)", value: -3 },
  { label: "UTC+0 (Londres, Lisboa)", value: 0 },
  { label: "UTC+1 (Madrid, Berlín)", value: 1 },
  { label: "UTC+2 (Atenas, El Cairo)", value: 2 },
  { label: "UTC+3 (Moscú, Estambul)", value: 3 },
  { label: "UTC+5:30 (Nueva Delhi)", value: 5.5 },
  { label: "UTC+8 (Beijing, Singapur)", value: 8 },
  { label: "UTC+9 (Tokio)", value: 9 },
  { label: "UTC+10 (Sídney)", value: 10 },
];

export default function BodygraphPoc() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [tz, setTz] = useState<number>(-3);
  const [placeLabel, setPlaceLabel] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UserProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/bodygraph/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          time,
          timezoneOffsetHours: tz,
          name: name || undefined,
          placeLabel: placeLabel || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message || body.error || `Error ${res.status}`);
      } else {
        setResult(body.profile as UserProfileResponse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await fetch("/api/bodygraph/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/pdf" },
        body: JSON.stringify({
          date,
          time,
          timezoneOffsetHours: tz,
          name: name || undefined,
          placeLabel: placeLabel || undefined,
        }),
      });
      if (!res.ok) {
        let message = `Error ${res.status}`;
        try {
          const body = await res.json();
          message = body.message || body.error || message;
        } catch {
          // Body wasn't JSON — keep the generic message.
        }
        setPdfError(message);
        return;
      }
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? "bodygraph.pdf";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : String(err));
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "#222" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Calculadora de Bodygraph (POC)</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Ingresá tus datos de nacimiento y la app calcula tu Diseño Humano usando
        Swiss Ephemeris (la misma librería astronómica que MyHumanDesign y
        Genetic Matrix). Determinístico, sin AI, sin PDFs.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 14, color: "#555" }}>Nombre (opcional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 8, fontSize: 16, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 14, color: "#555" }}>Fecha de nacimiento</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={{ padding: 8, fontSize: 16, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 14, color: "#555" }}>Hora de nacimiento (local, formato 24h)</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            style={{ padding: 8, fontSize: 16, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 14, color: "#555" }}>Zona horaria del lugar de nacimiento</span>
          <select
            value={tz}
            onChange={(e) => setTz(Number(e.target.value))}
            style={{ padding: 8, fontSize: 16, border: "1px solid #ccc", borderRadius: 4 }}
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 14, color: "#555" }}>Lugar de nacimiento (opcional, solo para mostrar)</span>
          <input
            type="text"
            value={placeLabel}
            onChange={(e) => setPlaceLabel(e.target.value)}
            placeholder="Buenos Aires, Argentina"
            style={{ padding: 8, fontSize: 16, border: "1px solid #ccc", borderRadius: 4 }}
          />
        </label>

        <button
          type="submit"
          disabled={loading || !date || !time}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            background: loading ? "#aaa" : "#2a5",
            color: "white",
            border: 0,
            borderRadius: 4,
            cursor: loading ? "default" : "pointer",
            marginTop: 8,
          }}
        >
          {loading ? "Calculando..." : "Calcular bodygraph"}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 20, padding: 16, background: "#fee", border: "1px solid #f88", borderRadius: 4, color: "#900" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                background: "white",
                color: pdfLoading ? "#aaa" : "#2a5",
                border: `1px solid ${pdfLoading ? "#ccc" : "#2a5"}`,
                borderRadius: 4,
                cursor: pdfLoading ? "default" : "pointer",
                fontWeight: 500,
              }}
            >
              {pdfLoading ? "Generando PDF..." : "Descargar PDF"}
            </button>
          </div>
          {pdfError && (
            <div style={{ marginTop: 12, marginBottom: 12, padding: 12, background: "#fee", border: "1px solid #f88", borderRadius: 4, color: "#900", fontSize: 14 }}>
              <strong>Error al generar PDF:</strong> {pdfError}
            </div>
          )}
          <BodygraphView
            profile={result}
            birthQuery={{ date, time, tz }}
          />
        </div>
      )}
    </div>
  );
}
