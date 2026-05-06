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
import { ConfirmModal } from "./components/ConfirmModal";
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
import type {
  AppUserOnboardingStep,
  AppUserStatus,
  LocalUser,
  UserProfile,
  Intake,
  DesignReport,
  View,
} from "./types";

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
  const [pendingRegenerateIntake, setPendingRegenerateIntake] = useState<{
    intake?: Intake;
  } | null>(null);
  const [resumeStep, setResumeStep] = useState<AppUserOnboardingStep | null>(
    null,
  );
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
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
          if (result.user.onboardingStatus === "pending") {
            // Admin-invited (or self-signup mid-flow) — resume the onboarding
            // wizard at the persisted step. The user/profile/intake state
            // above is populated so OnboardingFlow can hydrate without
            // re-uploading anything that already exists.
            setResumeStep(result.user.onboardingStep ?? "name");
            setCurrentView("onboarding");
          } else {
            setResumeStep(null);
            // This effect re-runs whenever pathname changes (e.g. when the
            // admin leaves /admin/users back to "/"). Only set the default
            // landing view on the very first bootstrap; otherwise we'd race
            // against handleNavigate and bounce the user back to "chat"
            // when they meant to go to "transits", "report", etc.
            setCurrentView((prev) => (prev === "onboarding" ? "chat" : prev));
          }
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
    setResumeStep(null);
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
        return;
      }
      // No cached report yet. If the user already filled the required intake
      // fields during onboarding, generate the report directly instead of
      // making them re-fill the same form. They can still tweak it from
      // ReportView via "Editar mis respuestas".
      if (intake?.actividad?.trim() && intake?.desafio_actual?.trim()) {
        runGenerateReport();
        return;
      }
      handleNavigate("intake");
    } catch {
      handleNavigate("intake");
    }
  };

  const handleEditIntake = () => {
    handleNavigate("intake");
  };

  const handleGenerateReport = async (intakeData?: Intake) => {
    if (!user || !profile) return;

    if (report) {
      setPendingRegenerateIntake({ intake: intakeData });
      return;
    }

    runGenerateReport(intakeData);
  };

  const runGenerateReport = async (intakeData?: Intake) => {
    if (!user || !profile) return;

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
              fontWeight: 500,
              fontSize: 28,
              lineHeight: 1.15,
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
      {/* Onboarding */}
      {currentView === "onboarding" && (
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          resumeFrom={
            user && profile && resumeStep
              ? { user, profile, intake, initialStep: resumeStep }
              : undefined
          }
        />
      )}

      {/* Main app (after onboarding) */}
      {currentView !== "onboarding" && user && profile && (
        <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <NavBar
            currentView={currentView}
            supportRoute={adminSupportRoute?.kind ?? null}
            onNavigate={handleNavigate}
            onOpenSupportPanel={handleOpenAdminUsers}
            onOpenReport={handleGoToReport}
            userName={user.name}
            userPlan={user.plan}
            userRole={user.role}
            profile={profile}
            onReset={handleReset}
            onGenerateReport={handleGoToReport}
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
                        fontWeight: 500,
                        fontSize: 28,
                        lineHeight: 1.15,
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
                {currentView === "chat" && (
                  <ChatView
                    userName={user.name}
                    onOpenReport={handleGoToReport}
                    prefill={chatPrefill}
                    onPrefillConsumed={() => setChatPrefill(null)}
                  />
                )}
                {currentView === "transits" && (
                  <TransitViewer
                    profile={profile}
                    onAskAgent={(prefill) => {
                      setChatPrefill(prefill);
                      handleNavigate("chat");
                    }}
                  />
                )}
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

      <ConfirmModal
        open={pendingRegenerateIntake !== null}
        title="Regenerar tu informe"
        body="Esto va a reemplazar tu informe actual. ¿Querés continuar?"
        confirmLabel="Regenerar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          const data = pendingRegenerateIntake;
          setPendingRegenerateIntake(null);
          runGenerateReport(data?.intake);
        }}
        onCancel={() => setPendingRegenerateIntake(null)}
      />
    </div>
  );
}
