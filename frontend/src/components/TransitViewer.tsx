import { useState, useEffect } from "react";
import { fetchTransits } from "../api";
import { CENTER_DISPLAY } from "../utils";
import { getGateTheme, getChannelInfo, getChannelInfoByName } from "../hd-data";
import { getTransitFailureMessage } from "../transit-errors";
import type { TransitsResponse, PlanetTransit, PersonalChannel, UserProfile } from "../types";

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
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Set of user's activated gate numbers for quick lookup
  const userGates = new Set(
    profile.humanDesign.activatedGates?.map((g) => g.number) ?? []
  );

  const toggleExpand = (id: string) =>
    setExpandedCard((prev) => (prev === id ? null : id));

  useEffect(() => {
    fetchTransits()
      .then(setData)
      .catch((e) => setError(getTransitFailureMessage(e)))
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
          {error}
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
          <PlanetCard
            key={p.name}
            planet={p}
            touchesUser={userGates.has(p.hdGate)}
            expanded={expandedCard === `planet-${p.name}`}
            onToggle={() => toggleExpand(`planet-${p.name}`)}
          />
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
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.activatedChannels.map((ch) => {
              const info = getChannelInfoByName(ch);
              const isExpanded = expandedCard === `channel-${ch}`;
              return (
                <div
                  key={ch}
                  onClick={() => toggleExpand(`channel-${ch}`)}
                  style={{
                    background: "rgba(212,175,55,0.06)",
                    border: "1px solid rgba(212,175,55,0.15)",
                    borderRadius: "10px", padding: "10px 14px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-gold)", fontSize: "12px" }}>{ch}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "10px", opacity: 0.5, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</span>
                  </div>
                  {isExpanded && info && (
                    <div style={{
                      marginTop: "8px", paddingTop: "8px",
                      borderTop: "1px solid rgba(212,175,55,0.1)",
                      color: "var(--text-muted)", fontSize: "12px",
                      lineHeight: 1.6, fontFamily: "var(--font-serif)",
                      animation: "fadeIn 0.3s ease",
                    }}>
                      <span style={{ color: "var(--color-primary)", fontSize: "9px", letterSpacing: "0.1em", fontFamily: "var(--font-sans)" }}>
                        {info.circuit.toUpperCase()}
                      </span>
                      <div style={{ marginTop: "4px" }}>{info.description}</div>
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* ─── Impact sections (available when the session has a linked user) ─────────────────── */}

      {data.impact && data.impact.personalChannels.length > 0 && (
        <div className="glass-panel-gold" style={{
          padding: "20px", marginBottom: "16px",
          borderColor: "rgba(212,175,55,0.35)",
        }}>
          <div style={{
            color: "var(--color-primary)", fontSize: "10px", letterSpacing: "0.15em",
            marginBottom: "6px", fontWeight: 600, textAlign: "center",
          }}>
            CANALES PERSONALES ACTIVADOS
          </div>
          <div style={{
            color: "var(--text-muted)", fontSize: "11px", textAlign: "center",
            marginBottom: "14px", fontFamily: "var(--font-sans)", fontWeight: 300,
          }}>
            Un tránsito completa un canal de tu diseño
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.impact.personalChannels.map((ch) => (
              <PersonalChannelCard
                key={`${ch.channelId}-${ch.transitPlanet}`}
                channel={ch}
                expanded={expandedCard === `personal-${ch.channelId}`}
                onToggle={() => toggleExpand(`personal-${ch.channelId}`)}
              />
            ))}
          </div>
        </div>
      )}

      {data.impact && data.impact.conditionedCenters.length > 0 && (
        <div className="glass-panel" style={{
          padding: "20px", marginBottom: "16px",
          borderColor: "rgba(157,139,223,0.35)",
        }}>
          <div style={{
            color: "#9d8bdf", fontSize: "10px", letterSpacing: "0.15em",
            marginBottom: "6px", fontWeight: 600, textAlign: "center",
          }}>
            CENTROS CONDICIONADOS
          </div>
          <div style={{
            color: "var(--text-muted)", fontSize: "11px", textAlign: "center",
            marginBottom: "14px", fontFamily: "var(--font-sans)", fontWeight: 300,
          }}>
            Tránsitos activando tus centros indefinidos
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.impact.conditionedCenters.map((cc) => (
              <div key={cc.center} style={{
                background: "rgba(157,139,223,0.06)",
                border: "1px solid rgba(157,139,223,0.15)",
                borderRadius: "10px", padding: "10px 14px",
              }}>
                <div style={{
                  color: "#b8aee8", fontSize: "12px", fontWeight: 500, marginBottom: "4px",
                }}>
                  {CENTER_DISPLAY[cc.center] ?? cc.center}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  {cc.gates.map((g) => `${g.planet} en Puerta ${g.gate}`).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.impact && data.impact.reinforcedGates.length > 0 && (
        <div className="glass-panel" style={{
          padding: "20px", marginBottom: "16px",
        }}>
          <div style={{
            color: "var(--text-muted)", fontSize: "10px", letterSpacing: "0.15em",
            marginBottom: "6px", fontWeight: 600, textAlign: "center",
          }}>
            PUERTAS REFORZADAS
          </div>
          <div style={{
            color: "var(--text-muted)", fontSize: "11px", textAlign: "center",
            marginBottom: "14px", fontFamily: "var(--font-sans)", fontWeight: 300,
          }}>
            Tránsitos que tocan puertas que ya tenés
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
            {data.impact.reinforcedGates.map((rg) => (
              <span key={`${rg.gate}-${rg.planet}`} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "20px", padding: "5px 14px",
                color: "var(--text-muted)", fontSize: "11px",
              }}>
                Puerta {rg.gate} — {rg.planet}
              </span>
            ))}
          </div>
        </div>
      )}

      <p style={{ color: "var(--text-faint)", fontSize: "10px", textAlign: "center", marginTop: "20px" }}>
        Última actualización: {new Date(data.fetchedAt).toLocaleString("es-AR")}
      </p>
    </div>
  );
}

// ─── Planet Card ──────────────────────────────────────────────────────────────

function PlanetCard({ planet, touchesUser, expanded, onToggle }: {
  planet: PlanetTransit;
  touchesUser: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const glyph = PLANET_GLYPHS[planet.name] ?? "•";
  const gateTheme = getGateTheme(planet.hdGate);

  return (
    <div
      className={touchesUser ? "glass-panel-gold" : "glass-panel"}
      onClick={onToggle}
      style={{
        padding: "14px 16px",
        transition: "all 0.3s ease",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        borderColor: touchesUser ? "rgba(212,175,55,0.3)" : undefined,
        cursor: "pointer",
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
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
            <span style={{ color: "var(--text-muted)", fontSize: "10px", opacity: 0.4, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
          </div>
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
        {expanded && gateTheme && (
          <div style={{
            marginTop: "8px", paddingTop: "8px",
            borderTop: `1px solid ${touchesUser ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.06)"}`,
            animation: "fadeIn 0.3s ease",
          }}>
            <div style={{
              color: touchesUser ? "var(--color-primary)" : "var(--color-accent)",
              fontSize: "11px", fontWeight: 500, marginBottom: "4px",
              fontFamily: "var(--font-serif)",
            }}>
              {gateTheme.name}
            </div>
            <div style={{
              color: "var(--text-muted)", fontSize: "11px",
              lineHeight: 1.5, fontFamily: "var(--font-serif)",
            }}>
              {gateTheme.theme}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Personal Channel Card ───────────────────────────────────────────────────

function PersonalChannelCard({ channel, expanded, onToggle }: {
  channel: PersonalChannel;
  expanded: boolean;
  onToggle: () => void;
}) {
  const info = getChannelInfo(channel.channelId);

  return (
    <div
      onClick={onToggle}
      style={{
        background: "rgba(212,175,55,0.06)",
        border: "1px solid rgba(212,175,55,0.15)",
        borderRadius: "10px", padding: "10px 14px",
        cursor: "pointer",
        transition: "all 0.3s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{
            color: "var(--text-gold)", fontSize: "12px", fontWeight: 500, marginBottom: "4px",
          }}>
            {channel.channelName} ({channel.channelId})
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
            Tu Puerta {channel.userGate} + {channel.transitPlanet} en Puerta {channel.transitGate}
          </div>
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: "10px", opacity: 0.5, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
      </div>
      {expanded && info && (
        <div style={{
          marginTop: "8px", paddingTop: "8px",
          borderTop: "1px solid rgba(212,175,55,0.1)",
          animation: "fadeIn 0.3s ease",
        }}>
          <span style={{ color: "var(--color-primary)", fontSize: "9px", letterSpacing: "0.1em", fontFamily: "var(--font-sans)" }}>
            {info.circuit.toUpperCase()}
          </span>
          <div style={{
            marginTop: "4px", color: "var(--text-muted)", fontSize: "12px",
            lineHeight: 1.6, fontFamily: "var(--font-serif)",
          }}>
            {info.description}
          </div>
        </div>
      )}
    </div>
  );
}
