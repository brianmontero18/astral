import { useState, useRef } from "react";
import type { UserProfile, LocalUser } from "../types";
import { uploadAsset, extractProfile, createUser } from "../api";

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
  const [slots, setSlots] = useState<[FileSlot, FileSlot]>([
    { file: null, label: "Carta Natal", type: "natal" },
    { file: null, label: "Diseño Humano", type: "hd" },
  ]);
  const [extractedProfile, setExtractedProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const natalRef = useRef<HTMLInputElement>(null);
  const hdRef = useRef<HTMLInputElement>(null);

  const hasAtLeastOneFile = slots[0].file || slots[1].file;

  const handleFileChange = (index: 0 | 1, file: File | null) => {
    setSlots((prev) => {
      const next = [...prev] as [FileSlot, FileSlot];
      next[index] = { ...next[index], file };
      return next;
    });
  };

  const handleExtract = async () => {
    setStep("extracting");
    setError(null);
    setLoading(true);

    try {
      // Create a temporary user to upload assets
      const tempProfile: UserProfile = {
        name,
        natal: { planets: [], ascendant: "", midheaven: "", nodes: { north: "", south: "" } },
        humanDesign: {
          type: "", strategy: "", authority: "", profile: "", definition: "",
          incarnationCross: "", notSelfTheme: "", variable: "",
          digestion: "", environment: "", strongestSense: "",
          channels: [], activatedGates: [], definedCenters: [], undefinedCenters: [],
        },
      };

      const { id: userId } = await createUser(name, tempProfile);
      const assetIds: string[] = [];

      for (const slot of slots) {
        if (slot.file) {
          const result = await uploadAsset(userId, slot.file, slot.type);
          assetIds.push(result.id);
        }
      }

      const { profile } = await extractProfile(assetIds);
      profile.name = profile.name || name;
      setExtractedProfile(profile);

      // Update the user with the real profile
      await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, profile }),
      });

      // Save to localStorage
      localStorage.setItem("astral_user", JSON.stringify({ id: userId, name: profile.name }));

      setStep("review");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    const stored = localStorage.getItem("astral_user");
    if (stored && extractedProfile) {
      const user = JSON.parse(stored) as LocalUser;
      onComplete(user, extractedProfile);
    }
  };

  const handleRetry = () => {
    setExtractedProfile(null);
    setError(null);
    setStep("upload");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
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
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
            <h1 style={{ color: "#e8e0ff", fontSize: 28, marginBottom: 8, fontFamily: "Georgia, serif" }}>
              Astral Guide
            </h1>
            <p style={{ color: "#7c6fcd", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
              Tu guía personal de astrología y Diseño Humano.
              <br />
              Reportes semanales basados en tránsitos reales
              <br />
              cruzados con tu carta natal y diseño.
            </p>
            <button onClick={() => setStep("name")} style={btnPrimary}>
              Comenzar
            </button>
          </div>
        )}

        {/* Step: Name */}
        {step === "name" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
            <h2 style={{ color: "#e8e0ff", fontSize: 22, marginBottom: 24, fontFamily: "Georgia, serif" }}>
              ¿Cómo te llamás?
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
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(124,111,205,0.4)",
                borderRadius: 12,
                padding: "14px 18px",
                color: "#e8e0ff",
                fontSize: 16,
                fontFamily: "Georgia, serif",
                outline: "none",
                marginBottom: 20,
              }}
            />
            <button
              onClick={() => setStep("upload")}
              disabled={!name.trim()}
              style={{ ...btnPrimary, opacity: name.trim() ? 1 : 0.4 }}
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step: Upload */}
        {step === "upload" && (
          <div>
            <h2 style={{ color: "#e8e0ff", fontSize: 20, marginBottom: 8, textAlign: "center", fontFamily: "Georgia, serif" }}>
              Subí tus cartas
            </h2>
            <p style={{ color: "#7c6fcd", fontSize: 12, textAlign: "center", marginBottom: 24 }}>
              Al menos una es requerida. Aceptamos PDF, PNG, JPG o TXT.
            </p>

            {error && (
              <div style={{
                background: "rgba(201,107,122,0.12)",
                border: "1px solid rgba(201,107,122,0.35)",
                borderRadius: 10, padding: "10px 14px",
                color: "#f0a0b0", fontSize: 13, marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
              {slots.map((slot, idx) => (
                <div
                  key={slot.type}
                  onClick={() => (idx === 0 ? natalRef : hdRef).current?.click()}
                  style={{
                    border: slot.file
                      ? "2px solid rgba(107,186,138,0.5)"
                      : "2px dashed rgba(124,111,205,0.4)",
                    borderRadius: 14,
                    padding: "24px 18px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: slot.file ? "rgba(107,186,138,0.08)" : "rgba(124,111,205,0.06)",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    ref={idx === 0 ? natalRef : hdRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(idx as 0 | 1, e.target.files?.[0] ?? null)}
                  />
                  <div style={{ fontSize: 22, marginBottom: 6 }}>
                    {slot.file ? "✓" : idx === 0 ? "🔭" : "⚡"}
                  </div>
                  <div style={{ color: "#e8e0ff", fontSize: 14, fontWeight: 600 }}>
                    {slot.label}
                  </div>
                  <div style={{ color: "#7c6fcd", fontSize: 11, marginTop: 4 }}>
                    {slot.file ? slot.file.name : "Click para seleccionar archivo"}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleExtract}
              disabled={!hasAtLeastOneFile}
              style={{ ...btnPrimary, opacity: hasAtLeastOneFile ? 1 : 0.4 }}
            >
              Analizar cartas
            </button>
          </div>
        )}

        {/* Step: Extracting */}
        {step === "extracting" && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                border: "3px solid rgba(124,111,205,0.3)",
                borderTopColor: "#7c6fcd",
                animation: "spin 1s linear infinite",
                margin: "0 auto 24px",
              }}
            />
            <h2 style={{ color: "#e8e0ff", fontSize: 20, marginBottom: 8, fontFamily: "Georgia, serif" }}>
              Analizando tu carta...
            </h2>
            <p style={{ color: "#7c6fcd", fontSize: 13 }}>
              Esto puede tardar unos segundos
            </p>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && extractedProfile && (
          <div>
            <h2 style={{ color: "#e8e0ff", fontSize: 20, marginBottom: 16, textAlign: "center", fontFamily: "Georgia, serif" }}>
              Tu perfil extraído
            </h2>

            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(124,111,205,0.3)",
                borderRadius: 14,
                padding: 18,
                marginBottom: 20,
                maxHeight: 360,
                overflowY: "auto",
              }}
            >
              <ProfileField label="Nombre" value={extractedProfile.name} />
              {extractedProfile.birthData?.date && (
                <ProfileField label="Nacimiento" value={`${extractedProfile.birthData.date}, ${extractedProfile.birthData.time || ""} — ${extractedProfile.birthData.location || ""}`} />
              )}
              <ProfileField label="Tipo HD" value={extractedProfile.humanDesign.type} />
              <ProfileField label="Estrategia" value={extractedProfile.humanDesign.strategy} />
              <ProfileField label="Autoridad" value={extractedProfile.humanDesign.authority} />
              <ProfileField label="Perfil" value={extractedProfile.humanDesign.profile} />
              <ProfileField label="Definición" value={extractedProfile.humanDesign.definition} />
              <ProfileField label="Cruz" value={extractedProfile.humanDesign.incarnationCross} />
              <ProfileField label="No-Self" value={extractedProfile.humanDesign.notSelfTheme} />
              {extractedProfile.humanDesign.digestion && (
                <ProfileField label="Digestión" value={extractedProfile.humanDesign.digestion} />
              )}
              {extractedProfile.humanDesign.environment && (
                <ProfileField label="Ambiente" value={extractedProfile.humanDesign.environment} />
              )}
              <ProfileField label="Ascendente" value={extractedProfile.natal.ascendant} />
              <ProfileField
                label="Sol"
                value={
                  extractedProfile.natal.planets[0]
                    ? `${extractedProfile.natal.planets[0].sign}, Casa ${extractedProfile.natal.planets[0].house}`
                    : "—"
                }
              />
              <ProfileField
                label="Luna"
                value={
                  extractedProfile.natal.planets[1]
                    ? `${extractedProfile.natal.planets[1].sign}, Casa ${extractedProfile.natal.planets[1].house}`
                    : "—"
                }
              />
              <ProfileField
                label="Canales"
                value={extractedProfile.humanDesign.channels.map((c) => c.name).join(", ") || "—"}
              />
              <ProfileField
                label="Centros definidos"
                value={extractedProfile.humanDesign.definedCenters.join(", ") || "—"}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleRetry} style={btnSecondary}>
                Reintentar
              </button>
              <button onClick={handleConfirm} style={{ ...btnPrimary, flex: 1 }}>
                Confirmar y continuar
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
    <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
      <span style={{ color: "#7c6fcd", fontSize: 11, flexShrink: 0, width: 110 }}>{label}:</span>
      <span style={{ color: "#d4cef0", fontSize: 11 }}>{value || "—"}</span>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  width: "100%",
  background: "linear-gradient(135deg, #7c6fcd, #5a4fa0)",
  border: "none",
  color: "#fff",
  padding: "14px 24px",
  borderRadius: 12,
  cursor: "pointer",
  fontSize: 15,
  fontFamily: "Georgia, serif",
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(124,111,205,0.4)",
  color: "#b0a4e8",
  padding: "14px 20px",
  borderRadius: 12,
  cursor: "pointer",
  fontSize: 14,
  fontFamily: "Georgia, serif",
};
