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

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

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
