import { useState, useEffect } from "react";
import { fetchTransits } from "../api";
import type { TransitsResponse, PlanetTransit } from "../types";

export function TransitViewer() {
  const [data, setData] = useState<TransitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransits()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 60, color: "#7c6fcd", fontSize: 13 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgba(124,111,205,0.3)",
            borderTopColor: "#7c6fcd",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px",
          }}
        />
        Cargando tránsitos...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        margin: "40px auto", maxWidth: 600, padding: 20,
        background: "rgba(201,107,122,0.12)",
        border: "1px solid rgba(201,107,122,0.35)",
        borderRadius: 12, color: "#f0a0b0", fontSize: 14, textAlign: "center",
      }}>
        Error cargando tránsitos: {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px", overflowY: "auto", flex: 1 }}>
      <h2 style={{ color: "#e8e0ff", fontSize: 20, marginBottom: 4, textAlign: "center", fontFamily: "Georgia, serif" }}>
        Tránsitos de la Semana
      </h2>
      <p style={{ color: "#7c6fcd", fontSize: 12, textAlign: "center", marginBottom: 24 }}>
        {data.weekRange}
      </p>

      {/* Planet grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
        {data.planets.map((p) => (
          <PlanetCard key={p.name} planet={p} />
        ))}
      </div>

      {/* Activated channels */}
      {data.activatedChannels.length > 0 && (
        <div style={{
          background: "rgba(107,186,138,0.08)",
          border: "1px solid rgba(107,186,138,0.3)",
          borderRadius: 14, padding: 18, marginBottom: 20,
        }}>
          <div style={{ color: "#6bba8a", fontSize: 11, letterSpacing: "0.1em", marginBottom: 10, fontWeight: 700 }}>
            CANALES ACTIVADOS POR TRÁNSITOS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {data.activatedChannels.map((ch) => (
              <span key={ch} style={{
                background: "rgba(107,186,138,0.15)",
                border: "1px solid rgba(107,186,138,0.3)",
                borderRadius: 20, padding: "5px 12px",
                color: "#a8dfc0", fontSize: 12,
              }}>
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.activatedChannels.length === 0 && (
        <p style={{ color: "#7c6fcd", fontSize: 12, textAlign: "center", fontStyle: "italic" }}>
          No hay canales completos activados por tránsitos esta semana.
        </p>
      )}

      <p style={{ color: "rgba(124,111,205,0.5)", fontSize: 10, textAlign: "center", marginTop: 20 }}>
        Calculado el {new Date(data.fetchedAt).toLocaleString("es-AR")}
      </p>
    </div>
  );
}

function PlanetCard({ planet }: { planet: PlanetTransit }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(124,111,205,0.25)",
        borderRadius: 12,
        padding: "12px 14px",
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: "#e8e0ff", fontSize: 13, fontWeight: 700 }}>{planet.name}</span>
        {planet.isRetrograde && (
          <span style={{
            background: "rgba(232,184,75,0.15)",
            border: "1px solid rgba(232,184,75,0.3)",
            borderRadius: 10, padding: "2px 8px",
            color: "#e8b84b", fontSize: 9, letterSpacing: "0.05em",
          }}>
            R
          </span>
        )}
      </div>
      <div style={{ color: "#c0b4f0", fontSize: 12, marginBottom: 4 }}>
        {planet.sign} {planet.degree}°
      </div>
      <div style={{ color: "#7c6fcd", fontSize: 11 }}>
        Puerta {planet.hdGate}.{planet.hdLine}
      </div>
    </div>
  );
}
