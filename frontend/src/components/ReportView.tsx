import { useState, useEffect } from "react";
import type { DesignReport, ReportSection } from "../types";
import { getReportPdfUrl, shareReport } from "../api";
import { buildReportViewModel } from "../report-view-model";

interface Props {
  report: DesignReport | null;
  loading: boolean;
  onBack: () => void;
  onEditIntake?: () => void;
  intakeWarning?: boolean;
}

const WHATSAPP_URL = "https://wa.me/5491153446030?text=Quiero%20desbloquear%20mi%20informe%20premium";

function SectionCard({ section, locked, onUnlockClick }: { section: ReportSection; locked: boolean; onUnlockClick?: () => void }) {
  const [expanded, setExpanded] = useState(!locked);

  useEffect(() => {
    setExpanded(!locked);
  }, [locked, section.id]);

  if (locked) {
    return (
      <div
        onClick={onUnlockClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onUnlockClick?.();
          }
        }}
        style={{
          background: "var(--surface-dark)",
          border: "1px solid rgba(248, 244, 232, 0.08)",
          borderRadius: 14, padding: "18px 20px", marginBottom: 14,
          cursor: "pointer", transition: "border-color 0.2s ease",
          color: "var(--text-main)",
          opacity: 0.85,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{section.icon}</span>
          <span style={{
            fontFamily: "var(--font-serif)", color: "var(--text-main)",
            fontSize: 16, fontWeight: 500,
          }}>
            {section.title}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 14, color: "var(--color-primary)" }}>🔒</span>
        </div>
        {section.previewContent && (
          <div style={{
            marginTop: 10,
            color: "var(--text-muted)",
            fontSize: 12,
            lineHeight: 1.6,
          }}>
            {section.previewContent}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--surface-dark)",
      border: "1px solid rgba(248, 244, 232, 0.1)",
      borderRadius: 14, padding: "18px 20px", marginBottom: 14,
      color: "var(--text-main)",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          background: "none", border: "none", cursor: "pointer", width: "100%",
          display: "flex", alignItems: "center", gap: 10, padding: 0, textAlign: "left",
          color: "inherit",
        }}
      >
        <span style={{ fontSize: 18 }}>{section.icon}</span>
        <span style={{
          fontFamily: "var(--font-serif)", color: "var(--text-main)",
          fontSize: 17, fontWeight: 500, flex: 1,
        }}>
          {section.title}
        </span>
        <span style={{ color: "var(--color-primary)", fontSize: 12, transition: "transform 0.2s" }}>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(207, 172, 108, 0.18)",
          color: "var(--text-main)", fontSize: 13.5,
          lineHeight: 1.8, fontWeight: 400, whiteSpace: "pre-line",
        }}>
          {section.staticContent && <div>{section.staticContent}</div>}
          {section.llmContent && (
            <div style={{ marginTop: section.staticContent ? 14 : 0, color: "var(--color-cream-soft)" }}>
              {section.llmContent}
            </div>
          )}
          {section.teaser && (
            <div style={{
              marginTop: 14, padding: "12px 16px", borderRadius: 10,
              background: "rgba(207, 172, 108, 0.08)",
              border: "1px solid rgba(207, 172, 108, 0.28)",
              fontSize: 12, color: "var(--color-primary)", fontStyle: "italic",
            }}>
              Tu informe continúa más abajo con la capa premium.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportActions({ tier, reportId }: { tier: "free" | "premium"; reportId: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setShareUrl(null);
    setShareError(false);
  }, [reportId]);

  const handleShare = async () => {
    setSharing(true);
    setShareError(false);
    try {
      const { url } = await shareReport(tier);
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt("Copiá este enlace:", url);
      }
    } catch {
      setShareError(true);
    }
    setSharing(false);
  };

  return (
    <div style={{ marginTop: 24, textAlign: "center", display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
      <a
        href={getReportPdfUrl(tier)}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "12px 28px", borderRadius: 8,
          background: "linear-gradient(135deg, #e0c081 0%, #9d7f4d 100%)",
          color: "var(--surface-deeper)",
          fontSize: 12, fontWeight: 700, textDecoration: "none",
          fontFamily: "var(--font-sans)", letterSpacing: "0.14em", textTransform: "uppercase",
        }}
      >
        Descargar PDF
      </a>
      <button
        onClick={handleShare}
        disabled={sharing}
        style={{
          padding: "12px 28px", borderRadius: 8,
          background: "transparent", border: "1px solid var(--surface-deeper)",
          color: "var(--text-on-light)", fontSize: 12, fontWeight: 600,
          cursor: sharing ? "default" : "pointer", fontFamily: "var(--font-sans)",
          letterSpacing: "0.14em", textTransform: "uppercase", opacity: sharing ? 0.6 : 1,
        }}
      >
        {sharing ? "..." : shareError ? "Error al compartir" : shareUrl ? "✓ Link copiado" : "Compartir"}
      </button>
    </div>
  );
}

export function ReportView({ report, loading, onBack, onEditIntake, intakeWarning }: Props) {
  if (loading) {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 16,
      }}>
        <div style={{
          width: 32, height: 32,
          border: "2px solid rgba(33, 41, 30, 0.18)",
          borderTopColor: "var(--color-gold-deep)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }} />
        <span style={{
          color: "var(--text-on-light)", fontSize: 14, fontWeight: 500,
          fontFamily: "var(--font-sans)",
        }}>
          Generando tu informe...
        </span>
        <span style={{
          color: "var(--text-on-light-muted)", fontSize: 11, fontWeight: 400,
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
        <span style={{ color: "#9a3737", fontSize: 14, fontWeight: 500 }}>
          No se pudo generar el informe. Intentá de nuevo.
        </span>
        <button
          onClick={onBack}
          style={{
            background: "linear-gradient(135deg, #e0c081 0%, #9d7f4d 100%)",
            border: "none",
            color: "var(--surface-deeper)", padding: "10px 24px", borderRadius: 8,
            cursor: "pointer", fontSize: 12, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}
        >
          Volver
        </button>
      </div>
    );
  }

  const {
    freeSections,
    premiumSections,
    premiumUnlocked,
    premiumCtaTitle,
    premiumCtaBody,
    premiumCtaLabel,
  } = buildReportViewModel(report);

  const scrollToUnlock = () => {
    const cta = document.getElementById("premium-cta");
    const container = cta?.closest("[style*='overflow-y']") as HTMLElement | null;
    if (cta && container) {
      container.scrollTop = cta.offsetTop - container.offsetTop - 20;
    }
  };

  return (
    <div style={{
      flex: 1, overflowY: "auto", padding: "24px 16px",
    }}>
      <div style={{ maxWidth: 760, width: "100%", margin: "0 auto" }}>
        <div style={{
          color: "var(--color-gold-deep)", fontSize: 10, letterSpacing: "0.22em",
          fontWeight: 700, marginBottom: 8, fontFamily: "var(--font-sans)", textTransform: "uppercase",
        }}>
          Tu informe de Diseño Humano
        </div>
        <h1 style={{
          fontFamily: "var(--font-serif)", color: "var(--text-on-light)",
          fontSize: 30, fontWeight: 500, margin: "0 0 8px",
        }}>
          Informe Personal
        </h1>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 24, flexWrap: "wrap", gap: 8,
        }}>
          {report.createdAt && (
            <span style={{
              color: "var(--text-on-light-muted)", fontSize: 12, fontWeight: 400,
              fontFamily: "var(--font-sans)",
            }}>
              Generado el {new Date(report.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
          {onEditIntake && (
            <button
              onClick={onEditIntake}
              style={{
                background: "transparent", border: "1px solid rgba(33, 41, 30, 0.32)",
                color: "var(--text-on-light)", padding: "6px 16px", borderRadius: 20,
                cursor: "pointer", fontSize: 11, fontWeight: 600,
                fontFamily: "var(--font-sans)", letterSpacing: "0.04em",
                transition: "all 0.2s ease",
              }}
            >
              Editar mis respuestas
            </button>
          )}
        </div>

        {intakeWarning && (
          <div style={{
            padding: "10px 16px", borderRadius: 10, marginBottom: 16,
            background: "rgba(207, 172, 108, 0.14)", border: "1px solid rgba(207, 172, 108, 0.42)",
            color: "var(--color-gold-deep)", fontSize: 12, lineHeight: 1.5,
          }}>
            Tu contexto personal no se pudo guardar. El informe se generó sin tus respuestas de intake.
          </div>
        )}

        {freeSections.map((section) => (
          <SectionCard key={section.id} section={section} locked={false} />
        ))}

        {premiumSections.length > 0 && !premiumUnlocked && (
          <>
            <div id="premium-cta" style={{
              margin: "24px 0 16px", padding: "20px 24px", borderRadius: 14,
              background: "var(--surface-dark)", border: "1px solid rgba(207, 172, 108, 0.32)",
              textAlign: "center", color: "var(--text-main)",
            }}>
              <div style={{
                color: "var(--color-primary)", fontSize: 14, fontWeight: 600, marginBottom: 4,
                fontFamily: "var(--font-serif)",
              }}>
                {premiumCtaTitle}
              </div>
              <div style={{
                color: "var(--text-muted)", fontSize: 12, lineHeight: 1.65, marginBottom: 16,
              }}>
                {premiumCtaBody}
              </div>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  background: "linear-gradient(135deg, #e0c081 0%, #9d7f4d 100%)",
                  color: "var(--surface-deeper)", padding: "10px 28px", borderRadius: 8,
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                  fontFamily: "var(--font-sans)", letterSpacing: "0.14em", textTransform: "uppercase",
                }}
              >
                {premiumCtaLabel}
              </a>
            </div>

            {premiumSections.map((section) => (
              <SectionCard key={section.id} section={section} locked={true} onUnlockClick={scrollToUnlock} />
            ))}
          </>
        )}

        {premiumSections.length > 0 && premiumUnlocked && premiumSections.map((section) => (
          <SectionCard key={section.id} section={section} locked={false} />
        ))}

        <ReportActions tier={report.tier} reportId={report.id} />
      </div>
    </div>
  );
}
