/**
 * Extraction Service — 100% deterministic PDF parsing
 *
 * Reads Human Design bodygraph PDFs (MyHumanDesign o Genetic Matrix) y
 * extrae un UserProfile estructurado vía parser determinístico
 * (pdfjs-dist + regex). Cero LLM calls, cero Vision.
 *
 * Si el PDF no es de un proveedor soportado o no tiene texto extraíble,
 * tira UserFacingError pidiendo reexportar desde la fuente oficial.
 *
 * Historical note: el Vision fallback que existía (FEATURE_EXTRACTION_VISION_FALLBACK)
 * fue eliminado en astral-1c6 — la calidad no era verificable a >95% y
 * producía data incierta. Para PDFs imagen-only no aceptamos extracción.
 */

import type { UserProfile } from "./types/agent.js";
import { HD_CHANNELS } from "./hd-channels.js";
import { parseGeneticMatrixText } from "./hd-pdf/genetic-matrix.js";
import { parseMyHumanDesignText } from "./hd-pdf/myhumandesign.js";
import { extractPdfText } from "./hd-pdf/pdf-text.js";
import { deriveChannelsAndCenters } from "./hd-pdf/validate.js";

const PDF_ONLY_MESSAGE =
  "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas.";
const UNSUPPORTED_SOURCE_MESSAGE =
  "Solo aceptamos PDFs oficiales de MyHumanDesign o Genetic Matrix. Reexporta el bodygraph desde la fuente oficial.";
const UNREADABLE_PDF_MESSAGE =
  "No pudimos leer tu PDF. Reexporta el bodygraph desde la fuente oficial y vuelve a subirlo.";

export class UserFacingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetData {
  mimeType: string;
  data: Buffer;
  filename: string;
  fileType: string; // "natal" | "hd"
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type PdfProvider = "myhumandesign" | "genetic-matrix";

function detectPdfProvider(text: string): PdfProvider | null {
  if (/geneticmatrix\.com/i.test(text)) return "genetic-matrix";
  if (/my\s*human\s*design/i.test(text)) return "myhumandesign";
  if (/myhumandesign/i.test(text)) return "myhumandesign";
  return null;
}


function buildProfileFromGates(
  gates: UserProfile["humanDesign"]["activatedGates"],
  provider: string,
): UserProfile {
  const { channelIds, definedCenters, undefinedCenters } = deriveChannelsAndCenters(
    gates,
    provider,
  );

  const channels = channelIds.map((id) => ({
    id,
    name: HD_CHANNELS[id] ?? "",
    circuit: "",
  }));

  return {
    name: "",
    humanDesign: {
      type: "",
      strategy: "",
      authority: "",
      profile: "",
      definition: "",
      incarnationCross: "",
      notSelfTheme: "",
      variable: "",
      digestion: "",
      environment: "",
      strongestSense: "",
      channels,
      activatedGates: gates,
      definedCenters,
      undefinedCenters,
    },
  };
}

type HdSummary = {
  name?: string;
  humanDesign: Partial<UserProfile["humanDesign"]>;
};

const HD_TYPE_MAP: Record<string, string> = {
  // English (MyHumanDesign + Genetic Matrix EN)
  "Manifesting Generator": "Generador Manifestante",
  "Emotional Manifesting Generator": "Generador Manifestante",
  "Sacral Manifesting Generator": "Generador Manifestante",
  "Splenic Manifesting Generator": "Generador Manifestante",
  "Generator": "Generador",
  "Emotional Generator": "Generador",
  "Sacral Generator": "Generador",
  "Splenic Generator": "Generador",
  "Projector": "Proyector",
  "Emotional Projector": "Proyector",
  "Splenic Projector": "Proyector",
  "Ego Projector": "Proyector",
  "Self-Projected Projector": "Proyector",
  "Mental Projector": "Proyector",
  "Manifestor": "Manifestador",
  "Emotional Manifestor": "Manifestador",
  "Splenic Manifestor": "Manifestador",
  "Ego Manifestor": "Manifestador",
  "Reflector": "Reflector",
  // Spanish (Genetic Matrix ES — el sitio detecta locale del browser)
  "Generador Manifestante Emocional": "Generador Manifestante",
  "Generador Manifestante Sacral": "Generador Manifestante",
  "Generador Manifestante Esplénico": "Generador Manifestante",
  "Generador Emocional": "Generador",
  "Generador Sacral": "Generador",
  "Generador Esplénico": "Generador",
  "Proyector Emocional": "Proyector",
  "Proyector Esplénico": "Proyector",
  "Proyector Ego": "Proyector",
  "Proyector Auto-Proyectado": "Proyector",
  "Proyector Mental": "Proyector",
  "Manifestador Emocional": "Manifestador",
  "Manifestador Esplénico": "Manifestador",
  "Manifestador Ego": "Manifestador",
};

const HD_STRATEGY_MAP: Record<string, string> = {
  "Responding": "Responder",
  "To Respond": "Responder",
  "Waiting to Respond": "Esperar para responder",
  "Informing": "Informar",
  "Waiting for Invitation": "Esperar la invitación",
  "Waiting for the Invitation": "Esperar la invitación",
  "Waiting a Lunar Cycle": "Esperar un ciclo lunar",
  "Waiting for the Lunar Cycle": "Esperar un ciclo lunar",
};

const HD_AUTHORITY_MAP: Array<{ test: (value: string) => boolean; value: string }> = [
  { test: (v) => /emotional|solar plexus|plexo\s+solar/i.test(v), value: "Emocional (Plexo Solar)" },
  { test: (v) => /\bsacral\b/i.test(v), value: "Sacral" },
  { test: (v) => /\bsplenic\b|\bbazo\b|espl[ée]nica/i.test(v), value: "Esplénica" },
  { test: (v) => /\bego\b|\bheart\b|coraz[oó]n/i.test(v), value: "Ego/Corazón" },
  { test: (v) => /self[-\s]?projected|auto[-\s]?proyectad[ao]/i.test(v), value: "Auto-proyectada" },
  { test: (v) => /mental|environment|ambiente/i.test(v), value: "Mental/Ambiente" },
  { test: (v) => /\blunar\b/i.test(v), value: "Lunar" },
];

const HD_DEFINITION_MAP: Record<string, string> = {
  "Single Definition": "Definición simple",
  "Split Definition": "Definición dividida",
  "Triple Split Definition": "Definición triple dividida",
  "Quadruple Split Definition": "Definición cuádruple dividida",
  "No Definition": "Sin definición",
  // Genetic Matrix format: "Single", "Split - Small (6)", "Triple Split", etc.
  "Single": "Definición simple",
  "Split": "Definición dividida",
  "Triple Split": "Definición triple dividida",
  "Quadruple Split": "Definición cuádruple dividida",
  // Spanish (Genetic Matrix ES)
  "Definición Singular": "Definición simple",
  "Definición Dividida": "Definición dividida",
  "Definición Triple Dividida": "Definición triple dividida",
  "Definición Cuádruple Dividida": "Definición cuádruple dividida",
  "Sin Definición": "Sin definición",
};

const HD_NOT_SELF_MAP: Record<string, string> = {
  "Frustration": "Frustración",
  "Anger": "Ira",
  "Bitterness": "Amargura",
  "Disappointment": "Decepción",
};

// Strategy + Not-Self theme están determinados por el Type. Cuando la fuente
// (e.g. Genetic Matrix Foundation Chart) no los imprime, los derivamos para
// no dejar el bodygraph con campos vacíos en review ni privar al agente del
// dato al cruzar tránsitos.
const HD_TYPE_IMPLIED: Record<string, { strategy: string; notSelfTheme: string }> = {
  "Generador": {
    strategy: "Esperar para responder",
    notSelfTheme: "Frustración",
  },
  "Generador Manifestante": {
    strategy: "Esperar para responder y luego informar",
    notSelfTheme: "Frustración",
  },
  "Manifestador": {
    strategy: "Informar antes de actuar",
    notSelfTheme: "Ira",
  },
  "Proyector": {
    strategy: "Esperar la invitación",
    notSelfTheme: "Amargura",
  },
  "Reflector": {
    strategy: "Esperar un ciclo lunar",
    notSelfTheme: "Decepción",
  },
};

export function deriveImpliedFields(profile: UserProfile): UserProfile {
  const type = profile.humanDesign.type?.trim();
  if (!type) return profile;
  const implied = HD_TYPE_IMPLIED[type];
  if (!implied) return profile;
  if (!profile.humanDesign.strategy?.trim()) {
    profile.humanDesign.strategy = implied.strategy;
  }
  if (!profile.humanDesign.notSelfTheme?.trim()) {
    profile.humanDesign.notSelfTheme = implied.notSelfTheme;
  }
  return profile;
}

const HD_DIGESTION_MAP: Record<string, string> = {
  "Peace & Quiet": "Paz y Quietud",
  "Hot Thirst": "Sed caliente",
  "Cold Thirst": "Sed fría",
  "Open Taste": "Gusto abierto",
  "Closed Taste": "Gusto cerrado",
  "High Sound": "Sonido alto",
  "Low Sound": "Sonido bajo",
  "Direct Light": "Luz directa",
  "Indirect Light": "Luz indirecta",
};

const HD_ENVIRONMENT_MAP: Record<string, string> = {
  "Shores": "Costas",
  "Caves": "Cuevas",
  "Markets": "Mercados",
  "Kitchens": "Cocinas",
  "Mountains": "Montañas",
  "Valleys": "Valles",
};

const HD_STRONGEST_SENSE_MAP: Record<string, string> = {
  "Feeling": "Sentir",
  "Touch": "Tacto",
  "Taste": "Gusto",
  "Smell": "Olfato",
  "Outer Vision": "Visión externa",
  "Inner Vision": "Visión interna",
  "Sound": "Sonido",
};

const HD_CROSS_PREFIX_MAP: Record<string, string> = {
  "Left Angle Cross of": "Cruz de Ángulo Izquierdo de",
  "Right Angle Cross of": "Cruz de Ángulo Derecho de",
  "Juxtaposition Cross of": "Cruz de Yuxtaposición de",
  // Genetic Matrix abbreviated format
  "LAX": "Cruz de Ángulo Izquierdo de",
  "RAX": "Cruz de Ángulo Derecho de",
  "JXP": "Cruz de Yuxtaposición de",
};

const HD_CROSS_TITLE_MAP: Record<string, string> = {
  "Industry": "Industria",
};

function normalizeField(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const LOWERCASE_NAME_PARTICLES = new Set(["de", "del", "la", "las", "los", "y"]);

function normalizeExtractedName(value: string): string {
  const normalized = normalizeField(value);
  if (!normalized) return normalized;

  const letters = normalized.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return normalized;

  const isAllLower = letters.every((char) => char === char.toLocaleLowerCase("es"));
  const isAllUpper = letters.every((char) => char === char.toLocaleUpperCase("es"));
  if (!isAllLower && !isAllUpper) return normalized;

  return normalized
    .split(" ")
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("es");
      if (index > 0 && LOWERCASE_NAME_PARTICLES.has(lower)) return lower;
      return lower.replace(/^\p{L}/u, (first) => first.toLocaleUpperCase("es"));
    })
    .join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePhrases(value: string, map: Record<string, string>): string {
  let out = value;
  for (const [from, to] of Object.entries(map)) {
    const re = new RegExp(escapeRegExp(from), "gi");
    out = out.replace(re, to);
  }
  return out;
}

function translateCrossTitle(value: string): string {
  // Format with parentheses: "Cruz de Ángulo Izquierdo de Industry (1)"
  const matchParen = value.match(/^(.* de )([^()]+)(\s*\(.*\))$/);
  if (matchParen) {
    const [, prefix, title, suffix] = matchParen;
    const translated = HD_CROSS_TITLE_MAP[title.trim()] ?? title.trim();
    return `${prefix}${translated}${suffix}`;
  }
  // Format without parentheses: "Cruz de Ángulo Izquierdo de Industry 1"
  const matchPlain = value.match(/^(.* de )(.+?)(\s+\d+)?$/);
  if (matchPlain) {
    const [, prefix, title, numSuffix] = matchPlain;
    const translated = HD_CROSS_TITLE_MAP[title.trim()] ?? title.trim();
    return `${prefix}${translated}${numSuffix ?? ""}`;
  }
  return value;
}

function extractSection(
  text: string,
  label: string,
  allLabelsUpper: string[],
): string | null {
  const upper = text.toUpperCase();
  const labelUpper = label.toUpperCase();
  const start = upper.indexOf(labelUpper);
  if (start === -1) return null;
  const from = start + labelUpper.length;
  let end = text.length;
  for (const other of allLabelsUpper) {
    if (other === labelUpper) continue;
    const idx = upper.indexOf(other, from);
    if (idx !== -1 && idx < end) end = idx;
  }
  return normalizeField(text.slice(from, end));
}

export function parseHdSummaryFromText(text: string): HdSummary {
  const cleaned = normalizeField(text);

  // Labels en los 3 formatos reales:
  // - MyHumanDesign EN: "TYPE Generator …"
  // - Genetic Matrix EN: "Type: Generator …"
  // - Genetic Matrix ES: "Tipo: Generador …" (el sitio detecta locale del browser)
  const labels = [
    "TYPE ",
    "TYPE: ",
    "TIPO: ",
    "PROFILE ",
    "PROFILE: ",
    "PERFIL: ",
    "NOT SELF THEME ",
    "DEFINITION ",
    "DEFINITION: ",
    "DEFINICIÓN: ",
    "DIGESTION ",
    "ENVIRONMENT ",
    "AUTHORITY (THE WAY YOU MAKE DECISIONS) ",
    "INNER AUTHORITY: ",
    "AUTORIDAD INTERNA: ",
    "STRATEGY ",
    "STRATEGY: ",
    "LIFE THEME (INCARNATION CROSS) ",
    "INCARNATION CROSS: ",
    "ENCARNACIÓN CRUZ: ",
    "YOUR STRONGEST SENSE ",
    "YOUR MOST IMPORTANT GIFT ",
    "YOUR OTHER GIFTS ",
    "SIGN ",
    "CHANNELS: ",
    "CANALES: ",
    "NOMBRE: ",
  ];
  const allLabelsUpper = labels.map((l) => l.toUpperCase());

  const summary: HdSummary = { humanDesign: {} };

  // Name extraction (MyHumanDesign format)
  const nameMatch = cleaned.match(/\bName\s+([^\s].*?)\s+Design\b/i);
  if (nameMatch && !/not available/i.test(nameMatch[1])) {
    summary.name = normalizeExtractedName(nameMatch[1]);
  }
  // Name extraction (Genetic Matrix EN: "Name: Foo Bar Birth Date")
  if (!summary.name) {
    const gmNameMatch = cleaned.match(/\bName:\s+(.+?)\s+Birth Date\b/i);
    if (gmNameMatch) summary.name = normalizeExtractedName(gmNameMatch[1]);
  }
  // Name extraction (Genetic Matrix ES: "Nombre: Foo Bar Fecha de Nacimiento")
  if (!summary.name) {
    const esNameMatch = cleaned.match(/\bNombre:\s+(.+?)\s+Fecha de Nacimiento\b/i);
    if (esNameMatch) summary.name = normalizeExtractedName(esNameMatch[1]);
  }

  const typeRaw = extractSection(cleaned, "TYPE ", allLabelsUpper)
    ?? extractSection(cleaned, "TYPE: ", allLabelsUpper)
    ?? extractSection(cleaned, "TIPO: ", allLabelsUpper);
  if (typeRaw) {
    summary.humanDesign.type = normalizeField(typeRaw.split(" - ")[0] ?? typeRaw);
  }

  const profileRaw = extractSection(cleaned, "PROFILE ", allLabelsUpper)
    ?? extractSection(cleaned, "PROFILE: ", allLabelsUpper)
    ?? extractSection(cleaned, "PERFIL: ", allLabelsUpper);
  if (profileRaw) {
    const profileMatch = profileRaw.match(/\b\d{1,2}\/\d{1,2}\b/);
    summary.humanDesign.profile = profileMatch ? profileMatch[0] : profileRaw.split(":")[0] ?? profileRaw;
  }

  const notSelf = extractSection(cleaned, "NOT SELF THEME ", allLabelsUpper);
  if (notSelf) summary.humanDesign.notSelfTheme = notSelf;

  const definition = extractSection(cleaned, "DEFINITION ", allLabelsUpper)
    ?? extractSection(cleaned, "DEFINITION: ", allLabelsUpper)
    ?? extractSection(cleaned, "DEFINICIÓN: ", allLabelsUpper);
  if (definition) summary.humanDesign.definition = definition;

  const digestion = extractSection(cleaned, "DIGESTION ", allLabelsUpper);
  if (digestion) summary.humanDesign.digestion = digestion;

  const environment = extractSection(cleaned, "ENVIRONMENT ", allLabelsUpper);
  if (environment) summary.humanDesign.environment = environment;

  const authority = extractSection(cleaned, "AUTHORITY (THE WAY YOU MAKE DECISIONS) ", allLabelsUpper)
    ?? extractSection(cleaned, "INNER AUTHORITY: ", allLabelsUpper)
    ?? extractSection(cleaned, "AUTORIDAD INTERNA: ", allLabelsUpper);
  if (authority) summary.humanDesign.authority = authority;

  const strategy = extractSection(cleaned, "STRATEGY ", allLabelsUpper)
    ?? extractSection(cleaned, "STRATEGY: ", allLabelsUpper);
  if (strategy) summary.humanDesign.strategy = strategy;

  const lifeTheme = extractSection(cleaned, "LIFE THEME (INCARNATION CROSS) ", allLabelsUpper)
    ?? extractSection(cleaned, "INCARNATION CROSS: ", allLabelsUpper)
    ?? extractSection(cleaned, "ENCARNACIÓN CRUZ: ", allLabelsUpper);
  if (lifeTheme) summary.humanDesign.incarnationCross = lifeTheme;

  const strongestSense = extractSection(cleaned, "YOUR STRONGEST SENSE ", allLabelsUpper);
  if (strongestSense) summary.humanDesign.strongestSense = strongestSense;

  return summary;
}

function mapHdValue(
  key: keyof UserProfile["humanDesign"],
  value: string,
): string {
  if (!value) return value;
  if (key === "type") {
    return HD_TYPE_MAP[value] ?? value;
  }
  if (key === "strategy") {
    return HD_STRATEGY_MAP[value] ?? value;
  }
  if (key === "authority") {
    for (const rule of HD_AUTHORITY_MAP) {
      if (rule.test(value)) return rule.value;
    }
    return value;
  }
  if (key === "definition") {
    // Try exact match first, then base (before " - ") for Genetic Matrix "Split - Small (6)" format
    const base = value.split(" - ")[0]?.trim() ?? value;
    return HD_DEFINITION_MAP[value] ?? HD_DEFINITION_MAP[base] ?? value;
  }
  if (key === "notSelfTheme") {
    return HD_NOT_SELF_MAP[value] ?? value;
  }
  if (key === "digestion") {
    return replacePhrases(value, HD_DIGESTION_MAP);
  }
  if (key === "environment") {
    return replacePhrases(value, HD_ENVIRONMENT_MAP);
  }
  if (key === "strongestSense") {
    return replacePhrases(value, HD_STRONGEST_SENSE_MAP);
  }
  if (key === "incarnationCross") {
    const prefixed = replacePhrases(value, HD_CROSS_PREFIX_MAP);
    return translateCrossTitle(prefixed);
  }
  return value;
}

function applyHdSummary(profile: UserProfile, summary: HdSummary): UserProfile {
  if (summary.name && !profile.name) profile.name = summary.name;
  const target = profile.humanDesign;
  const src = summary.humanDesign;
  const assignIf = (key: keyof UserProfile["humanDesign"]) => {
    const value = src[key];
    if (typeof value === "string" && value.trim() !== "") {
      (target as any)[key] = mapHdValue(key, value);
    }
  };
  assignIf("type");
  assignIf("strategy");
  assignIf("authority");
  assignIf("profile");
  assignIf("definition");
  assignIf("incarnationCross");
  assignIf("notSelfTheme");
  assignIf("variable");
  assignIf("digestion");
  assignIf("environment");
  assignIf("strongestSense");
  return profile;
}


// ─── Main extraction ─────────────────────────────────────────────────────────

/**
 * Extrae un UserProfile desde un PDF HD subido por la usuaria.
 *
 * Path único 100% determinístico: pdfjs-dist extrae texto → detectPdfProvider
 * detecta MyHumanDesign o Genetic Matrix → parseGeneticMatrixText o
 * parseMyHumanDesignText devuelve gates → buildProfileFromGates compone el
 * profile → parseHdSummaryFromText completa type/profile/authority/etc.
 *
 * Rechazos:
 * - 0 o >1 assets HD → PDF_ONLY_MESSAGE.
 * - Asset no es PDF → PDF_ONLY_MESSAGE.
 * - PDF sin texto extraíble (imagen/captura) → UNREADABLE_PDF_MESSAGE.
 * - PDF con texto pero proveedor no reconocido → UNSUPPORTED_SOURCE_MESSAGE.
 *
 * No usa LLM bajo ninguna circunstancia (Vision fallback eliminado en astral-1c6).
 */
export async function extractProfileFromAssets(
  assets: AssetData[],
): Promise<UserProfile> {
  if (assets.length === 0) {
    throw new Error("No assets provided");
  }

  const hdAssets = assets.filter((asset) => asset.fileType === "hd");
  if (hdAssets.length !== 1) {
    throw new UserFacingError(PDF_ONLY_MESSAGE);
  }

  const asset = hdAssets[0];
  if (asset.mimeType !== "application/pdf") {
    throw new UserFacingError(PDF_ONLY_MESSAGE);
  }

  const text = await extractPdfText(asset.data);

  // Sin texto extraíble (capa vectorial, imagen embebida, capturas vía
  // "Imprimir como PDF" de Chrome) → rechazo limpio. No aceptamos extracción
  // basada en LLM Vision: la calidad no era verificable >95%.
  if (!text || text.trim().length < 20) {
    throw new UserFacingError(UNREADABLE_PDF_MESSAGE);
  }

  const provider = detectPdfProvider(text);
  if (!provider) {
    // Texto extraído pero ningún proveedor detectado → no es un export oficial.
    // La usuaria debe reexportar desde MyHumanDesign o Genetic Matrix.
    throw new UserFacingError(UNSUPPORTED_SOURCE_MESSAGE);
  }

  try {
    const gates =
      provider === "genetic-matrix"
        ? parseGeneticMatrixText(text)
        : parseMyHumanDesignText(text);
    const profile = buildProfileFromGates(
      gates,
      provider === "genetic-matrix" ? "Genetic Matrix" : "MyHumanDesign",
    );
    const summary = parseHdSummaryFromText(text);
    return deriveImpliedFields(applyHdSummary(profile, summary));
  } catch {
    throw new UserFacingError(UNREADABLE_PDF_MESSAGE);
  }
}
