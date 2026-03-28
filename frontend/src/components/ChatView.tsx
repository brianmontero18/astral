import { useState, useEffect, useRef } from "react";
import { ReportRenderer } from "./ReportRenderer";
import { sendChat, sendChatStream, getChatHistory, truncateChatHistory } from "../api";
import { VoiceRecorder } from "./VoiceRecorder";
import type { ChatMessage, LocalUser } from "../types";

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

function CopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
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
        color: copied ? "var(--color-primary)" : "var(--text-faint)",
        fontSize: 12,
        cursor: "pointer",
        padding: "4px 8px",
        borderRadius: 6,
        transition: "all 0.2s ease",
        fontFamily: "var(--font-sans)",
        fontWeight: 400,
      }}
      onMouseOver={(e) => { if (!copied) e.currentTarget.style.color = "var(--text-muted)"; }}
      onMouseOut={(e) => { if (!copied) e.currentTarget.style.color = "var(--text-faint)"; }}
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

interface Props {
  user: LocalUser;
}

export function ChatView({ user }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [messageUsage, setMessageUsage] = useState<{ used: number; limit: number } | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatHistory(user.id)
      .then(({ messages: history, used, limit }) => {
        if (history.length) {
          setMessages(history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            dbId: (m as Record<string, unknown>).id as number | undefined,
          })));
        }
        setMessageUsage({ used, limit });
        if (used >= limit) setLimitReached(true);
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, [user.id]);

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
    const updated: ChatMessage[] = [...base, { role: "user", content: trimmed }];
    setMessages(updated);
    setLoading(true);
    setMessageUsage((prev) => (prev ? { ...prev, used: prev.used + 1 } : prev));

    try {
      const withPlaceholder: ChatMessage[] = [...updated, { role: "assistant", content: "" }];
      setMessages(withPlaceholder);
      setStreaming(true);
      setLoading(false);

      await sendChatStream(user.id, updated, (accumulated) => {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: accumulated };
          return copy;
        });
      });

      setStreaming(false);

      if (messageUsage && messageUsage.used + 1 >= messageUsage.limit) {
        setLimitReached(true);
      }
    } catch (e) {
      setStreaming(false);
      const isLimitError = e instanceof Error && e.message === "message_limit_reached";
      if (isLimitError) {
        const limitErr = e as Error & { used: number; limit: number };
        setMessageUsage({ used: limitErr.used, limit: limitErr.limit });
        setLimitReached(true);
        setMessages(base);
        setLoading(false);
        return;
      }
      setMessages(updated);
      setLoading(true);
      try {
        const data = await sendChat(user.id, updated);
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        if (messageUsage && messageUsage.used + 1 >= messageUsage.limit) {
          setLimitReached(true);
        }
      } catch (e2) {
        const isLimitError2 = e2 instanceof Error && e2.message === "message_limit_reached";
        if (isLimitError2) {
          const limitErr = e2 as Error & { used: number; limit: number };
          setMessageUsage({ used: limitErr.used, limit: limitErr.limit });
          setLimitReached(true);
          setMessages(base);
          setLoading(false);
          return;
        }
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        setErrorMsg(msg2);
        setMessageUsage((prev) => (prev ? { ...prev, used: prev.used - 1 } : prev));
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
        const result = await truncateChatHistory(user.id, editedMsg.dbId);
        setMessageUsage((prev) => prev ? { ...prev, used: result.used } : prev);
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
            <div style={{ color: "var(--color-primary)", fontSize: "38px", marginBottom: "16px" }}>✦</div>
            <div
              style={{
                color: "var(--text-main)",
                fontSize: "20px",
                marginBottom: "8px",
                fontFamily: "var(--font-serif)",
                fontWeight: 400,
              }}
            >
              Hola, {user.name}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "32px", fontWeight: 300 }}>
              Tu carta cósmica está entrelazada en la matriz.
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-muted)",
                    padding: "10px 18px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontSize: "12px",
                    transition: "all 0.3s ease",
                    fontFamily: "var(--font-sans)",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-primary-dim)";
                    e.currentTarget.style.color = "var(--text-main)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "var(--glass-border)";
                    e.currentTarget.style.color = "var(--text-muted)";
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
                      background: "var(--glass-bg)",
                      border: "1px solid var(--color-primary-dim)",
                      borderRadius: 16,
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
                        fontWeight: 300,
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
                          border: "1px solid var(--glass-border)",
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
                          background: "var(--color-primary-dim)",
                          border: "none",
                          color: "var(--text-main)",
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontSize: 12,
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
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "20px 20px 4px 20px",
                        padding: "12px 18px",
                        color: "var(--text-main)",
                        fontSize: "15px",
                        fontWeight: 300,
                        lineHeight: 1.6,
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      {msg.content}
                    </div>
                    {/* Action buttons below user bubble */}
                    {msg.content && <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 4 }}>
                      <CopyButton copied={copiedIndex === i} onCopy={() => copyMessage(msg.content, i)} />
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
                            color: "var(--text-faint)",
                            fontSize: 12,
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: 6,
                            transition: "all 0.2s ease",
                            fontFamily: "var(--font-sans)",
                            fontWeight: 400,
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                          onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-faint)")}
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
              /* Assistant message */
              <div style={{ maxWidth: "95%", width: "100%" }}>
                <div
                  style={{
                    color: "var(--color-primary)",
                    fontSize: "10px",
                    marginBottom: "8px",
                    letterSpacing: "0.15em",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>✦</span> ASTRAL GUIDE
                </div>
                <ReportRenderer text={msg.content} />
                {/* Copy button */}
                {msg.content && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center" }}>
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
                  background: "var(--color-primary-dim)",
                  animation: `pulse 1.2s ease infinite ${i * 0.2}s`,
                }}
              />
            ))}
            <span style={{ color: "var(--text-faint)", fontSize: "12px", letterSpacing: "0.05em" }}>
              Canalizando estrellas...
            </span>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              background: "rgba(201,107,122,0.12)",
              border: "1px solid rgba(201,107,122,0.35)",
              borderRadius: 10,
              padding: "10px 14px",
              color: "#f0a0b0",
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
            borderTop: "1px solid var(--glass-border)",
            background: "rgba(10, 9, 16, 0.8)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 10,
            flexShrink: 0,
          }}
          className="animate-fade-in"
        >
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                color: "var(--color-primary)",
                fontSize: 22,
                fontWeight: 400,
                marginBottom: 8,
                margin: "0 0 8px 0",
              }}
            >
              Tu ventana al cosmos se ha completado
            </h3>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 14,
                fontWeight: 300,
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              Has usado tus {messageUsage?.limit ?? 15} mensajes de exploración. Para seguir recibiendo guía estelar
              personalizada, accedé al plan completo.
            </p>
            <a
              href="https://wa.me/5491153446030"
              target="_blank"
              rel="noopener noreferrer"
              className="glass-panel-gold"
              style={{
                display: "inline-block",
                padding: "14px 36px",
                borderRadius: 24,
                color: "var(--color-primary)",
                fontSize: 15,
                fontFamily: "var(--font-serif)",
                textDecoration: "none",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              Desbloquear Astral Guide ✦
            </a>
          </div>
        </footer>
      ) : (
        <footer
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--glass-border)",
            background: "rgba(10, 9, 16, 0.6)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
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
              background: "var(--glass-bg)",
              border: `1px solid ${isRecording ? "var(--color-primary-dim)" : "var(--glass-border)"}`,
              borderRadius: "24px",
              padding: "8px 16px",
              alignItems: "center",
              transition: "border-color 0.3s ease",
            }}
            onFocus={(e) => {
              if (!isRecording) e.currentTarget.style.border = "1px solid var(--color-primary-dim)";
            }}
            onBlur={(e) => {
              if (!isRecording) e.currentTarget.style.border = "1px solid var(--glass-border)";
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
                  placeholder="Preguntá al oráculo sobre tu semana..."
                  rows={1}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    color: "var(--text-main)",
                    fontSize: "15px",
                    fontWeight: 300,
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
                      color: "var(--text-faint)",
                      fontSize: 18,
                      transition: "all 0.3s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-faint)")}
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
                    background: isBusy || !input.trim() ? "transparent" : "var(--color-primary-dim)",
                    border: "none",
                    cursor: isBusy || !input.trim() ? "default" : "pointer",
                    color: isBusy || !input.trim() ? "var(--text-faint)" : "var(--text-main)",
                    fontSize: "18px",
                    transition: "all 0.3s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✦
                </button>
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
