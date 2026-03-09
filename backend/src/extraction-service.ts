/**
 * Extraction Service — GPT-4o Vision
 *
 * Reads Human Design bodygraph images/PDFs/text files
 * and extracts a structured UserProfile JSON.
 *
 * All files are processed with the HD extraction prompt.
 * Extraction is strict: if a datum isn't visible, it goes
 * as null — never invented.
 */

import type { UserProfile } from "./agent-service.js";
import { HD_CHANNELS } from "./hd-channels.js";
import { parseGeneticMatrixText } from "./hd-pdf/genetic-matrix.js";
import { parseMyHumanDesignText } from "./hd-pdf/myhumandesign.js";
import { extractPdfText } from "./hd-pdf/pdf-text.js";
import { deriveChannelsAndCenters } from "./hd-pdf/validate.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

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

// ─── Prompts by file type ────────────────────────────────────────────────────

const HD_PROMPT = `Estás viendo un BODYGRAPH o reporte de DISEÑO HUMANO. Extraé ÚNICAMENTE los datos que puedas leer con certeza del documento.

El bodygraph típicamente tiene:
- A la IZQUIERDA: columna "DESIGN" (inconsciente/rojo) con puertas por planeta
- A la DERECHA: columna "PERSONALITY" (consciente/negro) con puertas por planeta
- En el CENTRO: el gráfico del bodygraph con centros y canales
- A un costado: CHART PROPERTIES con tipo, autoridad, perfil, definición, cruz, etc.

Devolvé ÚNICAMENTE un JSON con esta estructura, sin texto adicional, sin markdown, sin backticks:

{
  "name": "nombre si aparece, o null",
  "birthData": {
    "date": "fecha de nacimiento si aparece, o null",
    "time": "hora de nacimiento si aparece, o null",
    "location": "lugar de nacimiento si aparece, o null"
  },
  "humanDesign": {
    "type": "tipo o null",
    "strategy": "estrategia o null",
    "authority": "autoridad o null",
    "profile": "perfil (ej: 6/2) o null",
    "definition": "tipo de definición o null",
    "incarnationCross": "cruz de encarnación completa o null",
    "notSelfTheme": "tema del no-self o null",
    "variable": "variable o null",
    "digestion": "tipo de digestión si aparece, o null",
    "environment": "tipo de ambiente si aparece, o null",
    "strongestSense": "sentido más fuerte si aparece, o null",
    "channels": [
      { "id": "num-num", "name": "nombre del canal o null", "circuit": "circuito o null" }
    ],
    "activatedGates": [
      { "number": número, "line": número_o_null, "planet": "planeta o null", "isPersonality": boolean_o_null }
    ],
    "definedCenters": ["centro1"],
    "undefinedCenters": ["centro1"]
  }
}

REGLAS ESTRICTAS:
- Extraé SOLO lo que esté visible. Si un dato NO aparece, poné null. NUNCA inventes ni asumas.
- Tipos válidos: Generador, Generador Manifestante, Proyector, Manifestador, Reflector.
- Los 9 centros HD son: Cabeza, Ajna, Garganta, Centro G, Corazón/Ego, Sacral, Solar Plexus, Bazo, Raíz.
- Para centros: los coloreados/definidos van en definedCenters, los blancos/abiertos en undefinedCenters.
- Para gates de las columnas DESIGN y PERSONALITY: leé AMBAS columnas. Los planetas en orden estándar son: Sol, Tierra, Nodo Norte, Nodo Sur, Luna, Mercurio, Venus, Marte, Júpiter, Saturno, Urano, Neptuno, Plutón. Cada uno tiene un número de puerta y línea (ej: "34.2" = puerta 34, línea 2).
- isPersonality=true para las gates de la columna PERSONALITY (derecha/negro), false para DESIGN (izquierda/rojo).
- Para canales: el id es "gateA-gateB" con el número menor primero (ej: "20-34"). Un canal existe cuando dos centros están conectados por una línea coloreada en el bodygraph.
- Si ves "Incarnation Cross", "Not Self Theme", "Strategy", "Digestion", "Environment", "Strongest Sense" en las propiedades, extraelos.
- Para la cruz de encarnación: incluí el nombre completo y los números de puertas si aparecen (ej: "Left Angle Cross of Industry (30/29 | 34/20)").`;

const MERGE_PROMPT = `Sos un experto en Diseño Humano. Te doy extracciones parciales de distintos archivos del mismo usuario.
Combiná todo en un único JSON con esta estructura exacta. NO inventes datos que no estén en las extracciones.

Devolvé ÚNICAMENTE el JSON, sin texto adicional, sin markdown, sin backticks:

{
  "name": "nombre",
  "birthData": {
    "date": "fecha",
    "time": "hora",
    "location": "lugar"
  },
  "humanDesign": {
    "type": "tipo",
    "strategy": "estrategia",
    "authority": "autoridad",
    "profile": "perfil",
    "definition": "definición",
    "incarnationCross": "cruz de encarnación",
    "notSelfTheme": "tema del no-self",
    "variable": "variable",
    "digestion": "digestión",
    "environment": "ambiente",
    "strongestSense": "sentido más fuerte",
    "channels": [
      { "id": "num-num", "name": "nombre", "circuit": "circuito" }
    ],
    "activatedGates": [
      { "number": número, "line": número, "planet": "planeta", "isPersonality": boolean }
    ],
    "definedCenters": [],
    "undefinedCenters": []
  }
}

REGLAS:
- Usá los datos de las extracciones. Si un campo es null en todas, dejalo como string vacío "" o array vacío [].
- Si hay un nombre en alguna extracción, usalo. Si hay nombres distintos, usá el primero.
- Si hay birthData en alguna extracción, incluilo. Si no hay en ninguna, omití el campo.
- Convertí nulls a valores por defecto: strings → "", números → 0, booleans → false, arrays → [].
- No agregues datos que no estén en ninguna extracción.`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetData {
  mimeType: string;
  data: Buffer;
  filename: string;
  fileType: string; // "natal" | "hd"
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFileParts(asset: AssetData): any[] {
  const parts: any[] = [];

  if (asset.mimeType === "text/plain") {
    parts.push({
      type: "text",
      text: `--- Contenido de ${asset.filename} ---\n${asset.data.toString("utf-8")}`,
    });
  } else if (asset.mimeType === "application/pdf") {
    const base64 = asset.data.toString("base64");
    parts.push({
      type: "file",
      file: {
        filename: asset.filename,
        file_data: `data:application/pdf;base64,${base64}`,
      },
    });
  } else if (asset.mimeType.startsWith("image/")) {
    const base64 = asset.data.toString("base64");
    parts.push({
      type: "image_url",
      image_url: {
        url: `data:${asset.mimeType};base64,${base64}`,
        detail: "high",
      },
    });
  }

  return parts;
}

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
  { test: (v) => /emotional|solar plexus/i.test(v), value: "Emocional (Plexo Solar)" },
  { test: (v) => /\bsacral\b/i.test(v), value: "Sacral" },
  { test: (v) => /\bsplenic\b/i.test(v), value: "Esplénica" },
  { test: (v) => /\bego\b|\bheart\b/i.test(v), value: "Ego/Corazón" },
  { test: (v) => /self[-\s]?projected/i.test(v), value: "Auto-proyectada" },
  { test: (v) => /mental|environment/i.test(v), value: "Mental/Ambiente" },
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
};

const HD_NOT_SELF_MAP: Record<string, string> = {
  "Frustration": "Frustración",
  "Anger": "Ira",
  "Bitterness": "Amargura",
  "Disappointment": "Decepción",
};

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

function parseHdSummaryFromText(text: string): HdSummary {
  const cleaned = normalizeField(text);

  // Labels from both providers (MyHumanDesign uses spaced labels, Genetic Matrix uses "Key: value")
  const labels = [
    "TYPE ",
    "TYPE: ",
    "PROFILE ",
    "PROFILE: ",
    "NOT SELF THEME ",
    "DEFINITION ",
    "DEFINITION: ",
    "DIGESTION ",
    "ENVIRONMENT ",
    "AUTHORITY (THE WAY YOU MAKE DECISIONS) ",
    "INNER AUTHORITY: ",
    "STRATEGY ",
    "STRATEGY: ",
    "LIFE THEME (INCARNATION CROSS) ",
    "INCARNATION CROSS: ",
    "YOUR STRONGEST SENSE ",
    "YOUR MOST IMPORTANT GIFT ",
    "YOUR OTHER GIFTS ",
    "SIGN ",
    "CHANNELS: ",
  ];
  const allLabelsUpper = labels.map((l) => l.toUpperCase());

  const summary: HdSummary = { humanDesign: {} };

  // Name extraction (MyHumanDesign format)
  const nameMatch = cleaned.match(/\bName\s+([^\s].*?)\s+Design\b/i);
  if (nameMatch && !/not available/i.test(nameMatch[1])) {
    summary.name = normalizeField(nameMatch[1]);
  }
  // Name extraction (Genetic Matrix format: "Name: Foo Bar Birth Date")
  if (!summary.name) {
    const gmNameMatch = cleaned.match(/\bName:\s+(.+?)\s+Birth Date\b/i);
    if (gmNameMatch) summary.name = normalizeField(gmNameMatch[1]);
  }

  const typeRaw = extractSection(cleaned, "TYPE ", allLabelsUpper)
    ?? extractSection(cleaned, "TYPE: ", allLabelsUpper);
  if (typeRaw) {
    summary.humanDesign.type = normalizeField(typeRaw.split(" - ")[0] ?? typeRaw);
  }

  const profileRaw = extractSection(cleaned, "PROFILE ", allLabelsUpper)
    ?? extractSection(cleaned, "PROFILE: ", allLabelsUpper);
  if (profileRaw) {
    const profileMatch = profileRaw.match(/\b\d{1,2}\/\d{1,2}\b/);
    summary.humanDesign.profile = profileMatch ? profileMatch[0] : profileRaw.split(":")[0] ?? profileRaw;
  }

  const notSelf = extractSection(cleaned, "NOT SELF THEME ", allLabelsUpper);
  if (notSelf) summary.humanDesign.notSelfTheme = notSelf;

  const definition = extractSection(cleaned, "DEFINITION ", allLabelsUpper)
    ?? extractSection(cleaned, "DEFINITION: ", allLabelsUpper);
  if (definition) summary.humanDesign.definition = definition;

  const digestion = extractSection(cleaned, "DIGESTION ", allLabelsUpper);
  if (digestion) summary.humanDesign.digestion = digestion;

  const environment = extractSection(cleaned, "ENVIRONMENT ", allLabelsUpper);
  if (environment) summary.humanDesign.environment = environment;

  const authority = extractSection(cleaned, "AUTHORITY (THE WAY YOU MAKE DECISIONS) ", allLabelsUpper)
    ?? extractSection(cleaned, "INNER AUTHORITY: ", allLabelsUpper);
  if (authority) summary.humanDesign.authority = authority;

  const strategy = extractSection(cleaned, "STRATEGY ", allLabelsUpper)
    ?? extractSection(cleaned, "STRATEGY: ", allLabelsUpper);
  if (strategy) summary.humanDesign.strategy = strategy;

  const lifeTheme = extractSection(cleaned, "LIFE THEME (INCARNATION CROSS) ", allLabelsUpper)
    ?? extractSection(cleaned, "INCARNATION CROSS: ", allLabelsUpper);
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

async function callOpenAI(
  systemPrompt: string,
  contentParts: any[],
  openaiKey: string,
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contentParts },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? "";
}

function parseJSON(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse JSON. Raw: ${raw.slice(0, 500)}`);
  }
}

// ─── Main extraction ─────────────────────────────────────────────────────────

export async function extractProfileFromAssets(
  assets: AssetData[],
  openaiKey: string,
): Promise<UserProfile> {
  if (assets.length === 0) {
    throw new Error("No assets provided");
  }

  const hdAssets = assets.filter((asset) => asset.fileType === "hd");
  if (hdAssets.length > 0) {
    if (hdAssets.length > 1) {
      throw new UserFacingError(PDF_ONLY_MESSAGE);
    }

    const asset = hdAssets[0];
    if (asset.mimeType !== "application/pdf") {
      throw new UserFacingError(PDF_ONLY_MESSAGE);
    }

    const text = await extractPdfText(asset.data);
    if (!text || text.trim().length < 20) {
      throw new UserFacingError(UNREADABLE_PDF_MESSAGE);
    }

    const provider = detectPdfProvider(text);
    if (!provider) {
      throw new UserFacingError(UNSUPPORTED_SOURCE_MESSAGE);
    }

    try {
      const gates = provider === "genetic-matrix"
        ? parseGeneticMatrixText(text)
        : parseMyHumanDesignText(text);
      const profile = buildProfileFromGates(
        gates,
        provider === "genetic-matrix" ? "Genetic Matrix" : "MyHumanDesign",
      );
      const summary = parseHdSummaryFromText(text);
      return applyHdSummary(profile, summary);
    } catch (err) {
      throw new UserFacingError(UNREADABLE_PDF_MESSAGE);
    }
  }

  const extractions: string[] = [];

  // All files are processed with HD_PROMPT regardless of fileType
  const parts: any[] = [];
  for (const asset of assets) {
    parts.push(...buildFileParts(asset));
  }
  parts.push({ type: "text", text: "Extraé los datos de Diseño Humano de este documento." });

  const raw = await callOpenAI(HD_PROMPT, parts, openaiKey);
  const parsed = parseJSON(raw);
  extractions.push(JSON.stringify(parsed, null, 2));

  // Merge to normalize nulls → defaults
  const mergeInput = extractions
    .map((e, i) => `--- Extracción ${i + 1} ---\n${e}`)
    .join("\n\n");

  const mergeRaw = await callOpenAI(MERGE_PROMPT, [
    { type: "text", text: mergeInput },
  ], openaiKey);

  return parseJSON(mergeRaw) as UserProfile;
}
