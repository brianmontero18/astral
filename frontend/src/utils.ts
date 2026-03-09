/**
 * Utils
 *
 * - parseReport: parsea la respuesta del LLM en secciones por emoji.
 *   Preserva párrafos (líneas vacías) y formato inline.
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

// ─── Center display names (canonical English → Spanish) ──────────────────────

export const CENTER_DISPLAY: Record<string, string> = {
  Head: "Cabeza", Ajna: "Ajna", Throat: "Garganta",
  G: "Centro G", Heart: "Corazón", Spleen: "Bazo",
  Sacral: "Sacral", SolarPlexus: "Plexo Solar", Root: "Raíz",
};

export function translateCenter(id: string): string {
  return CENTER_DISPLAY[id] ?? id;
}

export function translateCenters(ids: string[]): string {
  return ids.map(translateCenter).join(", ");
}

// ─── Report parser ────────────────────────────────────────────────────────────

export interface ReportSection {
  icon: string | null;
  body: string;
}

export function parseReport(rawText: string): ReportSection[] {
  const sections: ReportSection[] = [];
  let currentIcon: string | null = null;
  let bodyLines: string[] = [];

  function flush() {
    const body = bodyLines.join("\n").trim();
    if (body || currentIcon !== null) {
      sections.push({ icon: currentIcon, body });
    }
    bodyLines = [];
  }

  for (const raw of rawText.split("\n")) {
    const trimmed = raw.trim();
    const icon = SECTION_EMOJIS.find(e => trimmed.includes(e));

    if (icon) {
      flush();
      currentIcon = icon;
      // Extract any body text on the header line after emoji + label
      let rest = trimmed.replace(icon, "").trim();
      // Strip ALL-CAPS header label (e.g., "PANORAMA GENERAL")
      rest = rest.replace(/^[A-ZÁÉÍÓÚÑÜ&\s]{3,}(?=\s|$|[:\-–—])/, "").trim();
      rest = rest.replace(/^[:\-–—]\s*/, "").trim();
      if (rest) bodyLines.push(rest);
    } else {
      // Keep empty lines — they become paragraph breaks
      bodyLines.push(trimmed);
    }
  }

  flush();
  return sections;
}
