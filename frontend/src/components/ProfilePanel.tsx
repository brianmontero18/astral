import type { UserProfile } from "../types";

interface Props {
  profile: UserProfile;
}

export function ProfilePanel({ profile }: Props) {
  const { natal, humanDesign: hd } = profile;

  const sunInfo = natal.planets[0]
    ? `${natal.planets[0].sign}, Casa ${natal.planets[0].house}`
    : "—";

  const rows: [string, string][] = [
    ["Tipo",        hd.type || "—"],
    ["Estrategia",  hd.strategy || "—"],
    ["Autoridad",   hd.authority || "—"],
    ["Perfil",      hd.profile || "—"],
    ["Definición",  hd.definition || "—"],
    ["Cruz",        hd.incarnationCross || "—"],
    ["No-Self",     hd.notSelfTheme || "—"],
    ["Ascendente",  natal.ascendant || "—"],
    ["Sol",         sunInfo],
    ["Canales",     hd.channels.map((c) => c.name).join(", ") || "—"],
    ["Definidos",   hd.definedCenters.join(", ") || "—"],
    ["Indefinidos", hd.undefinedCenters.join(", ") || "—"],
  ];

  return (
    <div style={{
      position: "absolute",
      top: "calc(100% + 8px)",
      right: 0,
      width: 272,
      zIndex: 200,
      background: "#110a2e",
      border: "1px solid rgba(124,111,205,0.4)",
      borderRadius: 12,
      padding: 16,
      animation: "fadeIn 0.2s ease",
      boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
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
    </div>
  );
}
