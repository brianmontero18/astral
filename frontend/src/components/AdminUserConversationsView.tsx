import { useEffect, useState } from "react";

import { getAdminUserConversations, setAdminConversationLabel } from "../api";
import { getAdminSupportFailureMessage } from "../admin-support";
import type { AdminConversationEntry, AdminConversationEval } from "../types";

interface Props {
  userId: string;
}

const CONVERSATIONS_LIMIT = 20;

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function EvalChip({ result }: { result: AdminConversationEval }) {
  const failed = !result.pass;
  return (
    <span
      title={`${result.source} · ${result.reason}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        border: `1px solid ${failed ? "rgba(196, 96, 96, 0.42)" : "rgba(120, 180, 120, 0.4)"}`,
        background: failed ? "rgba(196, 96, 96, 0.12)" : "rgba(120, 180, 120, 0.12)",
        color: failed ? "#f3c2c2" : "#bfe3bf",
      }}
    >
      {failed ? "✕" : "✓"} {result.name}
    </span>
  );
}

function TurnPart({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
      <span style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {text}
      </span>
    </div>
  );
}

function HumanLabelControls({ userId, entry }: { userId: string; entry: AdminConversationEntry }) {
  const existing = entry.evals.find((e) => e.source === "human" && e.name === "overall");
  const [label, setLabel] = useState<"good" | "bad" | null>(
    existing ? (existing.pass ? "good" : "bad") : null,
  );
  const [critique, setCritique] = useState(existing?.reason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: "good" | "bad") => {
    setSaving(true);
    setError(null);
    try {
      await setAdminConversationLabel(userId, entry.assistantMsgId, next, critique);
      setLabel(next);
    } catch (err) {
      setError(getAdminSupportFailureMessage(err, "No pudimos guardar la etiqueta."));
    } finally {
      setSaving(false);
    }
  };

  const labelButton = (value: "good" | "bad", text: string) => {
    const active = label === value;
    const isGood = value === "good";
    return (
      <button
        type="button"
        disabled={saving}
        onClick={() => void save(value)}
        style={{
          padding: "5px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          border: `1px solid ${isGood ? "rgba(120, 180, 120, 0.5)" : "rgba(196, 96, 96, 0.5)"}`,
          background: active
            ? isGood
              ? "rgba(120, 180, 120, 0.22)"
              : "rgba(196, 96, 96, 0.22)"
            : "transparent",
          color: isGood ? "#bfe3bf" : "#f3c2c2",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {active ? `● ${text}` : text}
      </button>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        borderTop: "1px solid rgba(248, 244, 232, 0.08)",
        paddingTop: 10,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Label humano</span>
      {labelButton("good", "Buena")}
      {labelButton("bad", "Mala")}
      <input
        value={critique}
        onChange={(event) => setCritique(event.target.value)}
        placeholder="Crítica (opcional)"
        maxLength={2000}
        style={{
          flex: 1,
          minWidth: 160,
          fontSize: 12,
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid rgba(248, 244, 232, 0.14)",
          background: "rgba(248, 244, 232, 0.04)",
          color: "var(--text-main)",
        }}
      />
      {error && <span style={{ fontSize: 11, color: "#f3c2c2" }}>{error}</span>}
    </div>
  );
}

function ConversationCard({ userId, entry }: { userId: string; entry: AdminConversationEntry }) {
  const failedCount = entry.evals.filter((e) => !e.pass).length;

  return (
    <div
      style={{
        border: "1px solid rgba(248, 244, 232, 0.1)",
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "rgba(248, 244, 232, 0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          fontSize: 12,
          color: "var(--text-faint)",
        }}
      >
        <span>{formatDateTime(entry.createdAt)}</span>
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          {entry.feedback && (
            <span
              title={entry.feedback.note ?? undefined}
              style={{ fontSize: 14 }}
            >
              {entry.feedback.thumb === "up" ? "👍" : "👎"}
            </span>
          )}
          {entry.evals.length > 0 && (
            <span style={{ color: failedCount > 0 ? "#f3c2c2" : "#bfe3bf", fontWeight: 600 }}>
              {entry.evals.length - failedCount}/{entry.evals.length} pass
            </span>
          )}
        </span>
      </div>

      {entry.userInput !== null && <TurnPart label="Usuaria" text={entry.userInput} />}
      <TurnPart label="Astral" text={entry.output} />

      {entry.evals.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {entry.evals.map((result) => (
            <EvalChip key={`${result.source}:${result.name}`} result={result} />
          ))}
        </div>
      )}

      <HumanLabelControls userId={userId} entry={entry} />
    </div>
  );
}

export function AdminUserConversationsView({ userId }: Props) {
  const [conversations, setConversations] = useState<AdminConversationEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setConversations(null);
    setError(null);

    getAdminUserConversations(userId, CONVERSATIONS_LIMIT)
      .then((response) => {
        if (!cancelled) setConversations(response.conversations);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            getAdminSupportFailureMessage(
              err,
              "No pudimos cargar las conversaciones recientes de esta cuenta.",
            ),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <section
      className="glass-panel"
      style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 18 }}
    >
      <div>
        <h2
          style={{
            margin: "0 0 8px",
            color: "var(--text-main)",
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 400,
          }}
        >
          Conversaciones recientes
        </h2>
        <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.7, fontSize: 14 }}>
          Cada turno con su input, la respuesta, los evals post-hoc de advisor quality y el 👍/👎 de
          la usuaria. Los evals se persisten cuando la feature flag está activa.
        </p>
      </div>

      {error ? (
        <div
          style={{
            borderRadius: 14,
            padding: "14px 16px",
            fontSize: 13,
            lineHeight: 1.6,
            border: "1px solid rgba(196, 96, 96, 0.42)",
            background: "rgba(196, 96, 96, 0.12)",
            color: "#f3c2c2",
          }}
        >
          {error}
        </div>
      ) : !conversations ? (
        <span style={{ color: "var(--text-faint)", fontSize: 13 }}>Cargando conversaciones...</span>
      ) : conversations.length === 0 ? (
        <span style={{ color: "var(--text-faint)", fontSize: 13, fontStyle: "italic" }}>
          Sin conversaciones registradas para esta cuenta.
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {conversations.map((entry) => (
            <ConversationCard key={entry.assistantMsgId} userId={userId} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}
