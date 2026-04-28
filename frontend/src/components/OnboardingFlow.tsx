import { useState, useRef } from "react";
import type { UserProfile, LocalUser } from "../types";
import {
  uploadAsset,
  extractProfile,
  bootstrapCurrentUser,
  getCurrentUser,
  updateCurrentUser,
} from "../api";
import { getOnboardingFailureMessage } from "../onboarding-errors";
import { ChannelChips } from "./ChannelChips";

interface Props {
  onComplete: (user: LocalUser, profile: UserProfile) => void;
}

type Step = "welcome" | "name" | "upload" | "extracting" | "review";

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
      onComplete(bootstrappedUser, extractedProfile);
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
          maxWidth: 520,
          width: "100%",
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
              }}
            >
              A
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
              Bienvenida
            </div>
            <h2 style={{
              color: "var(--text-main)",
              fontSize: "28px",
              marginBottom: "40px",
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
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
                borderBottom: "1px solid rgba(248, 244, 232, 0.18)",
                padding: "16px 0",
                color: "var(--text-main)",
                fontSize: "24px",
                fontFamily: "var(--font-serif)",
                textAlign: "center",
                outline: "none",
                marginBottom: "40px",
                transition: "border-color 0.3s ease",
              }}
              onFocus={(e) => (e.target.style.borderBottom = "1px solid var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderBottom = "1px solid rgba(248, 244, 232, 0.18)")}
            />
            <button
              onClick={() => setStep("upload")}
              disabled={!name.trim()}
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
            <h2 style={{ color: "var(--text-main)", fontSize: "26px", marginBottom: "12px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 500 }}>
              Sincronizá tu carta
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", marginBottom: "28px", fontWeight: 400, lineHeight: 1.6 }}>
              Subí tu gráfico de Diseño Humano para sintonizar el reporte a tu esencia.<br />
              Solo PDF exportado desde MyHumanDesign o Genetic Matrix.
            </p>

            {error && (
              <div style={{
                background: "rgba(196, 96, 96, 0.14)",
                border: "1px solid rgba(196, 96, 96, 0.42)",
                borderRadius: 10,
                padding: "14px 18px",
                color: "#f3c2c2", fontSize: "13px", marginBottom: "24px", textAlign: "center"
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "32px" }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: "32px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  background: slot.file ? "rgba(207, 172, 108, 0.08)" : "rgba(248, 244, 232, 0.04)",
                  border: `1px dashed ${slot.file ? "var(--color-primary)" : "rgba(248, 244, 232, 0.22)"}`,
                  borderRadius: 16,
                }}
                onMouseOver={(e) => {
                  if (!slot.file) e.currentTarget.style.borderColor = "var(--color-primary)";
                }}
                onMouseOut={(e) => {
                  if (!slot.file) e.currentTarget.style.borderColor = "rgba(248, 244, 232, 0.22)";
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
                  color: slot.file ? "var(--color-primary)" : "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-sans)",
                }}>
                  {slot.label}
                </div>
                <div style={{ color: slot.file ? "var(--text-main)" : "var(--text-faint)", fontSize: "13px", marginTop: "10px" }}>
                  {slot.file ? slot.file.name : "Hacé clic para subir tu archivo"}
                </div>
              </div>
            </div>

            <button
              onClick={handleExtract}
              disabled={!hasFile}
              className="astral-auth-primary"
              style={{ width: "100%" }}
            >
              Procesar mi carta
            </button>
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
          <div className="animate-fade-in">
            <h2 style={{ color: "var(--text-on-light)", fontSize: "28px", marginBottom: "28px", textAlign: "center", fontFamily: "var(--font-serif)", fontWeight: 500 }}>
              Tu Diseño Humano
            </h2>

            <div
              style={{
                padding: "24px",
                marginBottom: "28px",
                maxHeight: "45vh",
                overflowY: "auto",
                background: "var(--surface-dark)",
                border: "1px solid rgba(33, 41, 30, 0.4)",
                borderRadius: 18,
                boxShadow: "0 18px 44px rgba(33, 41, 30, 0.18)",
                color: "var(--text-main)",
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
                borderBottom: "1px solid rgba(248, 244, 232, 0.06)",
              }}>
                <span style={{ color: "var(--text-faint)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 600 }}>
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
                Volver
              </button>
              <button onClick={handleConfirm} className="astral-auth-primary" style={{ flex: 2 }}>
                Continuar
              </button>
            </div>
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
      borderBottom: "1px solid rgba(248, 244, 232, 0.06)",
    }}>
      <span style={{ color: "var(--text-faint)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "var(--text-main)", fontSize: "14px", fontFamily: "var(--font-serif)" }}>{value || "—"}</span>
    </div>
  );
}
