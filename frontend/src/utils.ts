/**
 * Utils
 *
 * - parseReport: parsea la respuesta del LLM en secciones por emoji.
 *   Preserva párrafos (líneas vacías) y formato inline.
 */

// ─── Section config ───────────────────────────────────────────────────────────

export type SectionIconKey =
  | "telescope"
  | "lightning"
  | "briefcase"
  | "heart"
  | "megaphone"
  | "compass"
  | "alert";

export const SECTION_META: Record<string, { label: string; color: string; iconKey: SectionIconKey }> = {
  "🔭": { label: "Panorama General",       color: "#cfac6c", iconKey: "telescope" },
  "⚡": { label: "Energía & Cuerpo",       color: "#e0c081", iconKey: "lightning" },
  "💼": { label: "Trabajo & Creatividad",  color: "#8aa897", iconKey: "briefcase" },
  "❤️": { label: "Vínculos & Amor",        color: "#d7c7ad", iconKey: "heart" },
  "📣": { label: "Comunicación & Marca",   color: "#bfa985", iconKey: "megaphone" },
  "🧭": { label: "Estrategia",             color: "#9d7f4d", iconKey: "compass" },
  "⚠️": { label: "Puntos de Atención",     color: "#c98c5a", iconKey: "alert" },
};

export const SECTION_EMOJIS = Object.keys(SECTION_META);

const SECTION_EXTRA_LABEL_ALIASES: Record<string, string[]> = {
  "🧭": ["Estrategia de la semana"],
};

const SECTION_LABEL_ALIASES: Record<string, string[]> = Object.fromEntries(
  Object.entries(SECTION_META).map(([icon, meta]) => [
    icon,
    [meta.label, ...(SECTION_EXTRA_LABEL_ALIASES[icon] ?? [])],
  ]),
);

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

export interface ChatReportSection {
  icon: string | null;
  body: string;
}

function normalizeSectionLabel(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startsWithSectionLabel(text: string, alias: string): boolean {
  const normalizedText = normalizeSectionLabel(text);
  const normalizedAlias = normalizeSectionLabel(alias);
  const next = normalizedText.charAt(normalizedAlias.length);
  return normalizedText.startsWith(normalizedAlias) && (!next || /\s|[:\-–—]/.test(next));
}

function stripSectionHeaderLabel(icon: string, rest: string): string {
  const allCapsStripped = rest.replace(/^[A-ZÁÉÍÓÚÑÜ&\s]{3,}(?=\s|$|[:\-–—])/, "").trim();
  if (allCapsStripped !== rest) return allCapsStripped;

  const aliases = [...(SECTION_LABEL_ALIASES[icon] ?? [])].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const labelPattern = new RegExp(`^${escapeRegex(alias)}(?=\\s|$|[:\\-–—])`, "i");
    if (labelPattern.test(rest)) {
      return rest.replace(labelPattern, "").trim();
    }
  }
  return rest;
}

function parseSectionHeader(line: string): { icon: string; rest: string } | null {
  const icon = SECTION_EMOJIS.find(e => line.startsWith(e));
  if (!icon) return null;

  const rest = line.slice(icon.length).trim();
  if (!rest) return null;

  const aliases = SECTION_LABEL_ALIASES[icon] ?? [];
  const isKnownHeader = aliases.some(alias => startsWithSectionLabel(rest, alias));
  if (!isKnownHeader) return null;

  return { icon, rest };
}

export function parseReport(rawText: string): ChatReportSection[] {
  const sections: ChatReportSection[] = [];
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
    const header = parseSectionHeader(trimmed);

    if (header) {
      flush();
      currentIcon = header.icon;
      let rest = stripSectionHeaderLabel(header.icon, header.rest);
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
