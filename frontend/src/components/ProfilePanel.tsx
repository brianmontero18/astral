import type { AppUserPlan, UserProfile } from "../types";
import { translateCenters } from "../utils";

interface Props {
  profile: UserProfile;
  userPlan: AppUserPlan;
  onGenerateReport?: () => void;
}

const PLAN_LABELS: Record<AppUserPlan, string> = {
  free: "Free",
  basic: "Basic",
  premium: "Premium",
};

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(248, 244, 232, 0.06)",
        border: "1px solid rgba(248, 244, 232, 0.08)",
      }}
    >
      <div
        style={{
          color: "var(--color-primary)",
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "var(--text-main)",
          fontSize: 13,
          lineHeight: 1.4,
          fontFamily: "var(--font-sans)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ProfilePanel({ profile, userPlan, onGenerateReport }: Props) {
  const { humanDesign: hd } = profile;
  const definedCenters = Array.isArray(hd.definedCenters) ? hd.definedCenters : [];
  const undefinedCenters = Array.isArray(hd.undefinedCenters)
    ? hd.undefinedCenters
    : [];
  const channelNames = Array.isArray(hd.channels)
    ? hd.channels
        .map((channel) =>
          typeof channel === "string" ? channel : channel?.name ?? "",
        )
        .filter((channel) => channel.length > 0)
    : [];
  const displayName = profile.name?.trim() || "Perfil activo";
  const summaryRows: Array<[string, string]> = [
    ["Tipo", hd.type || "—"],
    ["Autoridad", hd.authority || "—"],
    ["Perfil", hd.profile || "—"],
    ["Estrategia", hd.strategy || "—"],
  ];
  const detailRows: Array<[string, string]> = [
    ["Definición", hd.definition || "—"],
    ["Cruz", hd.incarnationCross || "—"],
    ["No-Self", hd.notSelfTheme || "—"],
    ["Definidos", translateCenters(definedCenters) || "—"],
    ["Indefinidos", translateCenters(undefinedCenters) || "—"],
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        right: 0,
        width: 336,
        maxWidth: "calc(100vw - 32px)",
        zIndex: 200,
        padding: 18,
        borderRadius: 16,
        background: "var(--surface-dark)",
        border: "1px solid rgba(207, 172, 108, 0.24)",
        boxShadow: "0 18px 44px rgba(33, 41, 30, 0.28)",
        animation: "fadeIn 0.2s ease",
        maxHeight: "70vh",
        overflowY: "auto",
        color: "var(--text-main)",
      }}
    >
      <div
        style={{
          paddingBottom: 14,
          marginBottom: 14,
          borderBottom: "1px solid rgba(248, 244, 232, 0.1)",
        }}
      >
        <div
          style={{
            color: "var(--color-primary)",
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          ✦ Perfil activo
        </div>
        <div
          style={{
            color: "var(--text-main)",
            fontSize: 22,
            lineHeight: 1,
            fontFamily: "var(--font-serif)",
            marginBottom: 8,
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: 12,
            lineHeight: 1.5,
            fontFamily: "var(--font-sans)",
          }}
        >
          Resumen rápido de tu diseño humano disponible en esta cuenta.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <ProfileField label="Plan actual" value={PLAN_LABELS[userPlan]} />
        {summaryRows.map(([label, value]) => (
          <ProfileField key={label} label={label} value={value} />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {detailRows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "92px minmax(0, 1fr)",
              gap: 10,
              alignItems: "start",
              padding: "8px 2px",
            }}
          >
            <div
              style={{
                color: "var(--text-faint)",
                fontSize: 11,
                letterSpacing: "0.04em",
                fontFamily: "var(--font-sans)",
              }}
            >
              {label}
            </div>
            <div
              style={{
                color: "var(--text-main)",
                fontSize: 12,
                lineHeight: 1.5,
                fontFamily: "var(--font-sans)",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(207, 172, 108, 0.08)",
          border: "1px solid rgba(207, 172, 108, 0.22)",
        }}
      >
        <div
          style={{
            color: "var(--color-primary)",
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Canales
        </div>
        <div
          style={{
            color: "var(--text-main)",
            fontSize: 12,
            lineHeight: 1.6,
            fontFamily: "var(--font-sans)",
          }}
        >
          {channelNames.length > 0 ? channelNames.join(", ") : "—"}
        </div>
      </div>

      {onGenerateReport && (
        <button
          onClick={onGenerateReport}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #e0c081 0%, #9d7f4d 100%)",
            border: "1px solid var(--color-primary)",
            color: "var(--surface-deeper)",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            transition: "all 0.3s ease",
          }}
        >
          Generar mi informe
        </button>
      )}
    </div>
  );
}
