import { redirectToAuth } from "supertokens-auth-react";
import Session from "supertokens-auth-react/recipe/session";
import { useState, useEffect, useRef } from "react";
import {
  ADMIN_USERS_PATH,
  buildAdminUserPath,
  parseAdminSupportRoute,
} from "./admin-support";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { AdminUsersView } from "./components/AdminUsersView";
import { AdminUserDetailView } from "./components/AdminUserDetailView";
import { NavBar } from "./components/NavBar";
import { ChatView } from "./components/ChatView";
import { TransitViewer } from "./components/TransitViewer";
import { AssetViewer } from "./components/AssetViewer";
import { IntakeView } from "./components/IntakeView";
import { ReportView } from "./components/ReportView";
import { generateReport, getCurrentUser, getReport, updateCurrentUser } from "./api";
import { getAccessibleReportTier } from "./report-access";
import {
  shouldPreserveAuthRedirect,
} from "./auth/helpers";
import {
  getAuthRedirectFailureDisplay,
  getAuthRequiredConfigDisplay,
  getCurrentUserFailureDisplay,
  getInactiveAccountErrorDisplay,
  type BootstrapErrorDisplay,
} from "./auth/bootstrap-errors";
import { readFrontendAuthConfig } from "./auth/config";
import type { AppUserStatus, LocalUser, UserProfile, Intake, DesignReport, View } from "./types";

// ─── Dust Particles — (replacing old stars) ──────────────────────────────────

const PARTICLES = Array.from({ length: 45 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  sz: Math.random() * 1.5 + 0.5,
  op: Math.random() * 0.3 + 0.05,
  del: Math.random() * 5,
  dur: 4 + Math.random() * 6,
}));

function readCurrentPathname(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  return window.location.pathname;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const authConfig = readFrontendAuthConfig();
  const [pathname, setPathname] = useState(readCurrentPathname);
  const [currentView, setCurrentView] = useState<View>("onboarding");
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bootstrapError, setBootstrapError] = useState<BootstrapErrorDisplay | null>(null);
  const [ready, setReady] = useState(false);
  const [authRedirectPending, setAuthRedirectPending] = useState(false);
  const [intake, setIntake] = useState<Intake | undefined>(undefined);
  const [report, setReport] = useState<DesignReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [previousView, setPreviousView] = useState<View>("chat");
  const [intakeError, setIntakeError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const adminSupportRoute = parseAdminSupportRoute(pathname);

  useEffect(() => {
    const syncPathname = () => {
      setPathname(readCurrentPathname());
    };

    window.addEventListener("popstate", syncPathname);
    return () => {
      window.removeEventListener("popstate", syncPathname);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const result = await getCurrentUser();

        if (cancelled) {
          return;
        }

        if (result.kind === "linked") {
          setUser({
            id: result.user.id,
            name: result.user.name,
            plan: result.user.plan,
            role: result.user.role,
            status: result.user.status,
          });
          setProfile(result.user.profile);
          setIntake(result.user.intake ?? undefined);
          setCurrentView("chat");
          setReady(true);
          return;
        }

        if (result.kind === "inactive") {
          setBootstrapError(getInactiveAccountErrorDisplay(result.status));
          setReady(true);
          return;
        }

        if (result.kind === "anonymous" && authConfig.enabled) {
          setAuthRedirectPending(true);
          void redirectToAuth({
            redirectBack: shouldPreserveAuthRedirect(
              pathname,
              authConfig.websiteBasePath,
            ),
          }).catch(() => {
            if (!cancelled) {
              setBootstrapError(getAuthRedirectFailureDisplay());
              setAuthRedirectPending(false);
              setReady(true);
            }
          });
          return;
        }

        if (result.kind === "anonymous") {
          setBootstrapError(getAuthRequiredConfigDisplay());
        }

        setReady(true);
      } catch (error) {
        if (!cancelled) {
          setBootstrapError(getCurrentUserFailureDisplay(error));
          setReady(true);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [authConfig.enabled, authConfig.websiteBasePath, pathname]);

  const handleOnboardingComplete = (u: LocalUser, p: UserProfile) => {
    setUser(u);
    setProfile(p);
    setCurrentView("chat");
  };

  const handleNavigate = (view: View) => {
    if (adminSupportRoute) {
      window.history.pushState({}, "", "/");
      setPathname(readCurrentPathname());
    }

    // Only update previousView when entering the intake/report flow from a main tab.
    // If already inside the flow (intake→report), preserve the original source tab.
    if (view === "intake" || view === "report") {
      if (currentView !== "intake" && currentView !== "report") {
        setPreviousView(currentView);
      }
    }
    setCurrentView(view);
  };

  const handleOpenAdminUsers = () => {
    window.history.pushState({}, "", ADMIN_USERS_PATH);
    setPathname(readCurrentPathname());
  };

  const handleOpenAdminUser = (userId: string) => {
    window.history.pushState({}, "", buildAdminUserPath(userId));
    setPathname(readCurrentPathname());
  };

  const handleGoToReport = async () => {
    if (!user) {
      return;
    }

    const tier = getAccessibleReportTier(user.plan);

    try {
      const cached = await getReport(tier);
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
        await updateCurrentUser(user.name, profile, intakeData);
      } catch {
        setIntakeError(true);
      }
    }

    if (controller.signal.aborted) return;

    try {
      const result = await generateReport(getAccessibleReportTier(user.plan));
      if (!controller.signal.aborted) setReport(result);
    } catch {
      if (!controller.signal.aborted && !report) setReport(null);
    } finally {
      if (!controller.signal.aborted) setReportLoading(false);
    }
  };

  const handleReset = async () => {
    abortRef.current?.abort();
    setUser(null);
    setProfile(null);
    setReport(null);
    setIntake(undefined);
    setIntakeError(false);
    setReportLoading(false);
    setCurrentView("onboarding");

    if (!authConfig.enabled) {
      return;
    }

    try {
      await Session.signOut();
    } finally {
      setAuthRedirectPending(true);
      await redirectToAuth({ redirectBack: false });
    }
  };

  if (!ready || authRedirectPending) return null;

  if (bootstrapError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "var(--bg-gradient)",
        }}
      >
        <div
          className="glass-panel"
          style={{
            maxWidth: 520,
            width: "100%",
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: "0 0 12px",
              color: "var(--text-main)",
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: 28,
            }}
          >
            {bootstrapError.title}
          </h1>
          <p
            style={{
              margin: bootstrapError.retryable ? "0 0 20px" : 0,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              fontSize: 14,
            }}
          >
            {bootstrapError.body}
          </p>
          {bootstrapError.retryable ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
          ) : null}
        </div>
      </div>
    );
  }

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
            supportRoute={adminSupportRoute?.kind ?? null}
            onNavigate={handleNavigate}
            onOpenSupportPanel={handleOpenAdminUsers}
            userName={user.name}
            userPlan={user.plan}
            userRole={user.role}
            profile={profile}
            onReset={handleReset}
            onGenerateReport={handleGoToReport}
            previousView={previousView}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            {adminSupportRoute ? (
              user.role !== "admin" ? (
                <div
                  style={{
                    flex: 1,
                    display: "grid",
                    placeItems: "center",
                    padding: 24,
                  }}
                >
                  <div
                    className="glass-panel"
                    style={{
                      maxWidth: 560,
                      width: "100%",
                      padding: "28px 24px",
                      textAlign: "center",
                    }}
                  >
                    <h1
                      style={{
                        margin: "0 0 12px",
                        color: "var(--text-main)",
                        fontFamily: "var(--font-serif)",
                        fontWeight: 400,
                        fontSize: 30,
                      }}
                    >
                      Soporte no disponible
                    </h1>
                    <p
                      style={{
                        margin: "0 0 20px",
                        color: "var(--text-muted)",
                        lineHeight: 1.7,
                        fontSize: 14,
                      }}
                    >
                      Esta sesión no tiene permisos para abrir el panel interno
                      de usuarios.
                    </p>
                    <button
                      onClick={() => handleNavigate("chat")}
                      className="btn-primary"
                    >
                      Volver al chat
                    </button>
                  </div>
                </div>
              ) : adminSupportRoute.kind === "users-list" ? (
                <AdminUsersView onOpenUser={handleOpenAdminUser} />
              ) : (
                <AdminUserDetailView
                  currentUserId={user.id}
                  userId={adminSupportRoute.userId}
                  onBackToUsers={handleOpenAdminUsers}
                />
              )
            ) : (
              <>
                {currentView === "chat" && <ChatView userName={user.name} />}
                {currentView === "transits" && <TransitViewer profile={profile} />}
                {currentView === "assets" && <AssetViewer />}
                {currentView === "intake" && (
                  <IntakeView
                    initialIntake={intake}
                    submitLabel={report ? "Regenerar mi informe" : "Generar mi informe"}
                    description="Completá lo que necesites para que tu informe llegue específico. Los dos campos con * son obligatorios — ya los completaste en tu onboarding, podés ajustarlos si querés."
                    secondaryAction={
                      report
                        ? { label: "Volver al informe", onClick: () => handleNavigate("report") }
                        : undefined
                    }
                    onSubmit={(data) => handleGenerateReport(data)}
                  />
                )}
                {currentView === "report" && (
                  <ReportView
                    report={report}
                    loading={reportLoading}
                    onBack={() => handleNavigate(previousView)}
                    onEditIntake={handleEditIntake}
                    intakeWarning={intakeError}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
