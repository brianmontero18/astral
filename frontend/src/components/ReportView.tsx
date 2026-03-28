import { useState } from "react";
import type { DesignReport, ReportSection } from "../types";

interface Props {
  report: DesignReport | null;
  loading: boolean;
  onBack: () => void;
}

const WHATSAPP_URL = "https://wa.me/584121234567?text=Quiero%20desbloquear%20mi%20informe%20premium";

function SectionCard({ section, locked }: { section: ReportSection; locked: boolean }) {
  const [expanded, setExpanded] = useState(!locked);

  if (locked) {
    return (
      <div style={{
        background: "rgba(124,111,205,0.04)", border: "1px solid rgba(124,111,205,0.15)",
        borderRadius: 14, padding: "18px 20px", marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.5 }}>
          <span style={{ fontSize: 18 }}>{section.icon}</span>
          <span style={{
            fontFamily: "var(--font-serif)", color: "var(--text-main)",
            fontSize: 16, fontWeight: 400,
          }}>
            {section.title}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 14 }}>🔒</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(124,111,205,0.06)", border: "1px solid rgba(124,111,205,0.2)",
      borderRadius: 14, padding: "18px 20px", marginBottom: 14,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none", border: "none", cursor: "pointer", width: "100%",
          display: "flex", alignItems: "center", gap: 10, padding: 0, textAlign: "left",
        }}
      >
        <span style={{ fontSize: 18 }}>{section.icon}</span>
        <span style={{
          fontFamily: "var(--font-serif)", color: "var(--text-main)",
          fontSize: 16, fontWeight: 400, flex: 1,
        }}>
          {section.title}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 12, transition: "transform 0.2s" }}>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div style={{
          marginTop: 14, color: "var(--text-main)", fontSize: 13,
          lineHeight: 1.8, fontWeight: 300, whiteSpace: "pre-line",
        }}>
          {section.staticContent && <div>{section.staticContent}</div>}
          {section.llmContent && (
            <div style={{ marginTop: section.staticContent ? 14 : 0, color: "#d4cef0" }}>
              {section.llmContent}
            </div>
          )}
          {section.teaser && (
            <div style={{
              marginTop: 14, padding: "12px 16px", borderRadius: 10,
              background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)",
              fontSize: 12, color: "var(--text-gold)", fontStyle: "italic",
            }}>
              Continuá leyendo en el informe completo...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ReportView({ report, loading, onBack }: Props) {
  if (loading) {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 16,
      }}>
        <div style={{
          width: 32, height: 32,
          border: "2px solid var(--color-primary-dim)",
          borderTopColor: "var(--color-primary)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }} />
        <span style={{
          color: "var(--text-muted)", fontSize: 14, fontWeight: 300,
          fontFamily: "var(--font-sans)",
        }}>
          Generando tu informe...
        </span>
        <span style={{
          color: "var(--text-muted)", fontSize: 11, fontWeight: 300, opacity: 0.6,
        }}>
          Esto puede tomar unos segundos
        </span>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 12,
      }}>
        <span style={{ color: "#f0a0b0", fontSize: 14, fontWeight: 300 }}>
          No se pudo generar el informe. Intentá de nuevo.
        </span>
        <button
          onClick={onBack}
          style={{
            background: "var(--color-primary-dim)", border: "none",
            color: "var(--text-main)", padding: "10px 24px", borderRadius: 30,
            cursor: "pointer", fontSize: 13, fontWeight: 500,
          }}
        >
          Volver
        </button>
      </div>
    );
  }

  const freeSections = report.sections.filter((s) => s.tier === "free");
  const premiumSections = report.sections.filter((s) => s.tier === "premium");

  return (
    <div style={{
      flex: 1, overflowY: "auto", padding: "24px 16px",
    }}>
      <div style={{ maxWidth: 760, width: "100%", margin: "0 auto" }}>
        <div style={{
          color: "var(--color-primary)", fontSize: 10, letterSpacing: "0.2em",
          fontWeight: 600, marginBottom: 8, fontFamily: "var(--font-sans)",
        }}>
          ✦ TU INFORME DE DISEÑO HUMANO
        </div>
        <h1 style={{
          fontFamily: "var(--font-serif)", color: "var(--text-main)",
          fontSize: 28, fontWeight: 400, margin: "0 0 24px",
        }}>
          Informe Personal
        </h1>

        {freeSections.map((section) => (
          <SectionCard key={section.id} section={section} locked={false} />
        ))}

        {premiumSections.length > 0 && (
          <>
            <div style={{
              margin: "24px 0 16px", padding: "16px 20px", borderRadius: 14,
              background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)",
              textAlign: "center",
            }}>
              <div style={{
                color: "var(--text-gold)", fontSize: 13, fontWeight: 500, marginBottom: 4,
              }}>
                ✦ Informe Premium
              </div>
              <div style={{
                color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6, marginBottom: 12,
              }}>
                {premiumSections.length} secciones adicionales con interpretación profunda
              </div>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block", background: "var(--color-primary-dim)",
                  color: "var(--text-main)", padding: "10px 28px", borderRadius: 30,
                  fontSize: 12, fontWeight: 600, textDecoration: "none",
                  fontFamily: "var(--font-sans)", letterSpacing: "0.03em",
                }}
              >
                Desbloquear informe completo
              </a>
            </div>

            {premiumSections.map((section) => (
              <SectionCard key={section.id} section={section} locked={true} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
