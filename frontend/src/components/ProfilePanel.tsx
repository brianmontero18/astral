import type { UserProfile } from "../types";
import { translateCenters } from "../utils";
import { ChannelChips } from "./ChannelChips";

interface Props {
  profile: UserProfile;
  onGenerateReport?: () => void;
}

export function ProfilePanel({ profile, onGenerateReport }: Props) {
  const { humanDesign: hd } = profile;

  const rows: [string, string][] = [
    ["Tipo",        hd.type || "—"],
    ["Estrategia",  hd.strategy || "—"],
    ["Autoridad",   hd.authority || "—"],
    ["Perfil",      hd.profile || "—"],
    ["Definición",  hd.definition || "—"],
    ["Cruz",        hd.incarnationCross || "—"],
    ["No-Self",     hd.notSelfTheme || "—"],
    ["Definidos",   translateCenters(hd.definedCenters) || "—"],
    ["Indefinidos", translateCenters(hd.undefinedCenters) || "—"],
  ];

  return (
    <div style={{
      position: "absolute",
      top: "calc(100% + 8px)",
      right: 0,
      width: 272,
      maxWidth: "calc(100vw - 32px)",
      zIndex: 200,
      background: "#110a2e",
      border: "1px solid rgba(124,111,205,0.4)",
      borderRadius: 12,
      padding: 16,
      animation: "fadeIn 0.2s ease",
      boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
      maxHeight: "60vh",
      overflowY: "auto",
    }}>
      <div style={{ color: "#7c6fcd", fontSize: 10, letterSpacing: "0.12em", marginBottom: 10 }}>
        ✦ PERFIL ACTIVO
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ marginBottom: 5, display: "flex", gap: 6 }}>
          <span style={{ color: "#7c6fcd", fontSize: 10, flexShrink: 0, width: 76 }}>{k}:</span>
          <span style={{ color: "#d4cef0", fontSize: 10 }}>{v}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "flex-start" }}>
        <span style={{ color: "#7c6fcd", fontSize: 10, flexShrink: 0, width: 76 }}>Canales:</span>
        {hd.channels.length > 0 ? (
          <div style={{ flex: 1 }}>
            <ChannelChips channels={hd.channels.map((c) => c.name)} size="sm" align="start" />
          </div>
        ) : (
          <span style={{ color: "#d4cef0", fontSize: 10 }}>—</span>
        )}
      </div>

      {onGenerateReport && (
        <button
          onClick={onGenerateReport}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--color-primary-dim)",
            border: "none",
            color: "var(--text-main)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            letterSpacing: "0.05em",
            transition: "all 0.3s ease",
          }}
        >
          ✦ Generar mi informe
        </button>
      )}
    </div>
  );
}
