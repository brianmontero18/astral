import { useState, useEffect } from "react";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { NavBar } from "./components/NavBar";
import { ChatView } from "./components/ChatView";
import { TransitViewer } from "./components/TransitViewer";
import { AssetViewer } from "./components/AssetViewer";
import { getUser } from "./api";
import type { LocalUser, UserProfile } from "./types";

// ─── Stars — generadas una sola vez ──────────────────────────────────────────

const STARS = Array.from({ length: 55 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  sz: Math.random() * 1.8 + 0.4,
  op: Math.random() * 0.5 + 0.15,
  del: Math.random() * 4,
  dur: 2.5 + Math.random() * 3,
}));

type View = "onboarding" | "chat" | "transits" | "assets";

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [currentView, setCurrentView] = useState<View>("onboarding");
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("astral_user");
    if (stored) {
      try {
        const localUser = JSON.parse(stored) as LocalUser;
        getUser(localUser.id)
          .then((data) => {
            setUser({ id: data.id, name: data.name });
            setProfile(data.profile);
            setCurrentView("chat");
          })
          .catch(() => {
            // User not found in DB — clear stale data
            localStorage.removeItem("astral_user");
          })
          .finally(() => setReady(true));
      } catch {
        localStorage.removeItem("astral_user");
        setReady(true);
      }
    } else {
      setReady(true);
    }
  }, []);

  const handleOnboardingComplete = (u: LocalUser, p: UserProfile) => {
    setUser(u);
    setProfile(p);
    setCurrentView("chat");
  };

  if (!ready) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 20% 10%, #1a1035 0%, #0d0820 50%, #060412 100%)",
        fontFamily: "Georgia, serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: var(--op); }
          50%       { opacity: calc(var(--op) * 0.2); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        textarea { outline: none !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #4a3a7a; border-radius: 4px; }
        button:hover { opacity: 0.85; }
      `}</style>

      {/* Stars */}
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.sz,
            height: s.sz,
            borderRadius: "50%",
            background: "#fff",
            ["--op" as string]: s.op,
            opacity: s.op,
            pointerEvents: "none",
            animation: `twinkle ${s.dur}s ease-in-out infinite ${s.del}s`,
          }}
        />
      ))}

      {/* Onboarding */}
      {currentView === "onboarding" && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}

      {/* Main app (after onboarding) */}
      {currentView !== "onboarding" && user && profile && (
        <>
          <NavBar
            currentView={currentView as "chat" | "transits" | "assets"}
            onNavigate={setCurrentView}
            userName={user.name}
            profile={profile}
          />

          {currentView === "chat" && <ChatView user={user} />}
          {currentView === "transits" && <TransitViewer />}
          {currentView === "assets" && <AssetViewer userId={user.id} />}
        </>
      )}
    </div>
  );
}
