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
  const toneClass = tone === "dark" ? "chat-copy-button--dark" : "chat-copy-button--light";

  return (
    <button
      onClick={onCopy}
      aria-label="Copiar mensaje"
      className={`chat-copy-button ${toneClass}${copied ? " chat-copy-button--copied" : ""}`}
    >
      {copied ? (
        <><span className="chat-copied-mark">✓</span><span>Copiado</span></>
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
    <div className="chat-shell">
      <main className="chat-main">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="chat-empty animate-fade-in-slow">
            <div className="chat-empty-title">
              Hola, {userName}
            </div>
            <div className="chat-empty-copy">
              Tu guía de Diseño Humano está lista para acompañarte.
            </div>
            <div className="chat-quick-actions">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="chat-quick-action"
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
            className={`chat-message-row chat-message-row--${msg.role} animate-fade-in`}
          >
            {msg.role === "user" ? (
              <div className="chat-user-stack">
                {editIndex === i ? (
                  /* Edit mode */
                  <div className="chat-edit-card">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="chat-edit-textarea"
                    />
                    <div className="chat-edit-actions">
                      <button
                        onClick={cancelEdit}
                        className="button-outline"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveEdit(i)}
                        disabled={!editText.trim() || isBusy}
                        className="button-gold"
                      >
                        Guardar y enviar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <>
                    <div className="chat-bubble-user">
                      {msg.content}
                    </div>
                    {/* Action buttons below user bubble */}
                    {msg.content && <div className="chat-message-actions">
                      <CopyButton tone="light" copied={copiedIndex === i} onCopy={() => copyMessage(msg.content, i)} />
                      {!isBusy && !limitReached && (
                        <button
                          onClick={() => startEdit(i)}
                          aria-label="Editar mensaje"
                          className="chat-edit-button"
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
              <div className="chat-assistant-card">
                <div className="chat-assistant-header">
                  Astral Guide
                </div>
                <ReportRenderer text={msg.content} />
                {/* Copy button */}
                {msg.content && (
                  <div className="chat-assistant-actions">
                    <CopyButton copied={copiedIndex === i} onCopy={() => copyMessage(msg.content, i)} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="chat-loading animate-fade-in">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="chat-loading-dot"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
            <span className="chat-loading-label">
              Canalizando tu lectura...
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="chat-error">
            {errorMsg}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Footer */}
      {limitReached ? (
        <footer className="chat-limit-footer animate-fade-in">
          <div className="chat-footer-inner">
            <h3 className="chat-limit-title">
              {limitExperience?.title ?? "Tu ventana de mensajes de este mes se completó"}
            </h3>
            <p className="chat-limit-copy">
              {limitExperience?.body ?? `Ya usaste tus ${limitValue} mensajes de este mes.`}
            </p>
            {showUpgradeCta && limitExperience?.ctaLabel && (
              <a
                href="https://wa.me/5491153446030"
                target="_blank"
                rel="noopener noreferrer"
                className="chat-limit-cta"
              >
                {limitExperience.ctaLabel}
              </a>
            )}
          </div>
        </footer>
      ) : (
        <footer className="chat-composer-footer">
          <div className={`chat-composer${isRecording ? " chat-composer--recording" : ""}`}>
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
                  className="chat-composer-input"
                />
                {/* Mic button — shown when input is empty and browser supports it */}
                {hasMicSupport && !input.trim() && !isBusy && (
                  <button
                    onClick={() => setIsRecording(true)}
                    aria-label="Grabar nota de voz"
                    className="chat-icon-button"
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
                  className="chat-icon-button chat-send-button"
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
