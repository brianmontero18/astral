import type { UserProfile } from "../types";
import { ProfilePanel } from "./ProfilePanel";
import { useState } from "react";

type View = "chat" | "transits" | "assets";

interface Props {
  currentView: View;
  onNavigate: (view: View) => void;
  userName: string;
  profile: UserProfile;
}

const TABS: { key: View; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "transits", label: "Tránsitos" },
  { key: "assets", label: "Mis Cartas" },
];

export function NavBar({ currentView, onNavigate, userName, profile }: Props) {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <header
      style={{
        padding: "14px 18px 0",
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid rgba(124,111,205,0.2)",
        backdropFilter: "blur(10px)",
        background: "rgba(13,8,32,0.65)",
        zIndex: 10,
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              flexShrink: 0,
              background: "conic-gradient(#7c6fcd, #c96b7a, #e8b84b, #6bba8a, #7c6fcd)",
              animation: "spin 10s linear infinite",
            }}
          />
          <div>
            <div style={{ color: "#e8e0ff", fontSize: 15, fontWeight: 700, letterSpacing: "0.02em" }}>
              Astral Guide
            </div>
            <div style={{ color: "#7c6fcd", fontSize: 9, letterSpacing: "0.1em" }}>
              CARTA NATAL · DISEÑO HUMANO · TRÁNSITOS
            </div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowProfile((v) => !v)}
            style={{
              background: "rgba(124,111,205,0.15)",
              border: "1px solid rgba(124,111,205,0.4)",
              color: "#b0a4e8",
              padding: "5px 12px",
              borderRadius: 20,
              cursor: "pointer",
              fontSize: 11,
              letterSpacing: "0.04em",
            }}
          >
            {userName} · {profile.humanDesign.type}
          </button>
          {showProfile && <ProfilePanel profile={profile} />}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onNavigate(tab.key)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: currentView === tab.key ? "2px solid #7c6fcd" : "2px solid transparent",
              color: currentView === tab.key ? "#e8e0ff" : "#7c6fcd",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 12,
              letterSpacing: "0.05em",
              fontFamily: "Georgia, serif",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
