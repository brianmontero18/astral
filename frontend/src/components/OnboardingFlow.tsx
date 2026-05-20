import { useEffect, useRef, useState } from "react";
import type {
  AppUserOnboardingStep,
  UserProfile,
  LocalUser,
  Intake,
} from "../types";
import {
  bootstrapCurrentUser,
  patchOnboarding,
  PlacesTimeoutError,
  searchPlaces,
  submitBodygraphFromBirth,
  updateCurrentUser,
  type PlaceResult,
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

type Step = "welcome" | "name" | "birthData" | "calculating" | "review" | "intake";

// El backend persiste "upload" para representar "falta cargar/calcular bodygraph";
// el frontend renderiza ese estado con el step birthData (form de fecha/hora/lugar).
function toOnboardingStep(step: Step): AppUserOnboardingStep | null {
  switch (step) {
    case "name": return "name";
    case "birthData": return "upload";
    case "calculating": return "upload";
    case "review": return "review";
    case "intake": return "intake";
    case "welcome": return null;
  }
}

const STEP_ORDER: Step[] = ["name", "birthData", "review", "intake"];
const STEP_LABEL: Record<Step, string> = {
  welcome: "",
  name: "Empecemos",
  birthData: "Tu nacimiento",
  calculating: "Tu nacimiento",
  review: "Tu identidad",
  intake: "Tu contexto",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function formatPlaceLabel(p: PlaceResult): string {
  const parts = [p.name, p.admin1, p.country].filter((s) => s && s.length > 0);
  // Si admin1 duplica el name (capitales tipo Buenos Aires F.D.), evitar repetir.
  if (parts.length >= 2 && parts[1] === parts[0]) parts.splice(1, 1);
  return parts.join(", ");
}

export function OnboardingFlow({ onComplete, resumeFrom }: Props) {
  const isResume = !!resumeFrom;
  // Mapear el step persistido del backend al step interno (upload → birthData).
  const initialInternalStep: Step = resumeFrom
    ? (resumeFrom.initialStep === "upload" ? "birthData" : resumeFrom.initialStep)
    : "welcome";
  const [step, setStep] = useState<Step>(initialInternalStep);
  const [name, setName] = useState(resumeFrom?.user.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  // Birth-data form state
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeSlow, setPlaceSlow] = useState(false);
  const [placeTimedOut, setPlaceTimedOut] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const placeInputRef = useRef<HTMLInputElement>(null);
  const placeBoxRef = useRef<HTMLDivElement>(null);

  const [bootstrappedUser, setBootstrappedUser] = useState<LocalUser | null>(
    resumeFrom?.user ?? null,
  );
  const [extractedProfile, setExtractedProfile] = useState<UserProfile | null>(
    resumeFrom?.profile ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentStepIndex = step === "calculating"
    ? STEP_ORDER.indexOf("review")
    : STEP_ORDER.indexOf(step);
  const showStepIndicator = step !== "welcome";

  // ─── Places autocomplete: debounce 250ms + slow signal a los 2.5s + timeout 30s.
  useEffect(() => {
    if (selectedPlace && placeQuery === formatPlaceLabel(selectedPlace)) {
      return;
    }
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaceResults([]);
      setPlaceTimedOut(false);
      setPlaceSlow(false);
      return;
    }
    const callerCtrl = new AbortController();
    let cancelled = false;
    let slowTimer: number | undefined;
    const debounceTimer = window.setTimeout(async () => {
      setPlaceLoading(true);
      setPlaceTimedOut(false);
      setPlaceSlow(false);
      slowTimer = window.setTimeout(() => {
        if (!cancelled) setPlaceSlow(true);
      }, 2500);
      try {
        const results = await searchPlaces(q, { signal: callerCtrl.signal });
        if (!cancelled) {
          setPlaceResults(results);
          setPlaceOpen(true);
          setPlaceError(null);
          setPlaceTimedOut(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof PlacesTimeoutError) {
          setPlaceTimedOut(true);
          setPlaceError(null);
        } else if (!(err instanceof DOMException && err.name === "AbortError")) {
          setPlaceError(err instanceof Error ? err.message : String(err));
        }
        setPlaceResults([]);
      } finally {
        if (!cancelled) {
          setPlaceLoading(false);
          setPlaceSlow(false);
        }
        if (slowTimer !== undefined) window.clearTimeout(slowTimer);
      }
    }, 250);
    return () => {
      cancelled = true;
      callerCtrl.abort();
      window.clearTimeout(debounceTimer);
      if (slowTimer !== undefined) window.clearTimeout(slowTimer);
    };
  }, [placeQuery, selectedPlace]);

  // Cerrar el dropdown si el click va afuera.
  useEffect(() => {
    if (!placeOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!placeBoxRef.current) return;
      if (!placeBoxRef.current.contains(ev.target as Node)) {
        setPlaceOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [placeOpen]);

  const handleNameContinue = async () => {
    if (!name.trim()) {
      setNameError("Necesitamos saber cómo llamarte para empezar.");
      return;
    }
    setNameError(null);
    if (isResume) {
      try {
        await patchOnboarding({ name: name.trim(), step: toOnboardingStep("birthData") });
      } catch (e) {
        setError(getOnboardingFailureMessage(e));
        return;
      }
    }
    setStep("birthData");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (nameError) setNameError(null);
  };

  const handlePlacePick = (p: PlaceResult) => {
    setSelectedPlace(p);
    setPlaceQuery(formatPlaceLabel(p));
    setPlaceResults([]);
    setPlaceOpen(false);
    setPlaceError(null);
  };

  const handlePlaceInputChange = (value: string) => {
    setPlaceQuery(value);
    if (selectedPlace && value !== formatPlaceLabel(selectedPlace)) {
      setSelectedPlace(null);
    }
    setError(null);
  };

  const handleSubmitBirthData = () => {
    if (!DATE_RE.test(birthDate)) {
      setError("Ingresá una fecha válida (formato YYYY-MM-DD).");
      return;
    }
    if (!TIME_RE.test(birthTime)) {
      setError("Ingresá una hora válida (formato HH:mm 24h).");
      return;
    }
    if (!selectedPlace) {
      setError("Elegí un lugar de la lista para que podamos resolver tu zona horaria.");
      return;
    }
    handleCompute();
  };

  const handleCompute = async () => {
    if (!selectedPlace) return;
    setStep("calculating");
    setError(null);
    setLoading(true);

    try {
      if (!isResume) {
        // Legacy self-signup: bootstrap el users row con placeholder antes
        // de calcular. Resume mode skips this — el row ya existe.
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

      const { user: currentUser, profile } = await submitBodygraphFromBirth({
        name: name.trim() || undefined,
        date: birthDate,
        time: birthTime,
        place: {
          lat: selectedPlace.lat,
          lon: selectedPlace.lon,
          label: formatPlaceLabel(selectedPlace),
        },
      });

      if (isResume) {
        await patchOnboarding({ step: "review" });
      }

      setBootstrappedUser({
        id: currentUser.id,
        name: currentUser.name,
        plan: currentUser.plan,
        role: currentUser.role,
        status: currentUser.status,
      });
      setExtractedProfile(profile);
      setStep("review");
    } catch (e) {
      setError(getOnboardingFailureMessage(e));
      setStep("birthData");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!bootstrappedUser || !extractedProfile) return;
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
        await patchOnboarding({ intake, complete: true });
      } else {
        await updateCurrentUser(extractedProfile.name, extractedProfile, intake);
      }
      onComplete(bootstrappedUser, extractedProfile);
    } catch (e) {
      setError(getOnboardingFailureMessage(e));
      throw e;
    }
  };

  const handleRetry = () => {
    setBootstrappedUser(null);
    setExtractedProfile(null);
    setError(null);
    setStep("birthData");
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
            <div style={{ color: "var(--color-primary)", fontSize: 10, letterSpacing: "0.20em", fontFamily: "var(--font-sans)", fontWeight: 700, marginBottom: 16, textTransform: "uppercase" }}>
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

        {/* Step: Birth data */}
        {step === "birthData" && (
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
            <div style={{ color: "var(--color-primary)", fontSize: 10, letterSpacing: "0.20em", fontFamily: "var(--font-sans)", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", textAlign: "center" }}>
              Tu nacimiento
            </div>
            <h2 style={{ color: "var(--text-main)", fontSize: "28px", marginBottom: "12px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 500, lineHeight: 1.15 }}>
              Coordenadas de tu carta
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "28px", fontWeight: 400, lineHeight: 1.6 }}>
              Tu Diseño Humano se calcula desde el momento exacto y el lugar en que naciste.
            </p>

            {error && (
              <div className="onboarding-inline-error" style={{ marginBottom: 20 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
              <BirthField label="Fecha de nacimiento">
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => { setBirthDate(e.target.value); setError(null); }}
                  className="onboarding-birth-input"
                  max={new Date().toISOString().slice(0, 10)}
                />
              </BirthField>

              <BirthField label="Hora local">
                <input
                  type="time"
                  value={birthTime}
                  onChange={(e) => { setBirthTime(e.target.value); setError(null); }}
                  className="onboarding-birth-input"
                />
              </BirthField>

              <BirthField label="Lugar de nacimiento">
                <div ref={placeBoxRef} style={{ position: "relative" }}>
                  <input
                    ref={placeInputRef}
                    type="text"
                    value={placeQuery}
                    onChange={(e) => handlePlaceInputChange(e.target.value)}
                    onFocus={() => { if (placeResults.length > 0) setPlaceOpen(true); }}
                    placeholder="Empezá a escribir (ej. Buenos Aires, Bogotá...)"
                    className="onboarding-birth-input"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {placeLoading && !placeSlow && (
                    <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-sans)" }}>
                      buscando…
                    </div>
                  )}
                  {placeLoading && placeSlow && (
                    <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-sans)" }}>
                      Está tardando más de lo normal… seguimos buscando.
                    </div>
                  )}
                  {placeTimedOut && (
                    <div className="onboarding-inline-error" style={{ marginTop: 8, fontSize: 13 }}>
                      La búsqueda tardó demasiado. Probá de nuevo en un momento.
                    </div>
                  )}
                  {placeOpen && placeResults.length > 0 && (
                    <ul
                      role="listbox"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        right: 0,
                        background: "var(--surface-deeper)",
                        border: "1px solid rgba(248, 244, 232, 0.1)",
                        borderRadius: 10,
                        padding: 6,
                        margin: 0,
                        listStyle: "none",
                        maxHeight: 240,
                        overflowY: "auto",
                        zIndex: 10,
                        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
                      }}
                    >
                      {placeResults.map((p) => (
                        <li key={p.geonameId}>
                          <button
                            type="button"
                            onClick={() => handlePlacePick(p)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              background: "transparent",
                              border: "none",
                              color: "var(--text-main)",
                              padding: "10px 12px",
                              borderRadius: 6,
                              fontFamily: "var(--font-sans)",
                              fontSize: 14,
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248, 244, 232, 0.06)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                          >
                            <span style={{ fontFamily: "var(--font-serif)", fontSize: 15 }}>{p.name}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                              {[p.admin1, p.country].filter(Boolean).join(", ")}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {placeError && (
                    <div className="onboarding-inline-error" style={{ marginTop: 8, fontSize: 13 }}>
                      No pudimos buscar lugares ahora. Intentá de nuevo en un momento.
                    </div>
                  )}
                  {!placeError && !placeLoading && !selectedPlace && placeQuery.trim().length >= 2 && placeResults.length === 0 && (
                    <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-sans)" }}>
                      No encontramos ese lugar. Probá con otro nombre o ortografía.
                    </div>
                  )}
                </div>
              </BirthField>
            </div>

            <button
              onClick={handleSubmitBirthData}
              className="astral-auth-primary"
              style={{ width: "100%" }}
            >
              Calcular mi carta
            </button>
            <div className="onboarding-secondary-row">
              <button
                type="button"
                onClick={() => { setError(null); setStep("name"); }}
                className="astral-auth-text-link"
              >
                ← Volver
              </button>
            </div>
          </div>
        )}

        {/* Step: Calculating */}
        {step === "calculating" && (
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
              Calculando tu carta…
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 400, lineHeight: 1.6 }}>
              Sincronizando coordenadas astronómicas con tu Diseño Humano.
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
            <div style={{ color: "var(--color-primary)", fontSize: 10, letterSpacing: "0.20em", fontFamily: "var(--font-sans)", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", textAlign: "center" }}>
              Tu identidad
            </div>
            <h2 style={{ color: "var(--text-main)", fontSize: "28px", marginBottom: "12px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 500, lineHeight: 1.15 }}>
              Esto es lo que calculamos
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "28px", fontWeight: 400, lineHeight: 1.6 }}>
              Revisá los datos derivados de tu nacimiento. Si algo no cierra, volvé y ajustá las coordenadas.
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
              {extractedProfile.birthData?.dateLocalIso && (
                <ProfileField
                  label="Encarnación"
                  value={`${birthDate || extractedProfile.birthData.dateLocalIso.slice(0, 10)}, ${birthTime || ""} — ${extractedProfile.birthData.placeLabel || ""}`}
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
              <button onClick={handleRetry} className="astral-auth-secondary" style={{ flex: 1 }} disabled={loading}>
                Ajustar datos
              </button>
              <button onClick={handleConfirm} className="astral-auth-primary" style={{ flex: 2 }} disabled={loading}>
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

function BirthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          color: "var(--text-muted)",
          fontFamily: "var(--font-sans)",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
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
