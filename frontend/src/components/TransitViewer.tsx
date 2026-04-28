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
      <div style={{ textAlign: "center", marginTop: 60, color: "var(--text-on-light-muted)", fontSize: 13 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "3px solid rgba(33, 41, 30, 0.12)",
            borderTopColor: "var(--color-gold-deep)",
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
        <div style={{ color: "#f3c2c2", fontSize: "14px", fontFamily: "var(--font-sans)" }}>
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
        color: "var(--text-on-light)", fontSize: "26px", marginBottom: "6px",
        textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 500,
      }}>
        Tránsitos de la Semana
      </h2>
      <p style={{
        color: "var(--color-gold-deep)", fontSize: "11px", textAlign: "center",
        marginBottom: "24px", letterSpacing: "0.16em", fontFamily: "var(--font-sans)", fontWeight: 600, textTransform: "uppercase",
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
            color: "var(--color-primary)", fontSize: "10px", letterSpacing: "0.18em",
            marginBottom: "6px", fontWeight: 700, textAlign: "center", textTransform: "uppercase",
          }}>
            Canales activados por tránsitos
          </div>
          <div style={{
            color: "var(--text-muted)", fontSize: "12px", textAlign: "center",
            marginBottom: "14px", fontFamily: "var(--font-sans)", fontWeight: 400,
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
                    background: "rgba(207, 172, 108, 0.08)",
                    border: "1px solid rgba(207, 172, 108, 0.22)",
                    borderRadius: "10px", padding: "10px 14px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--color-primary)", fontSize: "12px", fontWeight: 600 }}>{ch}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "10px", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</span>
                  </div>
                  {isExpanded && info && (
                    <div style={{
                      marginTop: "8px", paddingTop: "8px",
                      borderTop: "1px solid rgba(207, 172, 108, 0.18)",
                      color: "var(--text-muted)", fontSize: "12px",
                      lineHeight: 1.6, fontFamily: "var(--font-sans)",
                      animation: "fadeIn 0.3s ease",
                    }}>
                      <span style={{ color: "var(--color-primary)", fontSize: "9px", letterSpacing: "0.14em", fontFamily: "var(--font-sans)", fontWeight: 700 }}>
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
          color: "var(--text-on-light-muted)", fontSize: "13px", textAlign: "center",
          fontStyle: "italic", fontFamily: "var(--font-serif)",
        }}>
          No hay canales completos activados por tránsitos esta semana.
        </p>
      )}

      {/* ─── Impact sections (available when the session has a linked user) ─────────────────── */}

      {data.impact && data.impact.personalChannels.length > 0 && (
        <div className="glass-panel-gold" style={{
          padding: "20px", marginBottom: "16px",
          borderColor: "rgba(207, 172, 108, 0.42)",
        }}>
          <div style={{
            color: "var(--color-primary)", fontSize: "10px", letterSpacing: "0.18em",
            marginBottom: "6px", fontWeight: 700, textAlign: "center", textTransform: "uppercase",
          }}>
            Canales personales activados
          </div>
          <div style={{
            color: "var(--text-muted)", fontSize: "12px", textAlign: "center",
            marginBottom: "14px", fontFamily: "var(--font-sans)", fontWeight: 400,
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
        }}>
          <div style={{
            color: "var(--color-accent)", fontSize: "10px", letterSpacing: "0.18em",
            marginBottom: "6px", fontWeight: 700, textAlign: "center", textTransform: "uppercase",
          }}>
            Centros condicionados
          </div>
          <div style={{
            color: "var(--text-muted)", fontSize: "12px", textAlign: "center",
            marginBottom: "14px", fontFamily: "var(--font-sans)", fontWeight: 400,
          }}>
            Tránsitos activando tus centros indefinidos
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.impact.conditionedCenters.map((cc) => (
              <div key={cc.center} style={{
                background: "rgba(248, 244, 232, 0.04)",
                border: "1px solid rgba(248, 244, 232, 0.1)",
                borderRadius: "10px", padding: "10px 14px",
              }}>
                <div style={{
                  color: "var(--text-main)", fontSize: "12px", fontWeight: 600, marginBottom: "4px",
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
            color: "var(--text-muted)", fontSize: "10px", letterSpacing: "0.18em",
            marginBottom: "6px", fontWeight: 700, textAlign: "center", textTransform: "uppercase",
          }}>
            Puertas reforzadas
          </div>
          <div style={{
            color: "var(--text-muted)", fontSize: "12px", textAlign: "center",
            marginBottom: "14px", fontFamily: "var(--font-sans)", fontWeight: 400,
          }}>
            Tránsitos que tocan puertas que ya tenés
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
            {data.impact.reinforcedGates.map((rg) => (
              <span key={`${rg.gate}-${rg.planet}`} style={{
                background: "rgba(248, 244, 232, 0.06)",
                border: "1px solid rgba(248, 244, 232, 0.12)",
                borderRadius: "20px", padding: "5px 14px",
                color: "var(--text-muted)", fontSize: "11px",
              }}>
                Puerta {rg.gate} — {rg.planet}
              </span>
            ))}
          </div>
        </div>
      )}

      <p style={{ color: "var(--text-on-light-faint)", fontSize: "10px", textAlign: "center", marginTop: "20px" }}>
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
        borderColor: touchesUser ? "rgba(207, 172, 108, 0.42)" : undefined,
        cursor: "pointer",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = touchesUser
          ? "rgba(207, 172, 108, 0.7)"
          : "rgba(248, 244, 232, 0.22)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = touchesUser
          ? "rgba(207, 172, 108, 0.42)"
          : "var(--glass-border)";
      }}
    >
      {/* Glyph */}
      <div style={{
        fontSize: "22px",
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
          <span style={{ color: "var(--text-main)", fontSize: "13px", fontWeight: 600 }}>
            {planet.name}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {planet.isRetrograde && (
              <span style={{
                background: "rgba(207, 172, 108, 0.18)",
                border: "1px solid rgba(207, 172, 108, 0.42)",
                borderRadius: "8px", padding: "1px 7px",
                color: "var(--color-primary)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.04em",
              }}>
                Rx
              </span>
            )}
            <span style={{ color: "var(--text-muted)", fontSize: "10px", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
          </div>
        </div>
        <div style={{
          color: "var(--text-muted)", fontSize: "12px", marginBottom: "3px",
          fontFamily: "var(--font-sans)",
        }}>
          {planet.sign} {planet.degree}°
        </div>
        <div style={{
          color: touchesUser ? "var(--color-primary)" : "var(--text-muted)",
          fontSize: "10px", letterSpacing: "0.05em", fontWeight: touchesUser ? 600 : 400,
        }}>
          Puerta {planet.hdGate} · Línea {planet.hdLine}
        </div>
        {touchesUser && (
          <div style={{
            marginTop: "6px", fontSize: "9px", color: "var(--color-primary)",
            letterSpacing: "0.14em", fontWeight: 700, textTransform: "uppercase",
          }}>
            Activa tu Puerta {planet.hdGate}
          </div>
        )}
        {expanded && gateTheme && (
          <div style={{
            marginTop: "8px", paddingTop: "8px",
            borderTop: `1px solid ${touchesUser ? "rgba(207, 172, 108, 0.22)" : "rgba(248, 244, 232, 0.1)"}`,
            animation: "fadeIn 0.3s ease",
          }}>
            <div style={{
              color: touchesUser ? "var(--color-primary)" : "var(--text-main)",
              fontSize: "12px", fontWeight: 600, marginBottom: "4px",
              fontFamily: "var(--font-serif)",
            }}>
              {gateTheme.name}
            </div>
            <div style={{
              color: "var(--text-muted)", fontSize: "11px",
              lineHeight: 1.6, fontFamily: "var(--font-serif)",
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
        background: "rgba(207, 172, 108, 0.08)",
        border: "1px solid rgba(207, 172, 108, 0.22)",
        borderRadius: "10px", padding: "10px 14px",
        cursor: "pointer",
        transition: "all 0.3s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{
            color: "var(--color-primary)", fontSize: "12px", fontWeight: 600, marginBottom: "4px",
          }}>
            {channel.channelName} ({channel.channelId})
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
            Tu Puerta {channel.userGate} + {channel.transitPlanet} en Puerta {channel.transitGate}
          </div>
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: "10px", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
      </div>
      {expanded && info && (
        <div style={{
          marginTop: "8px", paddingTop: "8px",
          borderTop: "1px solid rgba(207, 172, 108, 0.18)",
          animation: "fadeIn 0.3s ease",
        }}>
          <span style={{ color: "var(--color-primary)", fontSize: "9px", letterSpacing: "0.14em", fontFamily: "var(--font-sans)", fontWeight: 700 }}>
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
