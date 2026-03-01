import { useState, useEffect, useRef } from "react";
import { ReportRenderer } from "./ReportRenderer";
import { sendChat, getChatHistory } from "../api";
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
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    getChatHistory(user.id)
      .then(({ messages: history }) => {
        if (history.length) {
          setMessages(history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
        }
      })
      .catch(() => {
        // Silently ignore — user just won't see history
      })
      .finally(() => setHistoryLoaded(true));
  }, [user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setErrorMsg(null);
    setInput("");

    const updated: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(updated);
    setLoading(true);

    try {
      const data = await sendChat(user.id, updated);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
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
    <>
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
          <div style={{ textAlign: "center", marginTop: 48, animation: "fadeIn 0.6s ease" }}>
            <div style={{ fontSize: 38, marginBottom: 12 }}>✦</div>
            <div style={{ color: "#e8e0ff", fontSize: 20, marginBottom: 6, fontStyle: "italic" }}>
              Hola, {user.name}
            </div>
            <div style={{ color: "#7c6fcd", fontSize: 13, marginBottom: 28 }}>
              Tu carta natal y diseño humano están cargados
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    background: "rgba(124,111,205,0.12)",
                    border: "1px solid rgba(124,111,205,0.35)",
                    color: "#c0b4f0",
                    padding: "9px 14px",
                    borderRadius: 20,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
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
              animation: "fadeIn 0.3s ease",
            }}
          >
            {msg.role === "user" ? (
              <div
                style={{
                  background: "rgba(124,111,205,0.25)",
                  border: "1px solid rgba(124,111,205,0.4)",
                  borderRadius: "16px 16px 4px 16px",
                  padding: "10px 14px",
                  color: "#e8e0ff",
                  fontSize: 14,
                  maxWidth: "80%",
                  lineHeight: 1.6,
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div style={{ maxWidth: "95%", width: "100%" }}>
                <div style={{ color: "#7c6fcd", fontSize: 10, marginBottom: 8, letterSpacing: "0.1em" }}>
                  ✦ ASTRAL GUIDE
                </div>
                <ReportRenderer text={msg.content} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.2s ease" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#7c6fcd",
                  animation: `pulse 1.2s ease infinite ${i * 0.2}s`,
                }}
              />
            ))}
            <span style={{ color: "#7c6fcd", fontSize: 12 }}>Consultando los astros...</span>
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

      {/* Input */}
      <footer
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(124,111,205,0.2)",
          backdropFilter: "blur(10px)",
          background: "rgba(13,8,32,0.75)",
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            maxWidth: 760,
            margin: "0 auto",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(124,111,205,0.35)",
            borderRadius: 14,
            padding: "10px 14px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Preguntá sobre tu semana, tus tránsitos, tu energía..."
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "#e8e0ff",
              fontSize: 14,
              fontFamily: "Georgia, serif",
              resize: "none",
              lineHeight: 1.5,
              paddingTop: 2,
              outline: "none",
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            aria-label="Enviar"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              flexShrink: 0,
              background: loading || !input.trim() ? "rgba(124,111,205,0.2)" : "#7c6fcd",
              border: "none",
              cursor: loading || !input.trim() ? "default" : "pointer",
              color: "#fff",
              fontSize: 15,
              transition: "background 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✦
          </button>
        </div>
      </footer>
    </>
  );
}
