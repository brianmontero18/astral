import { useState, useRef } from "react";
import type { UserProfile, LocalUser, Intake } from "../types";
import {
  uploadAsset,
  extractProfile,
  bootstrapCurrentUser,
  getCurrentUser,
  updateCurrentUser,
} from "../api";
import { getOnboardingFailureMessage } from "../onboarding-errors";
import { ChannelChips } from "./ChannelChips";
import { IntakeView } from "./IntakeView";

interface Props {
  onComplete: (user: LocalUser, profile: UserProfile) => void;
}

type Step = "welcome" | "name" | "upload" | "extracting" | "review" | "intake";

interface FileSlot {
  file: File | null;
  label: string;
  type: string;
}

export function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<FileSlot>({ file: null, label: "Carta de Diseño Humano", type: "hd" });
  const [bootstrappedUser, setBootstrappedUser] = useState<LocalUser | null>(null);
  const [extractedProfile, setExtractedProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasFile = !!slot.file;

  const handleFileChange = (file: File | null) => {
    setSlot((prev) => ({ ...prev, file }));
  };

  const handleExtract = async () => {
    setStep("extracting");
    setError(null);
    setLoading(true);

    try {
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
      const assetIds: string[] = [];

      if (slot.file) {
        const result = await uploadAsset(slot.file, slot.type);
        assetIds.push(result.id);
      }

      const { profile } = await extractProfile(assetIds);
      profile.name = profile.name || name;

      await updateCurrentUser(profile.name, profile);

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

  const handleConfirm = () => {
    if (bootstrappedUser && extractedProfile) {
      // Bridge to the intake step before handing off to the chat. The bodygraph
      // is the cold/technical artifact; the intake is where the user tells us
      // about their business so chat answers stop being generic from turn 1.
      setStep("intake");
    }
  };

  const handleIntakeSubmit = async (intake: Intake) => {
    if (!bootstrappedUser || !extractedProfile) return;
    setLoading(true);
    setError(null);
    try {
      await updateCurrentUser(extractedProfile.name, extractedProfile, intake);
      onComplete(bootstrappedUser, extractedProfile);
    } catch (e) {
      setError(getOnboardingFailureMessage(e));
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setBootstrappedUser(null);
    setExtractedProfile(null);
    setError(null);
    setStep("upload");
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          animation: "fadeIn 0.5s ease",
        }}
      >
        {/* Step: Welcome */}
        {step === "welcome" && (
          <div style={{ textAlign: "center" }} className="animate-fade-in">
            <div style={{ 
              width: 80, height: 80, margin: "0 auto 32px",
              background: "radial-gradient(circle at 30% 30%, #D4AF37, #C5A059, transparent)",
              borderRadius: "50%",
              boxShadow: "0 0 30px rgba(212,175,55,0.2)",
              animation: "spin 20s linear infinite",
            }} />
            <h1 style={{ 
              color: "var(--text-main)", 
              fontSize: "42px", 
              marginBottom: "16px", 
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              letterSpacing: "0.05em"
            }}>
              Astral Guide
            </h1>
            <p style={{ 
              color: "var(--text-muted)", 
              fontSize: "15px", 
              lineHeight: 1.8, 
              marginBottom: "48px",
              fontWeight: 300
            }}>
              Tu brújula de Diseño Humano.
              <br />
              Sincroniza tus tránsitos reales con tu esencia.
            </p>
            <button onClick={() => setStep("name")} className="btn-primary" style={{width: "100%"}}>
              DESCUBRIR MI CARTA
            </button>
          </div>
        )}

        {/* Step: Name */}
        {step === "name" && (
          <div style={{ textAlign: "center" }} className="animate-fade-in">
            <div style={{ color: "var(--color-primary)", fontSize: "24px", marginBottom: "24px" }}>✦</div>
            <h2 style={{ 
              color: "var(--text-main)", 
              fontSize: "28px", 
              marginBottom: "40px", 
              fontFamily: "var(--font-serif)",
              fontWeight: 400
            }}>
              ¿Cómo debemos llamarte?
            </h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep("upload")}
              placeholder="Tu nombre"
              autoFocus
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--glass-border)",
                padding: "16px 0",
                color: "var(--color-primary)",
                fontSize: "24px",
                fontFamily: "var(--font-serif)",
                textAlign: "center",
                outline: "none",
                marginBottom: "48px",
                transition: "border-color 0.3s ease"
              }}
              onFocus={(e) => e.target.style.borderBottom = "1px solid var(--color-primary-dim)"}
              onBlur={(e) => e.target.style.borderBottom = "1px solid var(--glass-border)"}
            />
            <button
              onClick={() => setStep("upload")}
              disabled={!name.trim()}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              CONTINUAR
            </button>
          </div>
        )}

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="animate-fade-in">
            <h2 style={{ color: "var(--text-main)", fontSize: "26px", marginBottom: "12px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 400 }}>
              Sincroniza tu energía
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "32px", fontWeight: 300 }}>
              Sube tu gráfico de Diseño Humano para sintonizar el reporte a tu esencia.<br/>
              Solo PDF exportado desde MyHumanDesign o Genetic Matrix.
            </p>

            {error && (
              <div className="glass-panel" style={{
                borderColor: "rgba(201,107,122,0.3)", padding: "14px 18px",
                color: "#f0a0b0", fontSize: "13px", marginBottom: "24px", textAlign: "center"
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "40px" }}>
              <div
                onClick={() => fileRef.current?.click()}
                className={slot.file ? "glass-panel-gold" : "glass-panel"}
                style={{
                  padding: "32px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
                onMouseOver={(e) => {
                  if (!slot.file) e.currentTarget.style.borderColor = "var(--color-primary-dim)";
                }}
                onMouseOut={(e) => {
                  if (!slot.file) e.currentTarget.style.borderColor = "var(--glass-border)";
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                />
                <div style={{
                  fontSize: "24px",
                  marginBottom: "16px",
                  color: slot.file ? "var(--color-primary)" : "var(--text-muted)",
                  opacity: slot.file ? 1 : 0.5
                }}>
                  {slot.file ? "✦" : "⚝"}
                </div>
                <div style={{
                  color: slot.file ? "var(--text-gold)" : "var(--text-main)",
                  fontSize: "14px",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase"
                }}>
                  {slot.label}
                </div>
                <div style={{ color: "var(--text-faint)", fontSize: "12px", marginTop: "8px" }}>
                  {slot.file ? slot.file.name : "Tap para transferir archivo"}
                </div>
              </div>
            </div>

            <button
              onClick={handleExtract}
              disabled={!hasFile}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              CANALIZAR ENERGÍA
            </button>
          </div>
        )}

        {/* Step: Extracting */}
        {step === "extracting" && (
          <div style={{ textAlign: "center" }} className="animate-fade-in-slow">
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: "2px solid var(--color-primary-faint)",
                borderTopColor: "var(--color-primary)",
                borderRightColor: "var(--color-primary-dim)",
                animation: "spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite",
                margin: "0 auto 32px",
              }}
            />
            <h2 style={{ color: "var(--text-main)", fontSize: "24px", marginBottom: "12px", fontFamily: "var(--font-serif)" }}>
              Descifrando tu código estelar...
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 300 }}>
              Nuestra IA está leyendo tus mapas en profundidad.
            </p>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && extractedProfile && (
          <div className="animate-fade-in">
            <h2 style={{ color: "var(--text-main)", fontSize: "26px", marginBottom: "32px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 400 }}>
              Tu Identidad Cósmica
            </h2>

            <div
              className="glass-panel"
              style={{
                padding: "24px",
                marginBottom: "32px",
                maxHeight: "45vh",
                overflowY: "auto",
              }}
            >
              <ProfileField label="Nombre" value={extractedProfile.name} />
              {extractedProfile.birthData?.date && (
                <ProfileField label="Encarnación" value={`${extractedProfile.birthData.date}, ${extractedProfile.birthData.time || ""} — ${extractedProfile.birthData.location || ""}`} />
              )}
              <ProfileField label="Tipo HD" value={extractedProfile.humanDesign.type} />
              <ProfileField label="Estrategia" value={extractedProfile.humanDesign.strategy} />
              <ProfileField label="Autoridad" value={extractedProfile.humanDesign.authority} />
              <ProfileField label="Perfil" value={extractedProfile.humanDesign.profile} />
              <ProfileField label="Definición" value={extractedProfile.humanDesign.definition} />
              <ProfileField label="Cruz" value={extractedProfile.humanDesign.incarnationCross} />
              {extractedProfile.humanDesign.digestion && (
                <ProfileField label="Digestión" value={extractedProfile.humanDesign.digestion} />
              )}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid rgba(255,255,255,0.03)"
              }}>
                <span style={{ color: "var(--text-faint)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Canales
                </span>
                {extractedProfile.humanDesign.channels.length > 0 ? (
                  <div style={{ maxWidth: "65%" }}>
                    <ChannelChips
                      channels={extractedProfile.humanDesign.channels.map((c) => c.name)}
                      size="sm"
                      align="end"
                    />
                  </div>
                ) : (
                  <span style={{ color: "var(--text-main)", fontSize: "14px", fontFamily: "var(--font-serif)" }}>—</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <button onClick={handleRetry} className="btn-secondary" style={{ flex: 1 }}>
                REVERTIR
              </button>
              <button onClick={handleConfirm} className="btn-primary" style={{ flex: 2 }}>
                CONTINUAR
              </button>
            </div>
          </div>
        )}

        {/* Step: Intake (business context) */}
        {step === "intake" && (
          <div className="animate-fade-in" style={{ width: "100%" }}>
            {error && (
              <div
                className="glass-panel"
                style={{
                  borderColor: "rgba(201,107,122,0.3)",
                  padding: "14px 18px",
                  color: "#f0a0b0",
                  fontSize: "13px",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}
            <IntakeView
              submitLabel="Embarcar al chat"
              description="Antes de cruzar tu diseño con los tránsitos de la semana, necesitamos un poco de contexto sobre tu negocio. Lo mínimo (los dos campos con *) hace que las respuestas sean específicas desde el primer mensaje."
              onSubmit={handleIntakeSubmit}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: "1px solid rgba(255,255,255,0.03)"
    }}>
      <span style={{ color: "var(--text-faint)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ color: "var(--text-main)", fontSize: "14px", fontFamily: "var(--font-serif)" }}>{value || "—"}</span>
    </div>
  );
}
