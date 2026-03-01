import type { UserProfile } from "../types";
import { ProfilePanel } from "./ProfilePanel";
import { useState } from "react";

type View = "chat" | "transits" | "assets";

interface Props {
  currentView: View;
  onNavigate: (view: View) => void;
  userName: string;
  profile: UserProfile;
  onReset: () => void;
}

const TABS: { key: View; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "transits", label: "Tránsitos" },
  { key: "assets", label: "Mis Cartas" },
];

export function NavBar({ currentView, onNavigate, userName, profile, onReset }: Props) {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <header
      style={{
        padding: "20px 24px 0",
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid var(--glass-border)",
        background: "rgba(10, 9, 16, 0.4)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        flexShrink: 0,
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              flexShrink: 0,
              background: "radial-gradient(circle at 30% 30%, #D4AF37, #C5A059, #1c153a)",
              boxShadow: "0 0 15px rgba(212,175,55,0.2)",
              animation: "spin 20s linear infinite",
            }}
          />
          <div>
            <div style={{ 
              color: "var(--text-main)", 
              fontSize: "18px", 
              fontFamily: "var(--font-serif)",
              fontWeight: 500, 
              letterSpacing: "0.06em" 
            }}>
              Astral Guide
            </div>
            <div style={{ 
              color: "var(--color-primary)", 
              fontSize: "9px", 
              letterSpacing: "0.25em",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              opacity: 0.8
            }}>
              CARTA NATAL · DISEÑO HUMANO
            </div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setShowProfile((v) => !v)}
              style={{
                background: "var(--color-primary-faint)",
                border: "1px solid var(--glass-gold-border)",
                color: "var(--text-gold)",
                padding: "6px 14px",
                borderRadius: 30,
                cursor: "pointer",
                fontSize: "11px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                letterSpacing: "0.05em",
                transition: "all 0.3s ease",
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "var(--color-primary-dim)" }}
              onMouseOut={(e) => { e.currentTarget.style.background = "var(--color-primary-faint)" }}
            >
              {userName} <span style={{opacity: 0.5, margin: "0 6px"}}>|</span> {profile.humanDesign.type}
            </button>
            <button
              onClick={onReset}
              title="Desconectar y Empezar de Nuevo"
              style={{
                background: "transparent",
                border: "1px solid rgba(201,107,122,0.3)",
                color: "#f0a0b0",
                padding: "6px 14px",
                borderRadius: 30,
                cursor: "pointer",
                fontSize: "10px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                transition: "all 0.3s ease",
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(201,107,122,0.1)" }}
              onMouseOut={(e) => { e.currentTarget.style.background = "transparent" }}
            >
              Desconectar
            </button>
          </div>
          {showProfile && <ProfilePanel profile={profile} />}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "24px", paddingLeft: "4px" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onNavigate(tab.key)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: currentView === tab.key ? "1px solid var(--color-primary)" : "1px solid transparent",
              color: currentView === tab.key ? "var(--text-main)" : "var(--text-muted)",
              padding: "10px 4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: currentView === tab.key ? 600 : 400,
              letterSpacing: "0.15em",
              fontFamily: "var(--font-sans)",
              textTransform: "uppercase",
              transition: "all 0.3s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
