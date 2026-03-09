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

/** Render a single line, detecting headers, list items, or plain text */
function renderLine(line: string, key: number): React.ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Markdown header: ### Heading
  const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)/);
  if (headerMatch) {
    const level = headerMatch[1].length;
    const sizes = ["16px", "14px", "13px", "12px"];
    return (
      <div key={key} style={{
        ...TEXT_STYLE,
        fontSize: sizes[level - 1] ?? "13px",
        fontWeight: 500,
        color: "var(--color-accent)",
        margin: "10px 0 4px",
      }}>
        {renderInline(headerMatch[2])}
      </div>
    );
  }

  // Unordered list item: - text or • text
  if (/^[-•]\s/.test(trimmed)) {
    return (
      <li key={key} style={TEXT_STYLE}>
        {renderInline(trimmed.replace(/^[-•]\s*/, ""))}
      </li>
    );
  }

  // Ordered list item: 1. text or 2) text
  if (/^\d+[.)]\s/.test(trimmed)) {
    return (
      <li key={key} style={TEXT_STYLE}>
        {renderInline(trimmed.replace(/^\d+[.)]\s*/, ""))}
      </li>
    );
  }

  // Regular paragraph
  return (
    <p key={key} style={{ ...TEXT_STYLE, margin: "4px 0" }}>
      {renderInline(trimmed)}
    </p>
  );
}

/** Render a body string as paragraphs, lists, headers, etc. */
function renderBody(body: string) {
  const lines = body.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;
  let key = 0;

  function flushList() {
    if (listBuffer.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={`list-${key++}`} style={{ margin: "4px 0", paddingLeft: 20 }}>
          {listBuffer}
        </Tag>
      );
      listBuffer = [];
      listType = null;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line = paragraph break, flush any pending list
    if (!trimmed) {
      flushList();
      continue;
    }

    const isUl = /^[-•]\s/.test(trimmed);
    const isOl = /^\d+[.)]\s/.test(trimmed);

    if (isUl) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(renderLine(trimmed, key++));
    } else if (isOl) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(renderLine(trimmed, key++));
    } else {
      flushList();
      elements.push(renderLine(trimmed, key++));
    }
  }

  flushList();
  return elements;
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
