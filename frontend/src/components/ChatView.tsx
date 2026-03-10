import { useState, useEffect, useRef } from "react";
import { ReportRenderer } from "./ReportRenderer";
import { sendChat, sendChatStream, getChatHistory } from "../api";
import type { ChatMessage, LocalUser } from "../types";

const QUICK_ACTIONS = [
  "Reporte semanal completo",
  "¿Cómo está mi energía esta semana?",
  "¿Qué tránsitos me afectan hoy?",
];

interface Props {
  user: LocalUser;
}

export function ChatView({ user }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [messageUsage, setMessageUsage] = useState<{ used: number; limit: number } | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    getChatHistory(user.id)
      .then(({ messages: history, used, limit }) => {
        if (history.length) {
          setMessages(history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
        }
        setMessageUsage({ used, limit });
        if (used >= limit) setLimitReached(true);
      })
      .catch(() => {
        // Silently ignore — user just won't see history
      })
      .finally(() => setHistoryLoaded(true));
  }, [user.id]);

  useEffect(() => {
    const el = bottomRef.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const [streaming, setStreaming] = useState(false);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || streaming || limitReached) return;

    setErrorMsg(null);
    setInput("");

    const updated: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(updated);
    setLoading(true);

    // Optimistically increment usage
    setMessageUsage((prev) => prev ? { ...prev, used: prev.used + 1 } : prev);

    try {
      // Add empty assistant placeholder
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

      // Check if this was the last free message
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
        setMessages(messages); // Revert — message wasn't sent
        setLoading(false);
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      // If streaming failed before any content, try non-streaming fallback
      setMessages(updated); // Remove empty placeholder
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
          setMessages(messages);
          setLoading(false);
          return;
        }
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        setErrorMsg(msg || msg2);
        // Revert optimistic increment on error
        setMessageUsage((prev) => prev ? { ...prev, used: prev.used - 1 } : prev);
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

  if (!historyLoaded) return null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Chat messages */}
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
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 48 }} className="animate-fade-in-slow">
            <div style={{ color: "var(--color-primary)", fontSize: "38px", marginBottom: "16px" }}>✦</div>
            <div style={{ color: "var(--text-main)", fontSize: "20px", marginBottom: "8px", fontFamily: "var(--font-serif)", fontWeight: 400 }}>
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
                    fontFamily: "var(--font-sans)"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--color-primary-dim)"; e.currentTarget.style.color = "var(--text-main)" }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.color = "var(--text-muted)" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
            className="animate-fade-in"
          >
            {msg.role === "user" ? (
              <div
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "20px 20px 4px 20px",
                  padding: "12px 18px",
                  color: "var(--text-main)",
                  fontSize: "15px",
                  fontWeight: 300,
                  maxWidth: "80%",
                  lineHeight: 1.6,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div style={{ maxWidth: "95%", width: "100%" }}>
                <div style={{ 
                  color: "var(--color-primary)", 
                  fontSize: "10px", 
                  marginBottom: "8px", 
                  letterSpacing: "0.15em",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                  <span>✦</span> ASTRAL GUIDE
                </div>
                <ReportRenderer text={msg.content} />
              </div>
            )}
          </div>
        ))}

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
            <span style={{ color: "var(--text-faint)", fontSize: "12px", letterSpacing: "0.05em" }}>Canalizando estrellas...</span>
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

      {/* Footer: Paywall or Input */}
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
            <h3 style={{
              fontFamily: "var(--font-serif)",
              color: "var(--color-primary)",
              fontSize: 22,
              fontWeight: 400,
              marginBottom: 8,
              margin: "0 0 8px 0",
            }}>
              Tu ventana al cosmos se ha completado
            </h3>
            <p style={{
              color: "var(--text-muted)",
              fontSize: 14,
              fontWeight: 300,
              marginBottom: 24,
              lineHeight: 1.6,
            }}>
              Has usado tus {messageUsage?.limit ?? 15} mensajes de exploración. Para seguir recibiendo
              guía estelar personalizada, accedé al plan completo.
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
              border: "1px solid var(--glass-border)",
              borderRadius: "24px",
              padding: "8px 16px",
              alignItems: "center",
              transition: "border-color 0.3s ease",
            }}
            onFocus={(e) => e.currentTarget.style.border = "1px solid var(--color-primary-dim)"}
            onBlur={(e) => e.currentTarget.style.border = "1px solid var(--glass-border)"}
          >
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
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || streaming || !input.trim()}
              aria-label="Enviar"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                flexShrink: 0,
                background: loading || streaming || !input.trim() ? "transparent" : "var(--color-primary-dim)",
                border: "none",
                cursor: loading || streaming || !input.trim() ? "default" : "pointer",
                color: loading || streaming || !input.trim() ? "var(--text-faint)" : "var(--text-main)",
                fontSize: "18px",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✦
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
