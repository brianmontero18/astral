/**
 * Utils
 *
 * - parseReport: parsea la respuesta del LLM en secciones por emoji.
 * - stripMarkdown: limpia asteriscos y formato residual del LLM.
 */

// ─── Section config ───────────────────────────────────────────────────────────

export const SECTION_META: Record<string, { label: string; color: string }> = {
  "🔭": { label: "Panorama General",      color: "#7c6fcd" },
  "⚡": { label: "Energía & Cuerpo",      color: "#e8b84b" },
  "💼": { label: "Trabajo & Creatividad", color: "#5ba3c9" },
  "❤️": { label: "Vínculos & Amor",       color: "#c96b7a" },
  "🧭": { label: "Estrategia",            color: "#6bba8a" },
  "⚠️": { label: "Puntos de Atención",    color: "#d4845a" },
};

export const SECTION_EMOJIS = Object.keys(SECTION_META);

// ─── Strip markdown ───────────────────────────────────────────────────────────

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/__(.+?)__/gs, "$1")
    .replace(/_(.+?)_/gs, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-–—]{3,}\s*$/gm, "")
    .trim();
}

// ─── Report parser ────────────────────────────────────────────────────────────

export interface ReportSection {
  icon: string | null;
  body: string;
}

export function parseReport(rawText: string): ReportSection[] {
  const text = stripMarkdown(rawText);
  const sections: ReportSection[] = [];
  let current: ReportSection | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const icon = SECTION_EMOJIS.find((e) => line.includes(e));

    if (icon) {
      if (current) sections.push(current);
      current = { icon, body: "" };
    } else if (current) {
      current.body += (current.body ? " " : "") + line;
    } else {
      // texto antes de la primera sección
      if (!sections.length || sections[0].icon !== null) {
        sections.unshift({ icon: null, body: "" });
      }
      sections[0].body += (sections[0].body ? " " : "") + line;
    }
  }

  if (current) sections.push(current);
  return sections;
}
