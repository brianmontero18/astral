import { parseReport, SECTION_META, stripMarkdown } from "../utils";

interface Props {
  text: string;
}

export function ReportRenderer({ text }: Props) {
  const sections = parseReport(text);

  if (!sections.length) {
    return (
      <p style={{ color: "#c8c0e8", lineHeight: 1.8, margin: 0, fontSize: 14 }}>
        {stripMarkdown(text)}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sections.map((s, i) => {
        if (!s.icon) {
          return (
            <p key={i} style={{ color: "#c8c0e8", lineHeight: 1.8, margin: 0, fontSize: 14 }}>
              {s.body}
            </p>
          );
        }

        const meta = SECTION_META[s.icon] ?? { label: s.icon, color: "#7c6fcd" };

        return (
          <div
            key={i}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${meta.color}33`,
              borderLeft: `3px solid ${meta.color}`,
              borderRadius: 10,
              padding: "13px 16px",
              animation: `fadeIn 0.4s ease ${i * 0.07}s both`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
              <span style={{ fontSize: 15 }}>{s.icon}</span>
              <span style={{
                color: meta.color,
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}>
                {meta.label}
              </span>
            </div>
            <p style={{ color: "#d4cef0", lineHeight: 1.8, margin: 0, fontSize: 13 }}>
              {s.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}
