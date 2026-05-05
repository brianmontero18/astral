import { useState, useRef } from "react";
import type {
  AppUserOnboardingStep,
  UserProfile,
  LocalUser,
  Intake,
} from "../types";
import {
  uploadAsset,
  extractProfile,
  bootstrapCurrentUser,
  getCurrentUser,
  patchOnboarding,
  updateCurrentUser,
} from "../api";
import { getOnboardingFailureMessage } from "../onboarding-errors";
import { ChannelChips } from "./ChannelChips";
import { IntakeView } from "./IntakeView";

interface ResumeContext {
  user: LocalUser;
  profile: UserProfile;
  intake: Intake | undefined;
  initialStep: AppUserOnboardingStep;
}

interface Props {
  onComplete: (user: LocalUser, profile: UserProfile) => void;
  /**
   * When provided, the flow runs in "resume" mode: the users row already
   * exists (admin invite or mid-flow self-signup), so the wizard skips the
   * legacy bootstrap call and persists each step via PATCH /api/me/onboarding.
   * When absent, behaviour is the legacy atomic bootstrap (POST /users).
   */
  resumeFrom?: ResumeContext;
}

type Step = "welcome" | "name" | "upload" | "extracting" | "review" | "intake";

interface FileSlot {
  file: File | null;
  label: string;
  type: string;
}

const STEP_ORDER: Step[] = ["name", "upload", "review", "intake"];
const STEP_LABEL: Record<Step, string> = {
  welcome: "",
  name: "Empecemos",
  upload: "Tu carta",
  extracting: "Tu carta",
  review: "Tu identidad",
  intake: "Tu contexto",
};

export function OnboardingFlow({ onComplete, resumeFrom }: Props) {
  const isResume = !!resumeFrom;
  const [step, setStep] = useState<Step>(
    resumeFrom ? resumeFrom.initialStep : "welcome",
  );
  const [name, setName] = useState(resumeFrom?.user.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [slot, setSlot] = useState<FileSlot>({ file: null, label: "Carta de Diseño Humano", type: "hd" });
  const [bootstrappedUser, setBootstrappedUser] = useState<LocalUser | null>(
    resumeFrom?.user ?? null,
  );
  const [extractedProfile, setExtractedProfile] = useState<UserProfile | null>(
    resumeFrom?.profile ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasFile = !!slot.file;
  const currentStepIndex = step === "extracting" ? STEP_ORDER.indexOf("review") : STEP_ORDER.indexOf(step);
  const showStepIndicator = step !== "welcome";

  const handleFileChange = (file: File | null) => {
    setError(null);
    setSlot((prev) => ({ ...prev, file }));
  };

  const handleNameContinue = async () => {
    if (!name.trim()) {
      setNameError("Necesitamos saber cómo llamarte para empezar.");
      return;
    }
    setNameError(null);
    if (isResume) {
      try {
        await patchOnboarding({ name: name.trim(), step: "upload" });
      } catch (e) {
        setError(getOnboardingFailureMessage(e));
        return;
      }
    }
    setStep("upload");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (nameError) setNameError(null);
  };

  const handleSubmitUpload = () => {
    if (!hasFile) {
      setError("Subí tu PDF para canalizar tu energía.");
      return;
    }
    handleExtract();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Solo aceptamos PDF exportado desde MyHumanDesign o Genetic Matrix.");
      return;
    }
    handleFileChange(file);
  };

  const handleExtract = async () => {
    setStep("extracting");
    setError(null);
    setLoading(true);

    try {
      if (!isResume) {
        // Legacy self-signup path: the users row does not exist yet, so
        // we have to bootstrap it before uploading and extracting. Resume
        // mode skips this — the row was created by POST /api/admin/users.
        const tempProfile: UserProfile = {
          name,
          humanDesign: {
            type: "", strategy: "", authority: "", profile: "", definition: "",
            incarnationCross: "", notSelfTheme: "", variable: "",
            digestion: "", environment: "", strongestSense: "",
            channels: [], activatedGates: [], definedCenters: [], undefinedCenters: [],
          },
        };
        await bootstrapCurrentUser(name, tempProfile);
      }
      const assetIds: string[] = [];

      if (slot.file) {
        const result = await uploadAsset(slot.file, slot.type);
        assetIds.push(result.id);
      }

      const { profile } = await extractProfile(assetIds);
      profile.name = profile.name || name;

      if (isResume) {
        await patchOnboarding({ profile, step: "review" });
      } else {
        await updateCurrentUser(profile.name, profile);
      }

      const currentUser = await getCurrentUser();
      if (currentUser.kind !== "linked") {
        throw new Error("No se pudo resolver el usuario actual después del bootstrap.");
      }

      setBootstrappedUser({
        id: currentUser.user.id,
        name: currentUser.user.name,
        plan: currentUser.user.plan,
        role: currentUser.user.role,
        status: currentUser.user.status,
      });
      setExtractedProfile(currentUser.user.profile);

      setStep("review");
    } catch (e) {
      setError(getOnboardingFailureMessage(e));
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!bootstrappedUser || !extractedProfile) return;
    // Bridge to the intake step before handing off to the chat. The bodygraph
    // is the cold/technical artifact; the intake is where the user tells us
    // about their business so chat answers stop being generic from turn 1.
    if (isResume) {
      try {
        await patchOnboarding({ step: "intake" });
      } catch (e) {
        setError(getOnboardingFailureMessage(e));
        return;
      }
    }
    setStep("intake");
  };

  const handleIntakeSubmit = async (intake: Intake) => {
    if (!bootstrappedUser || !extractedProfile) return;
    setError(null);
    try {
      if (isResume) {
        // Atomic: persist intake + flip onboarding_status to 'complete' so
        // the next bootstrap routes straight to chat.
        await patchOnboarding({ intake, complete: true });
      } else {
        await updateCurrentUser(extractedProfile.name, extractedProfile, intake);
      }
      onComplete(bootstrappedUser, extractedProfile);
    } catch (e) {
      // Re-throw so IntakeView re-enables the form for retry; the error UI
      // above the form is hydrated from `error` state.
      setError(getOnboardingFailureMessage(e));
      throw e;
    }
  };

  const handleRetry = () => {
    setBootstrappedUser(null);
    setExtractedProfile(null);
    setError(null);
    setStep("upload");
  };

  return (
    <div className="onboarding-shell">
      <header className="onboarding-shell-header">
        <span className="onboarding-shell-wordmark">Astral Guide</span>
        {showStepIndicator && (
          <div
            className="onboarding-step-indicator"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEP_ORDER.length}
            aria-valuenow={Math.max(currentStepIndex + 1, 1)}
            aria-label={`${STEP_LABEL[step]} — paso ${Math.max(currentStepIndex + 1, 1)} de ${STEP_ORDER.length}`}
          >
            {STEP_ORDER.map((_, i) => (
              <span
                key={i}
                className={
                  "onboarding-step-dot" +
                  (i === currentStepIndex ? " is-active" : "") +
                  (i < currentStepIndex ? " is-done" : "")
                }
              />
            ))}
          </div>
        )}
      </header>
      <div className="onboarding-shell-stage">
        <div
          className="onboarding-shell-portal"
          style={{
            maxWidth: step === "intake" ? 760 : step === "review" ? 600 : 520,
            width: "100%",
            height: step === "intake" ? "100%" : "auto",
            minHeight: 0,
            display: step === "intake" ? "flex" : "block",
            flexDirection: "column",
            animation: "fadeIn 0.5s ease",
          }}
        >
        {/* Step: Welcome */}
        {step === "welcome" && (
          <div
            style={{
              textAlign: "center",
              background: "var(--surface-dark)",
              border: "1px solid rgba(33, 41, 30, 0.4)",
              borderRadius: 24,
              padding: "44px 36px",
              boxShadow: "0 24px 56px rgba(33, 41, 30, 0.22)",
              color: "var(--text-main)",
            }}
            className="animate-fade-in"
          >
            <div
              aria-hidden="true"
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 28px",
                borderRadius: "50%",
                background: "var(--surface-deeper)",
                border: "1px solid var(--color-gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-gold)",
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                fontWeight: 500,
                lineHeight: 1,
              }}
            >
              ✦
            </div>
            <h1 style={{
              color: "var(--text-main)",
              fontSize: "40px",
              marginBottom: "16px",
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              letterSpacing: "0.04em",
              lineHeight: 1.05,
            }}>
              Astral Guide
            </h1>
            <p style={{
              color: "var(--text-muted)",
              fontSize: "15px",
              lineHeight: 1.7,
              marginBottom: "40px",
              fontWeight: 400,
            }}>
              Tu brújula de Diseño Humano.
              <br />
              Sincroniza tus tránsitos reales con tu esencia.
            </p>
            <button onClick={() => setStep("name")} className="astral-auth-primary" style={{ width: "100%" }}>
              Descubrir mi carta
            </button>
          </div>
        )}

        {/* Step: Name */}
        {step === "name" && (
          <div
            style={{
              textAlign: "center",
              background: "var(--surface-dark)",
              border: "1px solid rgba(33, 41, 30, 0.4)",
              borderRadius: 24,
              padding: "44px 36px",
              boxShadow: "0 24px 56px rgba(33, 41, 30, 0.22)",
              color: "var(--text-main)",
            }}
            className="animate-fade-in"
          >
            <div style={{ color: "var(--color-primary)", fontSize: 11, letterSpacing: "0.24em", fontFamily: "var(--font-sans)", fontWeight: 700, marginBottom: 16, textTransform: "uppercase" }}>
              Empecemos
            </div>
            <h2 style={{
              color: "var(--text-main)",
              fontSize: "28px",
              marginBottom: "32px",
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
            }}>
              ¿Cómo querés que te llamemos?
            </h2>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleNameContinue();
                }
              }}
              placeholder="Tu nombre"
              autoFocus
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "onboarding-name-error" : undefined}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${nameError ? "rgba(196, 96, 96, 0.55)" : "rgba(248, 244, 232, 0.3)"}`,
                padding: "16px 0",
                color: "var(--text-main)",
                fontSize: "24px",
                fontFamily: "var(--font-serif)",
                textAlign: "center",
                outline: "none",
                marginBottom: nameError ? "12px" : "40px",
                transition: "border-color 0.3s ease",
              }}
              onFocus={(e) => {
                if (!nameError) e.target.style.borderBottom = "1px solid var(--color-primary)";
              }}
              onBlur={(e) => {
                if (!nameError) e.target.style.borderBottom = "1px solid rgba(248, 244, 232, 0.3)";
              }}
            />
            {nameError && (
              <div id="onboarding-name-error" role="alert" className="onboarding-inline-error">
                {nameError}
              </div>
            )}
            <button
              onClick={handleNameContinue}
              className="astral-auth-primary"
              style={{ width: "100%" }}
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step: Upload */}
        {step === "upload" && (
          <div
            className="animate-fade-in"
            style={{
              background: "var(--surface-dark)",
              border: "1px solid rgba(33, 41, 30, 0.4)",
              borderRadius: 24,
              padding: "36px 32px",
              boxShadow: "0 24px 56px rgba(33, 41, 30, 0.22)",
              color: "var(--text-main)",
            }}
          >
            <div style={{ color: "var(--color-primary)", fontSize: 11, letterSpacing: "0.24em", fontFamily: "var(--font-sans)", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", textAlign: "center" }}>
              Tu carta
            </div>
            <h2 style={{ color: "var(--text-main)", fontSize: "26px", marginBottom: "12px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 500 }}>
              Sincronizá tu energía
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "28px", fontWeight: 400, lineHeight: 1.6 }}>
              Subí el gráfico de Diseño Humano para sintonizar el reporte a tu esencia.
            </p>

            {error && (
              <div className="onboarding-inline-error" style={{ marginBottom: "20px" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                aria-label={slot.file ? `Archivo seleccionado: ${slot.file.name}. Hacé clic para reemplazar.` : "Subí tu PDF de Diseño Humano"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileRef.current?.click();
                  }
                }}
                className={
                  "onboarding-dropzone" +
                  (slot.file ? " has-file" : "") +
                  (isDragging ? " is-dragging" : "")
                }
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  style={{
                    position: "absolute",
                    width: 0,
                    height: 0,
                    opacity: 0,
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                />
                <div className="onboarding-dropzone-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4" />
                    <path d="M6 10l6-6 6 6" />
                    <path d="M4 20h16" />
                  </svg>
                </div>
                <div className="onboarding-dropzone-label">{slot.label}</div>
                <div className="onboarding-dropzone-hint">
                  {slot.file
                    ? slot.file.name
                    : isDragging
                      ? "Soltá tu archivo aquí"
                      : "Arrastrá tu PDF o hacé clic para elegirlo"}
                </div>
              </div>
              <div className="onboarding-dropzone-meta">PDF de MyHumanDesign o Genetic Matrix · Hasta 10 MB</div>
            </div>

            <button
              onClick={handleSubmitUpload}
              className="astral-auth-primary"
              style={{ width: "100%" }}
            >
              Canalizar energía
            </button>
            <div className="onboarding-secondary-row">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep("name");
                }}
                className="astral-auth-text-link"
              >
                ← Volver
              </button>
            </div>
          </div>
        )}

        {/* Step: Extracting */}
        {step === "extracting" && (
          <div
            style={{
              textAlign: "center",
              background: "var(--surface-dark)",
              border: "1px solid rgba(33, 41, 30, 0.4)",
              borderRadius: 24,
              padding: "48px 32px",
              boxShadow: "0 24px 56px rgba(33, 41, 30, 0.22)",
              color: "var(--text-main)",
            }}
            className="animate-fade-in-slow"
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: "2px solid rgba(207, 172, 108, 0.18)",
                borderTopColor: "var(--color-gold)",
                animation: "spin 1.2s linear infinite",
                margin: "0 auto 28px",
              }}
            />
            <h2 style={{ color: "var(--text-main)", fontSize: "22px", marginBottom: "12px", fontFamily: "var(--font-serif)", fontWeight: 500 }}>
              Leyendo tu carta...
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 400, lineHeight: 1.6 }}>
              Nuestro motor está extrayendo tu Diseño Humano.
            </p>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && extractedProfile && (
          <div
            className="animate-fade-in"
            style={{
              background: "var(--surface-dark)",
              border: "1px solid rgba(33, 41, 30, 0.4)",
              borderRadius: 24,
              padding: "36px 32px",
              boxShadow: "0 24px 56px rgba(33, 41, 30, 0.22)",
              color: "var(--text-main)",
            }}
          >
            <div style={{ color: "var(--color-primary)", fontSize: 11, letterSpacing: "0.24em", fontFamily: "var(--font-sans)", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", textAlign: "center" }}>
              Tu identidad
            </div>
            <h2 style={{ color: "var(--text-main)", fontSize: "26px", marginBottom: "12px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 500 }}>
              Esto es lo que leímos
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "28px", fontWeight: 400, lineHeight: 1.6 }}>
              Revisá los datos extraídos. Si algo no cierra, volvé y subí otra carta.
            </p>

            <div className="profile-grid">
              <ProfileField label="Nombre" value={extractedProfile.name} />
              <ProfileField label="Tipo HD" value={extractedProfile.humanDesign.type} />
              <ProfileField label="Estrategia" value={extractedProfile.humanDesign.strategy} />
              <ProfileField label="Autoridad" value={extractedProfile.humanDesign.authority} />
              <ProfileField label="Perfil" value={extractedProfile.humanDesign.profile} />
              <ProfileField label="Definición" value={extractedProfile.humanDesign.definition} />
              {extractedProfile.humanDesign.digestion && (
                <ProfileField label="Digestión" value={extractedProfile.humanDesign.digestion} />
              )}
            </div>

            <div className="profile-wide">
              {extractedProfile.birthData?.date && (
                <ProfileField
                  label="Encarnación"
                  value={`${extractedProfile.birthData.date}, ${extractedProfile.birthData.time || ""} — ${extractedProfile.birthData.location || ""}`}
                />
              )}
              <ProfileField label="Cruz" value={extractedProfile.humanDesign.incarnationCross} />
              <div className="profile-field">
                <span className="profile-label">Canales</span>
                {extractedProfile.humanDesign.channels.length > 0 ? (
                  <ChannelChips
                    channels={extractedProfile.humanDesign.channels.map((c) => c.name)}
                    size="sm"
                  />
                ) : (
                  <span className="profile-value">—</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: 28 }}>
              <button onClick={handleRetry} className="astral-auth-secondary" style={{ flex: 1 }}>
                Volver
              </button>
              <button onClick={handleConfirm} className="astral-auth-primary" style={{ flex: 2 }}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step: Intake (business context) */}
        {step === "intake" && (
          <div className="animate-fade-in" style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {error && (
              <div
                style={{
                  borderRadius: 10,
                  padding: "12px 16px",
                  marginBottom: 20,
                  background: "rgba(196, 96, 96, 0.14)",
                  border: "1px solid rgba(196, 96, 96, 0.4)",
                  color: "#9a3737",
                  fontSize: 13,
                  lineHeight: 1.55,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}
            <IntakeView
              submitLabel="Embarcar al chat"
              description="Dos campos para que las respuestas lleguen específicas desde el primer mensaje. Los demás te ayudan a profundizar."
              secondaryAction={{
                label: "Volver",
                onClick: () => {
                  setError(null);
                  setStep("review");
                },
              }}
              onSubmit={handleIntakeSubmit}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <span className="profile-label">{label}</span>
      <span className="profile-value">{value || "—"}</span>
    </div>
  );
}
