import type { AppUserPlan, AppUserRole, UserProfile, NavView, View } from "../types";
import { ProfilePanel } from "./ProfilePanel";
import { useState, useRef, useEffect } from "react";

interface Props {
  currentView: NavView;
  supportRoute: "users-list" | "user-detail" | null;
  onNavigate: (view: View) => void;
  onOpenSupportPanel: () => void;
  userName: string;
  userPlan: AppUserPlan;
  userRole: AppUserRole;
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

export function NavBar({
  currentView,
  supportRoute,
  onNavigate,
  onOpenSupportPanel,
  userName,
  userPlan,
  userRole,
  profile,
  onReset,
  onGenerateReport,
  previousView,
}: Props) {
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
        padding: "18px 28px 0",
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid rgba(248, 244, 232, 0.08)",
        background: "var(--surface-deeper)",
        flexShrink: 0,
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flexShrink: 1 }}>
          <div
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              flexShrink: 0,
              background: "var(--surface-dark)",
              border: "1px solid var(--color-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-gold)",
              fontFamily: "var(--font-serif)",
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}
          >
            A
          </div>
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
              letterSpacing: "0.22em",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              whiteSpace: "nowrap",
              opacity: 0.85,
            }}>
              DISEÑO HUMANO
            </div>
          </div>
        </div>

        <div ref={profileRef} style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {userRole === "admin" ? (
              <a
                href="/auth/dashboard"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(207, 172, 108, 0.45)",
                  color: "var(--color-primary)",
                  padding: "6px 14px",
                  borderRadius: 30,
                  fontSize: "10px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Dashboard Auth
              </a>
            ) : null}
            <button
              onClick={() => setShowProfile((v) => !v)}
              style={{
                background: "rgba(248, 244, 232, 0.06)",
                border: "1px solid rgba(248, 244, 232, 0.14)",
                color: "var(--text-main)",
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
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(207, 172, 108, 0.16)"; e.currentTarget.style.borderColor = "var(--color-primary-dim)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(248, 244, 232, 0.06)"; e.currentTarget.style.borderColor = "rgba(248, 244, 232, 0.14)"; }}
            >
              {userName}
            </button>
            <button
              onClick={onReset}
              title="Cerrar sesión"
              style={{
                background: "transparent",
                border: "1px solid rgba(248, 244, 232, 0.18)",
                color: "var(--text-muted)",
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
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(248, 244, 232, 0.06)"; e.currentTarget.style.color = "var(--text-main)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              Salir
            </button>
          </div>
          {showProfile && (
            <ProfilePanel
              profile={profile}
              userPlan={userPlan}
              onGenerateReport={onGenerateReport ? () => { setShowProfile(false); onGenerateReport(); } : undefined}
            />
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "26px", paddingLeft: "2px" }}>
        {!supportRoute && (currentView === "intake" || currentView === "report") ? (
          <button
            onClick={() => onNavigate(previousView ?? "chat")}
            style={{
              background: "transparent", border: "none",
              borderBottom: "2px solid transparent",
              color: "var(--text-muted)", padding: "10px 2px",
              cursor: "pointer", fontSize: "12px", fontWeight: 500,
              letterSpacing: "0.15em", fontFamily: "var(--font-sans)",
              textTransform: "uppercase", transition: "all 0.3s ease",
            }}
          >
            ← Volver
          </button>
        ) : (
          <>
            {TABS.map((tab) => {
              const active = !supportRoute && currentView === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onNavigate(tab.key)}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: active ? "2px solid var(--color-primary)" : "2px solid transparent",
                    color: active ? "var(--color-primary)" : "var(--text-muted)",
                    padding: "10px 2px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: active ? 600 : 500,
                    letterSpacing: "0.15em",
                    fontFamily: "var(--font-sans)",
                    textTransform: "uppercase",
                    transition: "all 0.3s ease",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
            {userRole === "admin" ? (
              <button
                onClick={onOpenSupportPanel}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: supportRoute ? "2px solid var(--color-primary)" : "2px solid transparent",
                  color: supportRoute ? "var(--color-primary)" : "var(--text-muted)",
                  padding: "10px 2px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: supportRoute ? 600 : 500,
                  letterSpacing: "0.15em",
                  fontFamily: "var(--font-sans)",
                  textTransform: "uppercase",
                  transition: "all 0.3s ease",
                }}
              >
                Usuarios
              </button>
            ) : null}
          </>
        )}
      </div>
    </header>
  );
}
