import { useState, useEffect, useRef } from "react";
import { ReportRenderer } from "./ReportRenderer";
import { sendChat, sendChatStream, getChatHistory, truncateChatHistory } from "../api";
import { getChatFailureMessage } from "../chat-errors";
import { VoiceRecorder } from "./VoiceRecorder";
import type { ChatMessage } from "../types";
import {
  getChatLimitExperience,
  isChatLimitReached,
  type ChatUsageSnapshot,
} from "../chat-limits";

interface ChatMsg extends ChatMessage {
  dbId?: number;
}

const hasMicSupport = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

function CopyButton({ copied, onCopy, tone = "dark" }: { copied: boolean; onCopy: () => void; tone?: "dark" | "light" }) {
  const restColor = tone === "dark" ? "var(--text-faint)" : "var(--text-on-light-faint)";
  const hoverColor = tone === "dark" ? "var(--text-muted)" : "var(--text-on-light)";

  return (
    <button
      onClick={onCopy}
      aria-label="Copiar mensaje"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "transparent",
        border: "none",
        color: copied ? "var(--color-primary)" : restColor,
        fontSize: 12,
        cursor: "pointer",
        padding: "4px 8px",
        borderRadius: 6,
        transition: "all 0.2s ease",
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
      }}
      onMouseOver={(e) => { if (!copied) e.currentTarget.style.color = hoverColor; }}
      onMouseOut={(e) => { if (!copied) e.currentTarget.style.color = restColor; }}
    >
      {copied ? (
        <><span style={{ fontSize: 13 }}>✓</span><span>Copiado</span></>
      ) : (
        <><CopyIcon /><span>Copiar</span></>
      )}
    </button>
  );
}

const QUICK_ACTIONS = [
  "Reporte semanal completo",
  "¿Cómo está mi energía esta semana?",
  "¿Qué tránsitos me afectan hoy?",
];

function formatResetDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

interface Props {
  userName: string;
}

export function ChatView({ userName }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [messageUsage, setMessageUsage] = useState<ChatUsageSnapshot | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const resetDateLabel = formatResetDate(messageUsage?.resetsAt);

  const applyHistoryPayload = ({
    messages: history,
    plan,
    used,
    limit,
    cycle,
    resetsAt,
  }: Awaited<ReturnType<typeof getChatHistory>>) => {
    if (history.length) {
      setMessages(history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        dbId: m.id,
      })));
    }

    const usage = { plan, used, limit, cycle, resetsAt };
    setMessageUsage(usage);
    setLimitReached(isChatLimitReached(usage));
  };

  const bumpMessageUsage = () => {
    setMessageUsage((prev) => {
      if (!prev) {
        return prev;
      }

      const next = { ...prev, used: prev.used + 1 };
      setLimitReached(isChatLimitReached(next));
      return next;
    });
  };

  const decrementMessageUsage = () => {
    setMessageUsage((prev) => {
      if (!prev) {
        return prev;
      }

      const next = { ...prev, used: Math.max(0, prev.used - 1) };
      setLimitReached(isChatLimitReached(next));
      return next;
    });
  };

  useEffect(() => {
    getChatHistory()
      .then(applyHistoryPayload)
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, []);

  useEffect(() => {
    if (!messageUsage?.resetsAt) {
      return;
    }

    const refreshUsageIfWindowRolled = () => {
      const resetAtMs = Date.parse(messageUsage.resetsAt);
      if (!Number.isFinite(resetAtMs) || resetAtMs > Date.now()) {
        return;
      }

      void getChatHistory()
        .then(applyHistoryPayload)
        .catch(() => {});
    };

    refreshUsageIfWindowRolled();
    const intervalId = window.setInterval(refreshUsageIfWindowRolled, 60_000);

    return () => window.clearInterval(intervalId);
  }, [messageUsage?.resetsAt]);

  useEffect(() => {
    const el = bottomRef.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const sendMessage = async (text: string, baseMessages?: ChatMsg[]) => {
    const trimmed = text.trim();
    if (!trimmed || loading || streaming || limitReached) return;

    setErrorMsg(null);
    setInput("");
    setEditIndex(null);

    const base = baseMessages ?? messages;
    const updated: ChatMsg[] = [...base, { role: "user", content: trimmed }];
    setMessages(updated);
    setLoading(true);
    bumpMessageUsage();

    try {
      const withPlaceholder: ChatMsg[] = [...updated, { role: "assistant", content: "" }];
      setMessages(withPlaceholder);
      setStreaming(true);
      setLoading(false);

      const result = await sendChatStream(updated, (accumulated) => {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: accumulated };
          return copy;
        });
      });

      // Update dbIds on the persisted messages so edit truncation works in-session
      setMessages((prev) => {
        const copy = [...prev];
        if (result.userMsgId && copy.length >= 2) {
          copy[copy.length - 2] = { ...copy[copy.length - 2], dbId: result.userMsgId };
        }
        if (result.assistantMsgId && copy.length >= 1) {
          copy[copy.length - 1] = { ...copy[copy.length - 1], dbId: result.assistantMsgId };
        }
        return copy;
      });

      setStreaming(false);
    } catch (e) {
      setStreaming(false);
      const isLimitError = e instanceof Error && e.message === "message_limit_reached";
      if (isLimitError) {
        const limitErr = e as Error & ChatUsageSnapshot;
        const usage = {
          plan: limitErr.plan,
          used: limitErr.used,
          limit: limitErr.limit,
          cycle: limitErr.cycle,
          resetsAt: limitErr.resetsAt,
        };
        setMessageUsage(usage);
        setLimitReached(isChatLimitReached(usage));
        setMessages(base);
        setLoading(false);
        return;
      }
      setMessages(updated);
      setLoading(true);
      try {
        const data = await sendChat(updated);
        setMessages((prev) => {
          const copy = [...prev];
          // Set dbId on the user message we just sent
          if (data.userMsgId && copy.length >= 1) {
            copy[copy.length - 1] = { ...copy[copy.length - 1], dbId: data.userMsgId };
          }
          copy.push({ role: "assistant", content: data.reply, dbId: data.assistantMsgId });
          return copy;
        });
      } catch (e2) {
        const isLimitError2 = e2 instanceof Error && e2.message === "message_limit_reached";
        if (isLimitError2) {
          const limitErr = e2 as Error & ChatUsageSnapshot;
          const usage = {
            plan: limitErr.plan,
            used: limitErr.used,
            limit: limitErr.limit,
            cycle: limitErr.cycle,
            resetsAt: limitErr.resetsAt,
          };
          setMessageUsage(usage);
          setLimitReached(isChatLimitReached(usage));
          setMessages(base);
          setLoading(false);
          return;
        }
        setErrorMsg(getChatFailureMessage(e2));
        decrementMessageUsage();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ─── Copy ──────────────────────────────────────────────────────────────────

  const copyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }).catch(() => {
      // Fallback for non-HTTPS or restricted contexts
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  // ─── Edit ──────────────────────────────────────────────────────────────────

  const startEdit = (index: number) => {
    setEditIndex(index);
    setEditText(messages[index].content);
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setEditText("");
  };

  const saveEdit = async (index: number) => {
    const trimmed = editText.trim();
    if (!trimmed) return;

    const editedMsg = messages[index];
    const base = messages.slice(0, index);

    // Truncate persisted messages from the edit point onward
    if (editedMsg.dbId) {
      try {
        const result = await truncateChatHistory(editedMsg.dbId);
        const usage = {
          plan: result.plan,
          used: result.used,
          limit: result.limit,
          cycle: result.cycle,
          resetsAt: result.resetsAt,
        };
        setMessageUsage(usage);
        setLimitReached(isChatLimitReached(usage));
      } catch {
        // If truncate fails, still proceed with local edit
      }
    }

    sendMessage(trimmed, base);
  };

  // ─── Voice ─────────────────────────────────────────────────────────────────

  const handleVoiceTranscription = (text: string) => {
    setIsRecording(false);
    sendMessage(text);
  };

  if (!historyLoaded) return null;

  const isBusy = loading || streaming;
  const limitPlan = messageUsage?.plan ?? "free";
  const limitValue = messageUsage?.limit ?? 20;
  const showUpgradeCta = limitPlan !== "premium";
  const limitExperience = messageUsage
    ? getChatLimitExperience(messageUsage, resetDateLabel)
    : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 48 }} className="animate-fade-in-slow">
            <div
              style={{
                color: "var(--text-on-light)",
                fontSize: "26px",
                marginBottom: "8px",
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              Hola, {userName}
            </div>
            <div style={{ color: "var(--text-on-light-muted)", fontSize: "14px", marginBottom: "32px", fontWeight: 400, lineHeight: 1.6 }}>
              Tu guía de Diseño Humano está lista para acompañarte.
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    background: "var(--surface-dark)",
                    border: "1px solid rgba(248, 244, 232, 0.1)",
                    color: "var(--text-main)",
                    padding: "10px 18px",
                    borderRadius: "999px",
                    cursor: "pointer",
                    fontSize: "12px",
                    transition: "all 0.3s ease",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-primary)";
                    e.currentTarget.style.background = "var(--surface-deeper)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "rgba(248, 244, 232, 0.1)";
                    e.currentTarget.style.background = "var(--surface-dark)";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
            className="animate-fade-in"
          >
            {msg.role === "user" ? (
              <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                {editIndex === i ? (
                  /* Edit mode */
                  <div
                    style={{
                      background: "var(--surface-dark)",
                      border: "1px solid var(--color-primary)",
                      borderRadius: 14,
                      padding: "12px 16px",
                      width: "100%",
                      minWidth: 260,
                    }}
                  >
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        color: "var(--text-main)",
                        fontSize: 14,
                        fontFamily: "var(--font-sans)",
                        fontWeight: 400,
                        resize: "vertical",
                        outline: "none",
                        lineHeight: 1.6,
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                      <button
                        onClick={cancelEdit}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(248, 244, 232, 0.18)",
                          color: "var(--text-muted)",
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "var(--font-sans)",
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveEdit(i)}
                        disabled={!editText.trim() || isBusy}
                        style={{
                          background: "linear-gradient(135deg, #e0c081 0%, #9d7f4d 100%)",
                          border: "none",
                          color: "var(--surface-deeper)",
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: !editText.trim() || isBusy ? "default" : "pointer",
                          fontFamily: "var(--font-sans)",
                          opacity: !editText.trim() || isBusy ? 0.4 : 1,
                        }}
                      >
                        Guardar y enviar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <>
                    <div
                      style={{
                        background: "var(--surface-dark)",
                        border: "1px solid rgba(248, 244, 232, 0.08)",
                        borderRadius: "18px 18px 4px 18px",
                        padding: "12px 18px",
                        color: "var(--text-main)",
                        fontSize: "15px",
                        fontWeight: 400,
                        lineHeight: 1.6,
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      {msg.content}
                    </div>
                    {/* Action buttons below user bubble */}
                    {msg.content && <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 4 }}>
                      <CopyButton tone="light" copied={copiedIndex === i} onCopy={() => copyMessage(msg.content, i)} />
                      {!isBusy && !limitReached && (
                        <button
                          onClick={() => startEdit(i)}
                          aria-label="Editar mensaje"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            background: "transparent",
                            border: "none",
                            color: "var(--text-on-light-faint)",
                            fontSize: 12,
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: 6,
                            transition: "all 0.2s ease",
                            fontFamily: "var(--font-sans)",
                            fontWeight: 500,
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.color = "var(--text-on-light)")}
                          onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-on-light-faint)")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span>Editar</span>
                        </button>
                      )}
                    </div>}
                  </>
                )}
              </div>
            ) : (
              /* Assistant message — premium guided insight on dark green */
              <div
                style={{
                  maxWidth: "95%",
                  width: "100%",
                  background: "var(--surface-dark)",
                  border: "1px solid rgba(248, 244, 232, 0.08)",
                  borderRadius: "16px",
                  padding: "18px 22px",
                  color: "var(--text-main)",
                }}
              >
                <div
                  style={{
                    color: "var(--color-primary)",
                    fontSize: "10px",
                    marginBottom: "12px",
                    letterSpacing: "0.2em",
                    fontWeight: 700,
                    fontFamily: "var(--font-sans)",
                    textTransform: "uppercase",
                    paddingBottom: 10,
                    borderBottom: "1px solid rgba(207, 172, 108, 0.18)",
                  }}
                >
                  Astral Guide
                </div>
                <ReportRenderer text={msg.content} />
                {/* Copy button */}
                {msg.content && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center" }}>
                    <CopyButton copied={copiedIndex === i} onCopy={() => copyMessage(msg.content, i)} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="animate-fade-in">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--color-primary)",
                  animation: `pulse 1.2s ease infinite ${i * 0.2}s`,
                }}
              />
            ))}
            <span style={{ color: "var(--text-on-light-muted)", fontSize: "12px", letterSpacing: "0.06em" }}>
              Canalizando tu lectura...
            </span>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              background: "rgba(196, 96, 96, 0.14)",
              border: "1px solid rgba(196, 96, 96, 0.4)",
              borderRadius: 10,
              padding: "10px 14px",
              color: "#9a3737",
              fontSize: 13,
              animation: "fadeIn 0.2s ease",
            }}
          >
            {errorMsg}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Footer */}
      {limitReached ? (
        <footer
          style={{
            padding: "32px 24px",
            textAlign: "center",
            borderTop: "1px solid rgba(33, 41, 30, 0.12)",
            background: "var(--surface-deeper)",
            zIndex: 10,
            flexShrink: 0,
          }}
          className="animate-fade-in"
        >
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                color: "var(--color-primary)",
                fontSize: 24,
                fontWeight: 500,
                marginBottom: 8,
                margin: "0 0 12px 0",
              }}
            >
              {limitExperience?.title ?? "Tu ventana de mensajes de este mes se completó"}
            </h3>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 14,
                fontWeight: 400,
                marginBottom: 24,
                lineHeight: 1.65,
              }}
            >
              {limitExperience?.body ?? `Ya usaste tus ${limitValue} mensajes de este mes.`}
            </p>
            {showUpgradeCta && limitExperience?.ctaLabel && (
              <a
                href="https://wa.me/5491153446030"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "14px 36px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #e0c081 0%, #9d7f4d 100%)",
                  color: "var(--surface-deeper)",
                  fontSize: 13,
                  fontFamily: "var(--font-sans)",
                  textDecoration: "none",
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                {limitExperience.ctaLabel}
              </a>
            )}
          </div>
        </footer>
      ) : (
        <footer
          style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(33, 41, 30, 0.1)",
            background: "transparent",
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              maxWidth: 760,
              margin: "0 auto",
              background: "var(--surface-dark)",
              border: `1px solid ${isRecording ? "var(--color-primary)" : "rgba(248, 244, 232, 0.1)"}`,
              borderRadius: "18px",
              padding: "8px 16px",
              alignItems: "center",
              transition: "border-color 0.3s ease",
              boxShadow: "0 4px 18px rgba(33, 41, 30, 0.12)",
            }}
            onFocus={(e) => {
              if (!isRecording) e.currentTarget.style.border = "1px solid var(--color-primary)";
            }}
            onBlur={(e) => {
              if (!isRecording) e.currentTarget.style.border = "1px solid rgba(248, 244, 232, 0.1)";
            }}
          >
            {isRecording ? (
              <VoiceRecorder
                onTranscription={handleVoiceTranscription}
                onCancel={() => setIsRecording(false)}
              />
            ) : (
              <>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Preguntale a tu guía sobre tu semana..."
                  rows={1}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    color: "var(--text-main)",
                    fontSize: "15px",
                    fontWeight: 400,
                    fontFamily: "var(--font-sans)",
                    resize: "none",
                    lineHeight: 1.5,
                    paddingTop: "6px",
                    paddingBottom: "6px",
                    outline: "none",
                  }}
                />
                {/* Mic button — shown when input is empty and browser supports it */}
                {hasMicSupport && !input.trim() && !isBusy && (
                  <button
                    onClick={() => setIsRecording(true)}
                    aria-label="Grabar nota de voz"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      fontSize: 18,
                      transition: "all 0.3s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "var(--color-primary)")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                      <path d="M19 10v2a7 7 0 01-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </button>
                )}
                {/* Send button */}
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isBusy || !input.trim()}
                  aria-label="Enviar"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: isBusy || !input.trim() ? "transparent" : "linear-gradient(135deg, #e0c081 0%, #9d7f4d 100%)",
                    border: isBusy || !input.trim() ? "1px solid rgba(248, 244, 232, 0.15)" : "none",
                    cursor: isBusy || !input.trim() ? "default" : "pointer",
                    color: isBusy || !input.trim() ? "var(--text-faint)" : "var(--surface-deeper)",
                    fontSize: "16px",
                    transition: "all 0.3s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
