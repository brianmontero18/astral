import { useEffect, useRef, useState } from "react";
import { createAdminInvite, type AdminInviteResult } from "../api";
import {
  buildAdminUserPath,
  getAdminPlanLabel,
  getAdminSupportFailureMessage,
} from "../admin-support";
import type { AppUserPlan } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
  onOpenUserDetail: (userId: string) => void;
}

const PLAN_OPTIONS: Array<{ value: AppUserPlan; label: string }> = [
  { value: "free", label: getAdminPlanLabel("free") },
  { value: "basic", label: getAdminPlanLabel("basic") },
  { value: "premium", label: getAdminPlanLabel("premium") },
];

const DEFAULT_PLAN: AppUserPlan = "premium";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; result: AdminInviteResult }
  | { kind: "error"; message: string };

export function AdminInviteModal({
  open,
  onClose,
  onInvited,
  onOpenUserDetail,
}: Props) {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<AppUserPlan>(DEFAULT_PLAN);
  const [name, setName] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
      setPlan(DEFAULT_PLAN);
      setSubmitState({ kind: "idle" });
      setCopyFeedback(null);
      // Focus the email field on open.
      requestAnimationFrame(() => emailInputRef.current?.focus());
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitState.kind === "submitting") return;

    setSubmitState({ kind: "submitting" });

    try {
      const result = await createAdminInvite({
        email: email.trim(),
        plan,
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      setSubmitState({ kind: "ok", result });
      onInvited();
    } catch (err) {
      setSubmitState({
        kind: "error",
        message: getAdminSupportFailureMessage(
          err,
          "No pudimos enviar la invitación. Reintentá en unos segundos.",
        ),
      });
    }
  };

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyFeedback("Link copiado al portapapeles");
    } catch {
      setCopyFeedback("No se pudo copiar — seleccioná el link manualmente");
    }
  };

  const handleOpenDetail = (userId: string) => {
    onClose();
    onOpenUserDetail(userId);
  };

  const submitting = submitState.kind === "submitting";
  const fieldsDisabled = submitting || submitState.kind === "ok";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-invite-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        className="glass-panel admin-invite-card"
      >
        <div>
          <div
            style={{
              color: "var(--color-primary)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Invitación
          </div>
          <h2
            id="admin-invite-modal-title"
            style={{
              margin: 0,
              color: "var(--text-main)",
              fontFamily: "var(--font-serif)",
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >
            Invitar usuaria
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "var(--text-muted)",
              lineHeight: 1.6,
              fontSize: 13,
            }}
          >
            Le enviamos un email con magic link + código que vence en 48h. Si
            el email ya existe, le upgradeamos el plan en lugar de duplicar la
            cuenta.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <Field label="Email">
            <input
              ref={emailInputRef}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={fieldsDisabled}
              placeholder="usuaria@dominio.com"
              autoComplete="off"
              className="admin-input"
            />
          </Field>
          <Field label="Plan">
            <div className="admin-select-wrapper">
              <select
                value={plan}
                onChange={(event) => setPlan(event.target.value as AppUserPlan)}
                disabled={fieldsDisabled}
                className="admin-select"
              >
                {PLAN_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    style={{ background: "var(--surface-deeper)" }}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <svg
                className="admin-select-chevron"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </Field>
          <Field label="Nombre (opcional)">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={fieldsDisabled}
              placeholder="Marina"
              autoComplete="off"
              className="admin-input"
            />
          </Field>

          {submitState.kind === "error" ? (
            <Notice tone="error">{submitState.message}</Notice>
          ) : null}

          {submitState.kind === "ok" ? (
            <SuccessPanel
              result={submitState.result}
              copyFeedback={copyFeedback}
              onCopy={handleCopy}
              onOpenDetail={handleOpenDetail}
            />
          ) : null}

          <div className="admin-invite-actions">
            <button
              type="button"
              onClick={onClose}
              className="astral-auth-secondary"
              disabled={submitting}
            >
              {submitState.kind === "ok" ? "Cerrar y ver lista" : "Cancelar"}
            </button>
            {submitState.kind !== "ok" ? (
              <button
                type="submit"
                className="astral-auth-primary"
                disabled={submitting}
              >
                {submitting ? "Enviando…" : "Enviar invitación"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "notice" | "success";
  children: React.ReactNode;
}) {
  const palette =
    tone === "error"
      ? {
          border: "1px solid rgba(196, 96, 96, 0.42)",
          background: "rgba(196, 96, 96, 0.12)",
          color: "#f3c2c2",
        }
      : tone === "success"
        ? {
            border: "1px solid rgba(120, 180, 110, 0.32)",
            background: "rgba(120, 180, 110, 0.12)",
            color: "var(--text-main)",
          }
        : {
            border: "1px solid rgba(207, 172, 108, 0.32)",
            background: "rgba(207, 172, 108, 0.12)",
            color: "var(--color-primary)",
          };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        borderRadius: 12,
        padding: "12px 14px",
        fontSize: 13,
        lineHeight: 1.55,
        ...palette,
      }}
    >
      {children}
    </div>
  );
}

function SuccessPanel({
  result,
  copyFeedback,
  onCopy,
  onOpenDetail,
}: {
  result: AdminInviteResult;
  copyFeedback: string | null;
  onCopy: (link: string) => void;
  onOpenDetail: (userId: string) => void;
}) {
  if (result.kind === "send-failed") {
    return (
      <Notice tone="error">
        <div style={{ marginBottom: 10 }}>
          <strong>Cuenta creada</strong> pero no pudimos enviar el email.
          Probá reinvitar desde el detalle de la usuaria.
        </div>
        <a
          href={buildAdminUserPath(result.data.userId)}
          onClick={(event) => {
            event.preventDefault();
            onOpenDetail(result.data.userId);
          }}
          style={{ color: "var(--color-primary)", textDecoration: "underline" }}
        >
          Abrir detalle de la usuaria →
        </a>
      </Notice>
    );
  }

  const headline = result.data.isNewUser
    ? `Invitación enviada (plan ${getAdminPlanLabel(result.data.plan).toLowerCase()})`
    : `Plan actualizado a ${getAdminPlanLabel(result.data.plan).toLowerCase()} — la cuenta ya existía como free, no se duplicó.`;

  return (
    <Notice tone="success">
      <div style={{ marginBottom: 10, fontWeight: 600 }}>{headline}</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <code
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            background: "rgba(0,0,0,0.18)",
            padding: "8px 10px",
            borderRadius: 8,
            wordBreak: "break-all",
          }}
        >
          {result.data.magicLink}
        </code>
        <button
          type="button"
          onClick={() => onCopy(result.data.magicLink)}
          className="astral-auth-secondary admin-invite-copy"
        >
          Copiar link
        </button>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
        El link expira en 48h. Pasado ese tiempo, reinvitá desde el detalle.
      </div>
      {copyFeedback ? (
        <div
          aria-live="polite"
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--text-main)",
          }}
        >
          {copyFeedback}
        </div>
      ) : null}
    </Notice>
  );
}
