import { useState, useEffect, useRef } from "react";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { NavBar } from "./components/NavBar";
import { ChatView } from "./components/ChatView";
import { TransitViewer } from "./components/TransitViewer";
import { AssetViewer } from "./components/AssetViewer";
import { IntakeView } from "./components/IntakeView";
import { ReportView } from "./components/ReportView";
import { getUser, updateUser, generateReport, getReport } from "./api";
import type { LocalUser, UserProfile, Intake, DesignReport, View } from "./types";

// ─── Dust Particles — (replacing old stars) ──────────────────────────────────

const PARTICLES = Array.from({ length: 45 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  sz: Math.random() * 1.5 + 0.5,
  op: Math.random() * 0.3 + 0.05,
  del: Math.random() * 5,
  dur: 4 + Math.random() * 6,
}));

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [currentView, setCurrentView] = useState<View>("onboarding");
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [intake, setIntake] = useState<Intake | undefined>(undefined);
  const [report, setReport] = useState<DesignReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [previousView, setPreviousView] = useState<View>("chat");
  const [intakeError, setIntakeError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
            if (data.intake) setIntake(data.intake);
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

  const handleNavigate = (view: View) => {
    // Only update previousView when entering the intake/report flow from a main tab.
    // If already inside the flow (intake→report), preserve the original source tab.
    if (view === "intake" || view === "report") {
      if (currentView !== "intake" && currentView !== "report") {
        setPreviousView(currentView);
      }
    }
    setCurrentView(view);
  };

  const handleGoToReport = async () => {
    if (!user) return;
    try {
      const cached = await getReport(user.id);
      if (cached) {
        setReport(cached);
        setIntakeError(false);
        handleNavigate("report");
      } else {
        handleNavigate("intake");
      }
    } catch {
      handleNavigate("intake");
    }
  };

  const handleEditIntake = () => {
    handleNavigate("intake");
  };

  const handleGenerateReport = async (intakeData?: Intake) => {
    if (!user || !profile) return;

    if (report && !window.confirm("Esto va a reemplazar tu informe actual. ¿Continuar?")) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setReportLoading(true);
    setIntakeError(false);
    setCurrentView("report");

    if (intakeData) {
      setIntake(intakeData);
      try {
        await updateUser(user.id, user.name, profile, intakeData);
      } catch {
        setIntakeError(true);
      }
    }

    if (controller.signal.aborted) return;

    try {
      const result = await generateReport(user.id, "free");
      if (!controller.signal.aborted) setReport(result);
    } catch {
      if (!controller.signal.aborted && !report) setReport(null);
    } finally {
      if (!controller.signal.aborted) setReportLoading(false);
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    localStorage.removeItem("astral_user");
    setUser(null);
    setProfile(null);
    setReport(null);
    setIntake(undefined);
    setIntakeError(false);
    setReportLoading(false);
    setCurrentView("onboarding");
  };

  if (!ready) return null;

  return (
    <div
      style={{
        height: "100vh",
        background: "var(--bg-gradient)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
      className="animate-fade-in-slow"
    >
      {/* Mystical Background Orbs */}
      <div style={{
        position: "absolute", top: "-10%", left: "-10%", width: "40vw", height: "40vw",
        background: "radial-gradient(circle, rgba(157,139,223,0.03) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0
      }} />
      <div style={{
        position: "absolute", bottom: "-20%", right: "-10%", width: "50vw", height: "50vw",
        background: "radial-gradient(circle, rgba(212,175,55,0.03) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0
      }} />

      {/* Floating Dust Particles */}
      {PARTICLES.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.sz,
            height: s.sz,
            borderRadius: "50%",
            background: "#C5A059",
            opacity: s.op,
            pointerEvents: "none",
            animation: `pulse ${s.dur}s ease-in-out infinite ${s.del}s`,
            boxShadow: `0 0 ${s.sz * 2}px rgba(212,175,55,0.4)`,
          }}
        />
      ))}

      {/* Onboarding */}
      {currentView === "onboarding" && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}

      {/* Main app (after onboarding) */}
      {currentView !== "onboarding" && user && profile && (
        <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <NavBar
            currentView={currentView}
            onNavigate={handleNavigate}
            userName={user.name}
            profile={profile}
            onReset={handleReset}
            onGenerateReport={handleGoToReport}
            previousView={previousView}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            {currentView === "chat" && <ChatView user={user} />}
            {currentView === "transits" && <TransitViewer profile={profile} userId={user.id} />}
            {currentView === "assets" && <AssetViewer userId={user.id} />}
            {currentView === "intake" && (
              <IntakeView
                initialIntake={intake}
                hasExistingReport={!!report}
                onSubmit={(data) => handleGenerateReport(data)}
                onSkip={() => report ? handleNavigate("report") : handleGenerateReport()}
              />
            )}
            {currentView === "report" && (
              <ReportView
                report={report}
                loading={reportLoading}
                onBack={() => handleNavigate(previousView)}
                onEditIntake={handleEditIntake}
                userId={user.id}
                intakeWarning={intakeError}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
