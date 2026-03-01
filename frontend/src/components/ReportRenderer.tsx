import { parseReport, SECTION_META, stripMarkdown } from "../utils";

interface Props {
  text: string;
}

export function ReportRenderer({ text }: Props) {
  const sections = parseReport(text);

  if (!sections.length) {
    return (
      <p style={{ color: "var(--text-main)", lineHeight: 1.8, margin: 0, fontSize: "15px", fontFamily: "var(--font-serif)", fontWeight: 300 }}>
        {stripMarkdown(text)}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sections.map((s, i) => {
        if (!s.icon) {
          return (
            <p key={i} style={{ color: "var(--text-main)", lineHeight: 1.8, margin: 0, fontSize: "15px", fontFamily: "var(--font-serif)", fontWeight: 300 }}>
              {s.body}
            </p>
          );
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
            <p style={{ color: "var(--text-main)", lineHeight: 1.8, margin: 0, fontSize: "15px", fontFamily: "var(--font-serif)", fontWeight: 300 }}>
              {s.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}
