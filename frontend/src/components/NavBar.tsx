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
          <div aria-hidden className="app-brand-mark">✦</div>
          <div className="app-brand-title">Astral Guide</div>
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
              aria-label="Cerrar sesión"
              className="logout-button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
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
