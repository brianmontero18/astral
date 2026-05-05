import type { AppUserPlan, UserProfile } from "../types";
import { translateCenters } from "../utils";
import { ChannelChips } from "./ChannelChips";

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
    <div className="profile-field">
      <span className="profile-label">{label}</span>
      <span className="profile-value">{value || "—"}</span>
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
  const compactRows: Array<[string, string]> = [
    ["Plan actual", PLAN_LABELS[userPlan]],
    ["Tipo", hd.type || "—"],
    ["Autoridad", hd.authority || "—"],
    ["Perfil", hd.profile || "—"],
    ["Estrategia", hd.strategy || "—"],
    ["Definición", hd.definition || "—"],
  ];
  const wideRows: Array<[string, string]> = [
    ["Cruz", hd.incarnationCross || "—"],
    ["No-Self", hd.notSelfTheme || "—"],
    ["Definidos", translateCenters(definedCenters) || "—"],
    ["Indefinidos", translateCenters(undefinedCenters) || "—"],
  ];

  return (
    <div className="profile-panel" role="dialog" aria-label="Perfil activo">
      <div className="profile-panel-header">
        <div className="profile-panel-kicker">✦ Perfil activo</div>
        <div className="profile-panel-name">{displayName}</div>
        <div className="profile-panel-description">
          Resumen rápido de tu Diseño Humano disponible en esta cuenta.
        </div>
      </div>

      {onGenerateReport && (
        <button
          onClick={onGenerateReport}
          className="astral-auth-primary profile-panel-cta"
        >
          Ver mi informe semanal
        </button>
      )}

      <div className="profile-grid">
        {compactRows.map(([label, value]) => (
          <ProfileField key={label} label={label} value={value} />
        ))}
      </div>

      <div className="profile-wide">
        {wideRows.map(([label, value]) => (
          <ProfileField key={label} label={label} value={value} />
        ))}
        <div className="profile-field">
          <span className="profile-label">Canales</span>
          {channelNames.length > 0 ? (
            <ChannelChips channels={channelNames} size="sm" />
          ) : (
            <span className="profile-value">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
