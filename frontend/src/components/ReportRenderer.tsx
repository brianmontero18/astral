import React from "react";
import { parseReport, SECTION_META, type SectionIconKey } from "../utils";

// ─── Section SVG icons ───────────────────────────────────────────────────────

function SectionIcon({ iconKey }: { iconKey: SectionIconKey }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (iconKey) {
    case "telescope":
      return (
        <svg {...common}>
          <path d="M3 14l7-7 4 4-7 7z" />
          <path d="M11 11l5-5 3 3-5 5" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
        </svg>
      );
    case "lightning":
      return (
        <svg {...common}>
          <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...common}>
          <path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2z" />
          <path d="M16 8a4 4 0 0 1 0 8" />
          <path d="M19 5a8 8 0 0 1 0 14" />
        </svg>
      );
    case "compass":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
}

// ─── Inline formatting ───────────────────────────────────────────────────────

const TEXT_STYLE: React.CSSProperties = {
  color: "var(--text-main)",
  lineHeight: 1.85,
  fontSize: "15px",
  fontFamily: "var(--font-serif)",
  fontWeight: 400,
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
    const sizes = ["18px", "16px", "14px", "13px"];
    return (
      <div key={key} style={{
        ...TEXT_STYLE,
        fontSize: sizes[level - 1] ?? "13px",
        fontWeight: 600,
        color: "var(--color-primary)",
        margin: "12px 0 6px",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sections.map((s, i) => {
        if (!s.icon) {
          return <div key={i}>{renderBody(s.body)}</div>;
        }

        const meta = SECTION_META[s.icon] ?? null;

        return (
          <div
            key={i}
            style={{
              background: "rgba(248, 244, 232, 0.04)",
              border: "1px solid rgba(248, 244, 232, 0.08)",
              borderLeft: `3px solid ${meta?.color ?? "var(--color-primary)"}`,
              padding: "18px 22px",
              animation: `fadeInSlow 0.6s ease ${i * 0.1}s both`,
              borderRadius: "4px 14px 14px 4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", paddingBottom: 10, borderBottom: `1px solid ${meta?.color ?? "var(--color-primary)"}33` }}>
              <span style={{ display: "inline-flex", alignItems: "center", color: meta?.color ?? "var(--color-primary)" }}>
                {meta ? <SectionIcon iconKey={meta.iconKey} /> : <span>{s.icon}</span>}
              </span>
              <span style={{
                color: meta?.color ?? "var(--color-primary)",
                fontWeight: 700,
                fontSize: "10px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                fontFamily: "var(--font-sans)",
              }}>
                {meta?.label ?? s.icon}
              </span>
            </div>
            {renderBody(s.body)}
          </div>
        );
      })}
    </div>
  );
}
