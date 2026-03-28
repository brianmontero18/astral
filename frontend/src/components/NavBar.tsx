import type { UserProfile, NavView, View } from "../types";
import { ProfilePanel } from "./ProfilePanel";
import { useState, useRef, useEffect } from "react";

interface Props {
  currentView: NavView;
  onNavigate: (view: View) => void;
  userName: string;
  profile: UserProfile;
  onReset: () => void;
  onGenerateReport?: () => void;
  previousView?: View;
}

const TABS: { key: NavView; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "transits", label: "Tránsitos" },
  { key: "assets", label: "Mis Cartas" },
];

export function NavBar({ currentView, onNavigate, userName, profile, onReset, onGenerateReport, previousView }: Props) {
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProfile) return;
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showProfile]);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flexShrink: 1 }}>
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
          <div style={{ minWidth: 0 }}>
            <div style={{
              color: "var(--text-main)",
              fontSize: "18px",
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}>
              Astral Guide
            </div>
            <div style={{
              color: "var(--color-primary)",
              fontSize: "9px",
              letterSpacing: "0.2em",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              opacity: 0.8,
              whiteSpace: "nowrap",
            }}>
              DISEÑO HUMANO
            </div>
          </div>
        </div>

        <div ref={profileRef} style={{ position: "relative", flexShrink: 0 }}>
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
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "var(--color-primary-dim)" }}
              onMouseOut={(e) => { e.currentTarget.style.background = "var(--color-primary-faint)" }}
            >
              {userName}
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
                whiteSpace: "nowrap",
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(201,107,122,0.1)" }}
              onMouseOut={(e) => { e.currentTarget.style.background = "transparent" }}
            >
              Salir
            </button>
          </div>
          {showProfile && <ProfilePanel profile={profile} onGenerateReport={onGenerateReport ? () => { setShowProfile(false); onGenerateReport(); } : undefined} />}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "24px", paddingLeft: "4px" }}>
        {(currentView === "intake" || currentView === "report") ? (
          <button
            onClick={() => onNavigate(previousView ?? "chat")}
            style={{
              background: "transparent", border: "none",
              borderBottom: "1px solid transparent",
              color: "var(--text-muted)", padding: "10px 4px",
              cursor: "pointer", fontSize: "12px", fontWeight: 400,
              letterSpacing: "0.15em", fontFamily: "var(--font-sans)",
              textTransform: "uppercase", transition: "all 0.3s ease",
            }}
          >
            ← Volver
          </button>
        ) : (
          TABS.map((tab) => (
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
          ))
        )}
      </div>
    </header>
  );
}
