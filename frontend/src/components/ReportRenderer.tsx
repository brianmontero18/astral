import React from "react";
import { parseReport, SECTION_META } from "../utils";

// ─── Inline formatting ───────────────────────────────────────────────────────

const TEXT_STYLE: React.CSSProperties = {
  color: "var(--text-main)",
  lineHeight: 1.8,
  fontSize: "15px",
  fontFamily: "var(--font-serif)",
  fontWeight: 300,
};

/** Render **bold** inline within text */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      : part
  );
}

// ─── Block rendering ─────────────────────────────────────────────────────────

/** Render a body string as paragraphs, lists, etc. */
function renderBody(body: string) {
  // Split into blocks by blank lines
  const blocks = body.split(/\n{2,}/);

  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    const lines = trimmed.split("\n").filter(l => l.trim());

    // Unordered list: all lines start with - or •
    if (lines.length > 0 && lines.every(l => /^[-•]\s/.test(l.trim()))) {
      return (
        <ul key={i} style={{ margin: "4px 0", paddingLeft: 20 }}>
          {lines.map((l, j) => (
            <li key={j} style={TEXT_STYLE}>
              {renderInline(l.trim().replace(/^[-•]\s*/, ""))}
            </li>
          ))}
        </ul>
      );
    }

    // Ordered list: all lines start with 1. / 2) etc.
    if (lines.length > 0 && lines.every(l => /^\d+[.)]\s/.test(l.trim()))) {
      return (
        <ol key={i} style={{ margin: "4px 0", paddingLeft: 20 }}>
          {lines.map((l, j) => (
            <li key={j} style={TEXT_STYLE}>
              {renderInline(l.trim().replace(/^\d+[.)]\s*/, ""))}
            </li>
          ))}
        </ol>
      );
    }

    // Regular paragraph
    return (
      <p key={i} style={{ ...TEXT_STYLE, margin: "4px 0" }}>
        {renderInline(lines.join(" "))}
      </p>
    );
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  text: string;
}

export function ReportRenderer({ text }: Props) {
  const sections = parseReport(text);

  if (!sections.length) {
    return <div style={{ display: "flex", flexDirection: "column" }}>{renderBody(text)}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sections.map((s, i) => {
        if (!s.icon) {
          return <div key={i}>{renderBody(s.body)}</div>;
        }

        const meta = SECTION_META[s.icon] ?? { label: s.icon, color: "var(--color-primary)" };

        return (
          <div
            key={i}
            className="glass-panel"
            style={{
              borderLeft: `2px solid ${meta.color}`,
              padding: "16px 20px",
              animation: `fadeInSlow 0.6s ease ${i * 0.1}s both`,
              borderRadius: "4px 16px 16px 4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "16px" }}>{s.icon}</span>
              <span style={{
                color: meta.color,
                fontWeight: 500,
                fontSize: "11px",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontFamily: "var(--font-sans)",
              }}>
                {meta.label}
              </span>
            </div>
            {renderBody(s.body)}
          </div>
        );
      })}
    </div>
  );
}
