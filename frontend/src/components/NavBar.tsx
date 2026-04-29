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
    <header className="app-shell-header">
      <div className="app-shell-header-row">
        <div className="app-brand">
          <div aria-hidden className="app-brand-mark">A</div>
          <div className="app-brand-copy">
            <div className="app-brand-title">Astral Guide</div>
            <div className="app-brand-kicker">DISEÑO HUMANO</div>
          </div>
        </div>

        <div ref={profileRef} className="app-profile-menu">
          <div className="app-profile-actions">
            {userRole === "admin" ? (
              <a
                href="/auth/dashboard"
                className="admin-link-button"
              >
                Dashboard Auth
              </a>
            ) : null}
            <button
              onClick={() => setShowProfile((v) => !v)}
              className="user-pill"
            >
              {userName}
            </button>
            <button
              onClick={onReset}
              title="Cerrar sesión"
              className="logout-button"
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

      <div className="app-nav">
        {!supportRoute && (currentView === "intake" || currentView === "report") ? (
          <button
            onClick={() => onNavigate(previousView ?? "chat")}
            className="app-nav-item"
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
                  className={`app-nav-item${active ? " app-nav-item--active" : ""}`}
                >
                  {tab.label}
                </button>
              );
            })}
            {userRole === "admin" ? (
              <button
                onClick={onOpenSupportPanel}
                className={`app-nav-item${supportRoute ? " app-nav-item--active" : ""}`}
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
