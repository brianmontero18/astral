import { useState, useEffect } from "react";
import { fetchTransits } from "../api";
import type { TransitsResponse, PlanetTransit, UserProfile } from "../types";

// ─── Planetary glyphs ────────────────────────────────────────────────────────

const PLANET_GLYPHS: Record<string, string> = {
  Sol: "☉", Luna: "☽", Mercurio: "☿", Venus: "♀", Marte: "♂",
  "Júpiter": "♃", Saturno: "♄", Urano: "♅", Neptuno: "♆",
  "Plutón": "♇", "Quirón": "⚷", "Nodo Norte": "☊", "Nodo Sur": "☋",
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  profile: UserProfile;
}

export function TransitViewer({ profile }: Props) {
  const [data, setData] = useState<TransitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Set of user's activated gate numbers for quick lookup
  const userGates = new Set(
    profile.humanDesign.activatedGates?.map((g) => g.number) ?? []
  );

  useEffect(() => {
    fetchTransits()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 60, color: "var(--color-primary)", fontSize: 13 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid var(--color-primary-faint)",
            borderTopColor: "var(--color-primary)",
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
      <div style={{ margin: "40px auto", maxWidth: 600, padding: "24px", textAlign: "center" }} className="glass-panel">
        <div style={{ color: "#f0a0b0", fontSize: "14px", fontFamily: "var(--font-sans)" }}>
          Error cargando tránsitos: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 20px", overflowY: "auto", flex: 1, width: "100%", boxSizing: "border-box" as const }} className="animate-fade-in-slow">
      {/* Header */}
      <h2 style={{
        color: "var(--text-main)", fontSize: "22px", marginBottom: "6px",
        textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 400,
      }}>
        Tránsitos de la Semana
      </h2>
      <p style={{
        color: "var(--color-primary)", fontSize: "11px", textAlign: "center",
        marginBottom: "24px", letterSpacing: "0.12em", fontFamily: "var(--font-sans)", opacity: 0.8,
      }}>
        {data.weekRange}
      </p>

      {/* Planet grid — 2 columns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "12px",
        marginBottom: "24px",
      }}>
        {data.planets.map((p) => (
          <PlanetCard key={p.name} planet={p} touchesUser={userGates.has(p.hdGate)} />
        ))}
      </div>

      {/* Activated channels */}
      {data.activatedChannels.length > 0 && (
        <div className="glass-panel-gold" style={{ padding: "20px", marginBottom: "16px" }}>
          <div style={{
            color: "var(--color-primary)", fontSize: "10px", letterSpacing: "0.15em",
            marginBottom: "6px", fontWeight: 600, textAlign: "center",
          }}>
            CANALES ACTIVADOS POR TRÁNSITOS
          </div>
          <div style={{
            color: "var(--text-muted)", fontSize: "11px", textAlign: "center",
            marginBottom: "14px", fontFamily: "var(--font-sans)", fontWeight: 300,
          }}>
            Canales completados por las posiciones planetarias actuales
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
            {data.activatedChannels.map((ch) => (
              <span key={ch} style={{
                background: "var(--color-primary-faint)",
                border: "1px solid var(--glass-gold-border)",
                borderRadius: "20px", padding: "5px 14px",
                color: "var(--text-gold)", fontSize: "12px",
              }}>
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.activatedChannels.length === 0 && (
        <p style={{
          color: "var(--text-muted)", fontSize: "13px", textAlign: "center",
          fontStyle: "italic", fontFamily: "var(--font-serif)",
        }}>
          No hay canales completos activados por tránsitos esta semana.
        </p>
      )}

      <p style={{ color: "var(--text-faint)", fontSize: "10px", textAlign: "center", marginTop: "20px" }}>
        Última actualización: {new Date(data.fetchedAt).toLocaleString("es-AR")}
      </p>
    </div>
  );
}

// ─── Planet Card ──────────────────────────────────────────────────────────────

function PlanetCard({ planet, touchesUser }: { planet: PlanetTransit; touchesUser: boolean }) {
  const glyph = PLANET_GLYPHS[planet.name] ?? "•";

  return (
    <div
      className={touchesUser ? "glass-panel-gold" : "glass-panel"}
      style={{
        padding: "14px 16px",
        transition: "all 0.3s ease",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        borderColor: touchesUser ? "rgba(212,175,55,0.3)" : undefined,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = touchesUser
          ? "rgba(212,175,55,0.5)"
          : "var(--color-primary-dim)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = touchesUser
          ? "rgba(212,175,55,0.3)"
          : "var(--glass-border)";
      }}
    >
      {/* Glyph */}
      <div style={{
        fontSize: "24px",
        lineHeight: 1,
        color: touchesUser ? "var(--color-primary)" : "var(--color-accent)",
        flexShrink: 0,
        width: "28px",
        textAlign: "center",
        paddingTop: "2px",
      }}>
        {glyph}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ color: "var(--text-main)", fontSize: "13px", fontWeight: 500 }}>
            {planet.name}
          </span>
          {planet.isRetrograde && (
            <span style={{
              background: "rgba(232,184,75,0.15)",
              border: "1px solid rgba(232,184,75,0.3)",
              borderRadius: "8px", padding: "1px 7px",
              color: "#e8b84b", fontSize: "9px", fontWeight: 700, letterSpacing: "0.04em",
            }}>
              Rx
            </span>
          )}
        </div>
        <div style={{
          color: "var(--text-muted)", fontSize: "12px", marginBottom: "3px",
          fontFamily: "var(--font-serif)",
        }}>
          {planet.sign} {planet.degree}°
        </div>
        <div style={{
          color: touchesUser ? "var(--color-primary)" : "var(--color-accent)",
          fontSize: "10px", letterSpacing: "0.05em",
        }}>
          Puerta {planet.hdGate} · Línea {planet.hdLine}
        </div>
        {touchesUser && (
          <div style={{
            marginTop: "6px", fontSize: "9px", color: "var(--text-gold)",
            letterSpacing: "0.08em", fontWeight: 600,
          }}>
            ✦ ACTIVA TU PUERTA {planet.hdGate}
          </div>
        )}
      </div>
    </div>
  );
}
