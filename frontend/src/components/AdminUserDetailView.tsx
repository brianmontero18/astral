import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  ADMIN_INTERNAL_PERMISSION_LABEL,
  ADMIN_USER_DETAIL_SECTION_TITLES,
  ADMIN_USER_DETAIL_SUPPORT_BODY,
  applyAdminUserAccessValues,
  buildAdminUserAccessPatch,
  getAdminSupportFailureMessage,
  getAdminPlanLabel,
  getAdminRoleLabel,
  getAdminStatusLabel,
  getAdminUserDetailDisplay,
} from "../admin-support";
import { getAdminUserDetail, getAdminUserLlmUsage, updateAdminUserAccess } from "../api";
import type {
  AdminUserAccessValues,
  AdminUserDetail,
  AdminUserLlmUsage,
  AppUserPlan,
  AppUserRole,
  AppUserStatus,
} from "../types";

interface Props {
  currentUserId: string;
  userId: string;
  onBackToUsers: () => void;
}

const PLAN_OPTIONS: Array<{ value: AppUserPlan; label: string }> = [
  { value: "free", label: getAdminPlanLabel("free") },
  { value: "basic", label: getAdminPlanLabel("basic") },
  { value: "premium", label: getAdminPlanLabel("premium") },
];

const STATUS_OPTIONS: Array<{ value: AppUserStatus; label: string }> = [
  { value: "active", label: getAdminStatusLabel("active") },
  { value: "disabled", label: getAdminStatusLabel("disabled") },
  { value: "banned", label: getAdminStatusLabel("banned") },
];

const ROLE_OPTIONS: Array<{ value: AppUserRole; label: string }> = [
  { value: "user", label: getAdminRoleLabel("user") },
  { value: "admin", label: getAdminRoleLabel("admin") },
];

function buildAccessValues(detail: AdminUserDetail): AdminUserAccessValues {
  return {
    plan: detail.plan,
    status: detail.status,
    role: detail.role,
  };
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0.00";
  // Sub-cent costs deserve more precision; otherwise show two decimals.
  const decimals = value < 0.01 ? 4 : 2;
  return `$${value.toFixed(decimals)}`;
}

function formatTokens(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("es-AR");
}

const LLM_USAGE_DAYS = 7;
const LLM_ROUTE_LABELS: Record<string, string> = {
  chat: "Chat",
  chat_stream: "Chat (stream)",
  report: "Report",
  extraction: "Extraction",
};

function SupportValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
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
      <span
        style={{
          fontSize: 14,
          color: "var(--text-main)",
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SupportField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
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
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        disabled={disabled}
        style={{
          width: "100%",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          color: "var(--text-main)",
          padding: "14px 16px",
          outline: "none",
          fontSize: 14,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            style={{
              background: "var(--bg-dark)",
              color: "var(--text-main)",
            }}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: "28px 24px 40px",
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: 620,
          width: "100%",
          padding: "28px 24px",
          textAlign: "center",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            margin: "0 0 12px",
            color: "var(--text-main)",
            fontFamily: "var(--font-serif)",
            fontSize: 32,
            fontWeight: 400,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: actionLabel ? "0 0 20px" : 0,
            color: "var(--text-muted)",
            lineHeight: 1.7,
            fontSize: 14,
          }}
        >
          {body}
        </p>
        {actionLabel && onAction ? (
          <button
            onClick={onAction}
            className="btn-primary"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SupportSection({
  title,
  body,
  subdued = false,
  children,
}: {
  title: string;
  body?: string;
  subdued?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="glass-panel"
      style={{
        padding: "22px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        ...(subdued
          ? {
              background: "rgba(255,255,255,0.03)",
              borderColor: "rgba(255,255,255,0.05)",
            }
          : {}),
      }}
    >
      <div>
        <h2
          style={{
            margin: body ? "0 0 8px" : 0,
            color: "var(--text-main)",
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 400,
          }}
        >
          {title}
        </h2>
        {body ? (
          <p
            style={{
              margin: 0,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              fontSize: 14,
            }}
          >
            {body}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function InlineNotice({
  tone,
  children,
}: {
  tone: "error" | "notice";
  children: ReactNode;
}) {
  const styles = tone === "error"
    ? {
        border: "1px solid rgba(201,107,122,0.35)",
        background: "rgba(201,107,122,0.08)",
        color: "#f0a0b0",
      }
    : {
        border: "1px solid rgba(212,175,55,0.25)",
        background: "rgba(212,175,55,0.08)",
        color: "var(--text-gold)",
      };

  return (
    <div
      style={{
        borderRadius: 14,
        padding: "14px 16px",
        fontSize: 13,
        lineHeight: 1.6,
        ...styles,
      }}
    >
      {children}
    </div>
  );
}

export function AdminUserDetailView({
  currentUserId,
  userId,
  onBackToUsers,
}: Props) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [draft, setDraft] = useState<AdminUserAccessValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [llmUsage, setLlmUsage] = useState<AdminUserLlmUsage | null>(null);
  const [llmUsageError, setLlmUsageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      setLoading(true);
      setLoadError(null);
      setSaveError(null);
      setSaveNotice(null);

      try {
        const response = await getAdminUserDetail(userId);

        if (!cancelled) {
          setDetail(response);
          setDraft(buildAccessValues(response));
        }
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setDraft(null);
          setLoadError(
            getAdminSupportFailureMessage(
              err,
              "No pudimos abrir este detalle en este momento. Reintentá en unos segundos.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    setLlmUsage(null);
    setLlmUsageError(null);

    getAdminUserLlmUsage(userId, LLM_USAGE_DAYS)
      .then((response) => {
        if (!cancelled) {
          setLlmUsage(response);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLlmUsageError(
            getAdminSupportFailureMessage(
              err,
              "No pudimos cargar el uso reciente de LLM para esta cuenta.",
            ),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const currentAccess = useMemo(
    () => (detail ? buildAccessValues(detail) : null),
    [detail],
  );
  const detailDisplay = useMemo(
    () => (detail ? getAdminUserDetailDisplay(detail) : null),
    [detail],
  );
  const pendingPatch = useMemo(
    () => (
      currentAccess && draft
        ? buildAdminUserAccessPatch({
            current: currentAccess,
            next: draft,
          })
        : null
    ),
    [currentAccess, draft],
  );
  const isSelfMutation = currentUserId === userId;

  const handleDraftChange = <K extends keyof AdminUserAccessValues>(
    key: K,
    value: AdminUserAccessValues[K],
  ) => {
    setDraft((currentDraft) => (
      currentDraft
        ? {
            ...currentDraft,
            [key]: value,
          }
        : currentDraft
    ));
    setSaveError(null);
    setSaveNotice(null);
  };

  const handleResetDraft = () => {
    if (!detail) {
      return;
    }

    setDraft(buildAccessValues(detail));
    setSaveError(null);
    setSaveNotice(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!detail || !draft) {
      return;
    }

    if (isSelfMutation) {
      setSaveError(
        "Astral sigue bloqueando la autoedición de permisos para esta cuenta.",
      );
      return;
    }

    if (!pendingPatch) {
      setSaveError("No hay cambios para guardar.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);

    try {
      await updateAdminUserAccess(userId, pendingPatch);
      const nextDetail = applyAdminUserAccessValues(detail, draft);

      setDetail(nextDetail);
      setDraft(buildAccessValues(nextDetail));

      try {
        const refreshed = await getAdminUserDetail(userId);

        setDetail(refreshed);
        setDraft(buildAccessValues(refreshed));
        setSaveNotice("Cambios guardados y recargados desde la base actual de Astral.");
      } catch {
        setSaveNotice(
          "Cambios guardados. No se pudo recargar el estado más reciente, pero la actualización ya fue enviada.",
        );
      }
    } catch (err) {
      setSaveError(
        getAdminSupportFailureMessage(
          err,
          "No pudimos guardar los cambios de soporte. Reintentá en unos segundos.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DetailState
        title="Cargando usuario"
        body="Resolviendo el detalle de acceso y soporte desde la base actual de Astral."
      />
    );
  }

  if (loadError || !detail || !draft || !detailDisplay) {
    return (
      <DetailState
        title="No se pudo abrir el detalle"
        body={loadError ?? "No encontramos datos para este usuario."}
        actionLabel="Volver a personas"
        onAction={onBackToUsers}
      />
    );
  }

  const [
    supportActionsTitle,
    activityTitle,
    personContextTitle,
    technicalDataTitle,
  ] = ADMIN_USER_DETAIL_SECTION_TITLES;

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        padding: "28px 24px 40px",
      }}
    >
      <div
        style={{
          maxWidth: 1020,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={onBackToUsers}
            className="btn-secondary"
          >
            Volver a personas
          </button>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: "24px 24px 20px",
          }}
        >
          <div
            style={{
              color: "var(--color-primary)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Support Panel
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1
                style={{
                  margin: "0 0 8px",
                  color: "var(--text-main)",
                  fontFamily: "var(--font-serif)",
                  fontSize: 38,
                  fontWeight: 400,
                  lineHeight: 1,
                  wordBreak: "break-word",
                }}
              >
                {detailDisplay.header.name}
              </h1>
              <p
                style={{
                  margin: detailDisplay.header.supportHint ? "0 0 12px" : 0,
                  color: "var(--text-muted)",
                  lineHeight: 1.7,
                  fontSize: 14,
                  maxWidth: 680,
                  wordBreak: "break-word",
                }}
              >
                {detailDisplay.header.email}
              </p>
              {detailDisplay.header.supportHint ? (
                <p
                  style={{
                    margin: 0,
                    color: "var(--text-faint)",
                    lineHeight: 1.6,
                    fontSize: 13,
                    maxWidth: 680,
                  }}
                >
                  {detailDisplay.header.supportHint}
                </p>
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div className="glass-panel-gold" style={{ padding: "14px 16px", minWidth: 108 }}>
                <SupportValue label="Plan" value={detailDisplay.header.plan} />
              </div>
              <div className="glass-panel" style={{ padding: "14px 16px", minWidth: 108 }}>
                <SupportValue label="Estado" value={detailDisplay.header.status} />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          <form
            className="glass-panel-gold"
            onSubmit={handleSubmit}
            style={{
              padding: "22px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              gridColumn: "1 / -1",
            }}
          >
            <div>
              <h2
                style={{
                  margin: "0 0 8px",
                  color: "var(--text-main)",
                  fontFamily: "var(--font-serif)",
                  fontSize: 30,
                  fontWeight: 400,
                }}
              >
                {supportActionsTitle}
              </h2>
              <p
                style={{
                  margin: 0,
                  color: "var(--text-muted)",
                  lineHeight: 1.7,
                  fontSize: 14,
                }}
              >
                {ADMIN_USER_DETAIL_SUPPORT_BODY}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <SupportField
                label="Plan"
                value={draft.plan}
                options={PLAN_OPTIONS}
                onChange={(value) => handleDraftChange("plan", value)}
                disabled={saving || isSelfMutation}
              />
              <SupportField
                label="Estado"
                value={draft.status}
                options={STATUS_OPTIONS}
                onChange={(value) => handleDraftChange("status", value)}
                disabled={saving || isSelfMutation}
              />
              <SupportField
                label={ADMIN_INTERNAL_PERMISSION_LABEL}
                value={draft.role}
                options={ROLE_OPTIONS}
                onChange={(value) => handleDraftChange("role", value)}
                disabled={saving || isSelfMutation}
              />
            </div>

            {isSelfMutation ? (
              <InlineNotice tone="error">
                Esta cuenta es tu propia sesión admin. La autoedición de
                permisos sigue bloqueada por seguridad.
              </InlineNotice>
            ) : null}

            {saveError ? (
              <InlineNotice tone="error">{saveError}</InlineNotice>
            ) : null}

            {saveNotice ? (
              <InlineNotice tone="notice">{saveNotice}</InlineNotice>
            ) : null}

            <div
              style={{
                color: "var(--text-faint)",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {pendingPatch
                ? "Hay cambios listos para guardar"
                : "Sin cambios pendientes"}
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                type="submit"
                className="btn-primary"
                disabled={!pendingPatch || saving || isSelfMutation}
              >
                {saving ? "Guardando..." : "Guardar acceso"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleResetDraft}
                disabled={!pendingPatch || saving}
              >
                Descartar cambios
              </button>
            </div>
          </form>

          <SupportSection title={activityTitle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 16,
              }}
            >
              {detailDisplay.activity.map((field) => (
                <SupportValue key={field.label} label={field.label} value={field.value} />
              ))}
            </div>
          </SupportSection>

          <SupportSection
            title={`Uso LLM últimos ${llmUsage?.days ?? LLM_USAGE_DAYS} días`}
            body="Lectura directa de la tabla llm_calls. Refleja todos los call-sites que ya escriben telemetría."
          >
            {llmUsageError ? (
              <InlineNotice tone="error">{llmUsageError}</InlineNotice>
            ) : !llmUsage ? (
              <span style={{ color: "var(--text-faint)", fontSize: 13 }}>
                Cargando uso reciente...
              </span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 16,
                  }}
                >
                  <SupportValue
                    label="Calls totales"
                    value={String(llmUsage.totalCallCount)}
                  />
                  <SupportValue
                    label="Tokens entrada"
                    value={formatTokens(llmUsage.totalTokensIn)}
                  />
                  <SupportValue
                    label="Tokens salida"
                    value={formatTokens(llmUsage.totalTokensOut)}
                  />
                  <SupportValue
                    label="Costo USD"
                    value={formatUsd(llmUsage.totalCostUsd)}
                  />
                </div>
                {llmUsage.totalCallCount === 0 && (
                  <span
                    style={{
                      color: "var(--text-faint)",
                      fontSize: 13,
                      fontStyle: "italic",
                    }}
                  >
                    Sin actividad registrada en la ventana.
                  </span>
                )}
                {llmUsage.byRoute.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--text-faint)",
                        fontWeight: 600,
                      }}
                    >
                      Por ruta
                    </span>
                    {llmUsage.byRoute.map((entry) => (
                      <div
                        key={entry.route}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(140px, 1fr) repeat(3, auto)",
                          gap: 12,
                          fontSize: 13,
                          color: "var(--text-main)",
                        }}
                      >
                        <span>{LLM_ROUTE_LABELS[entry.route] ?? entry.route}</span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {entry.callCount} {entry.callCount === 1 ? "call" : "calls"}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {formatTokens(entry.tokensIn)} / {formatTokens(entry.tokensOut)} tok
                        </span>
                        <span>{formatUsd(entry.costUsd)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {llmUsage.byModel.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--text-faint)",
                        fontWeight: 600,
                      }}
                    >
                      Por modelo
                    </span>
                    {llmUsage.byModel.map((entry) => (
                      <div
                        key={entry.model}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(140px, 1fr) repeat(3, auto)",
                          gap: 12,
                          fontSize: 13,
                          color: "var(--text-main)",
                        }}
                      >
                        <span>{entry.model}</span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {entry.callCount} {entry.callCount === 1 ? "call" : "calls"}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {formatTokens(entry.tokensIn)} / {formatTokens(entry.tokensOut)} tok
                        </span>
                        <span>{formatUsd(entry.costUsd)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SupportSection>

          <SupportSection title={personContextTitle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              {detailDisplay.context.map((field) => (
                <SupportValue key={field.label} label={field.label} value={field.value} />
              ))}
            </div>
          </SupportSection>

          <SupportSection title={technicalDataTitle} subdued>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              {detailDisplay.technical.map((field) => (
                <SupportValue key={field.label} label={field.label} value={field.value} />
              ))}
            </div>
          </SupportSection>
        </div>
      </div>
    </div>
  );
}
