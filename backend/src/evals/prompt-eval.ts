/**
 * Prompt Eval Functions
 *
 * Pure functions that evaluate LLM output against structural and grounding rules.
 * No API calls — these receive a string and return pass/fail with reason.
 */

import type { Intake } from "../report/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvalResult {
  pass: boolean;
  reason: string;
}

// ─── Legacy Weekly Report Structure Evals ────────────────────────────────────

const LEGACY_WEEKLY_REPORT_SECTIONS = [
  "🔭 PANORAMA GENERAL",
  "⚡ ENERGÍA & CUERPO",
  "💼 TRABAJO & CREATIVIDAD",
  "❤️ VÍNCULOS & AMOR",
  "📣 COMUNICACIÓN & MARCA",
  "🧭 ESTRATEGIA DE LA SEMANA",
  "⚠️ PUNTOS DE ATENCIÓN",
] as const;

/** Legacy chat weekly report contains exactly the old 7 required sections in order. */
export function evalLegacyWeeklyReportSections(output: string): EvalResult {
  const missing: string[] = [];
  let lastIndex = -1;
  let outOfOrder = false;

  for (const section of LEGACY_WEEKLY_REPORT_SECTIONS) {
    const idx = output.indexOf(section);
    if (idx === -1) {
      missing.push(section);
    } else if (idx < lastIndex) {
      outOfOrder = true;
    }
    lastIndex = idx;
  }

  if (missing.length > 0) {
    return { pass: false, reason: `Secciones faltantes: ${missing.join(", ")}` };
  }
  if (outOfOrder) {
    return { pass: false, reason: "Secciones fuera de orden" };
  }
  return { pass: true, reason: "7 secciones presentes y en orden" };
}

/** No text before the first emoji in a legacy weekly report. */
export function evalLegacyWeeklyReportNoPreText(output: string): EvalResult {
  const trimmed = output.trimStart();
  if (trimmed.startsWith("🔭")) {
    return { pass: true, reason: "Empieza directo con 🔭" };
  }
  return { pass: false, reason: `Texto antes del primer emoji: "${trimmed.slice(0, 50)}..."` };
}

/** Each legacy weekly report section has at least 3 sentences (rough heuristic). */
export function evalLegacyWeeklyReportMinSentencesPerSection(
  output: string,
  minSentences = 3,
): EvalResult {
  const failures: string[] = [];

  for (let i = 0; i < LEGACY_WEEKLY_REPORT_SECTIONS.length; i++) {
    const start = output.indexOf(LEGACY_WEEKLY_REPORT_SECTIONS[i]);
    if (start === -1) continue;

    const contentStart = start + LEGACY_WEEKLY_REPORT_SECTIONS[i].length;
    const nextSection = i + 1 < LEGACY_WEEKLY_REPORT_SECTIONS.length
      ? output.indexOf(LEGACY_WEEKLY_REPORT_SECTIONS[i + 1])
      : output.length;
    const sectionText = output.slice(contentStart, nextSection === -1 ? output.length : nextSection).trim();

    const sentences = sectionText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < minSentences) {
      failures.push(`${LEGACY_WEEKLY_REPORT_SECTIONS[i]} tiene ~${sentences.length} oraciones (mín ${minSentences})`);
    }
  }

  if (failures.length > 0) {
    return { pass: false, reason: failures.join("; ") };
  }
  return { pass: true, reason: `Todas las secciones tienen ≥${minSentences} oraciones` };
}

// ─── Format Evals ────────────────────────────────────────────────────────────

/** Legacy weekly reports disallowed markdown symbols (**, ##, `, etc.). */
export function evalLegacyWeeklyReportNoMarkdown(output: string): EvalResult {
  const patterns = [
    { regex: /\*\*[^*]+\*\*/g, name: "bold (**)" },
    { regex: /^#{1,6}\s/gm, name: "headers (#)" },
    { regex: /`[^`]+`/g, name: "inline code (`)" },
    { regex: /^[-*]\s/gm, name: "list bullets (- or *)" },
  ];

  const found: string[] = [];
  for (const { regex, name } of patterns) {
    if (regex.test(output)) {
      found.push(name);
    }
  }

  if (found.length > 0) {
    return { pass: false, reason: `Markdown detectado: ${found.join(", ")}` };
  }
  return { pass: true, reason: "Sin markdown" };
}

/** Output is in Spanish (heuristic: common Spanish words present) */
export function evalSpanish(output: string): EvalResult {
  const spanishMarkers = ["esta semana", "energía", "puerta", "canal", "centro", "tu ", "tus ", "está", "podés", "momento"];
  const englishMarkers = ["this week", "your energy", "you should", "the gate", "remember that"];

  const spanishHits = spanishMarkers.filter(w => output.toLowerCase().includes(w)).length;
  const englishHits = englishMarkers.filter(w => output.toLowerCase().includes(w)).length;

  if (englishHits > 2) {
    return { pass: false, reason: `Detectado inglés (${englishHits} marcadores): posible code-switching` };
  }
  if (spanishHits < 3) {
    return { pass: false, reason: `Pocos marcadores de español (${spanishHits}/10)` };
  }
  return { pass: true, reason: `Español confirmado (${spanishHits} marcadores, ${englishHits} inglés)` };
}

// ─── Grounding Evals ─────────────────────────────────────────────────────────

/** Output references specific gate numbers from the provided transits/profile */
export function evalMentionsGates(output: string, expectedGates: number[]): EvalResult {
  const mentioned = expectedGates.filter(g => {
    // Match "Puerta X", "puerta X", "Gate X", or just the number in HD context
    const pattern = new RegExp(`(?:puerta|gate)\\s*${g}\\b`, "i");
    return pattern.test(output);
  });

  if (mentioned.length === 0) {
    return { pass: false, reason: "No menciona ninguna puerta específica del contexto" };
  }
  return { pass: true, reason: `Menciona ${mentioned.length}/${expectedGates.length} puertas: ${mentioned.join(", ")}` };
}

/** Output does NOT reference gate numbers that weren't in the context (hallucination check) */
export function evalNoHallucinatedGates(output: string, validGates: number[]): EvalResult {
  const gatePattern = /(?:puerta|gate)\s*(\d{1,2})\b/gi;
  const hallucinated: number[] = [];
  let match;

  while ((match = gatePattern.exec(output)) !== null) {
    const gate = parseInt(match[1], 10);
    if (gate >= 1 && gate <= 64 && !validGates.includes(gate)) {
      hallucinated.push(gate);
    }
  }

  // Dedupe
  const unique = [...new Set(hallucinated)];
  if (unique.length > 0) {
    return { pass: false, reason: `Puertas no presentes en el contexto: ${unique.join(", ")}` };
  }
  return { pass: true, reason: "Todas las puertas mencionadas están en el contexto" };
}

export interface ChannelExpectation {
  id: string;
  gates: readonly [number, number];
  name: string;
}

function normalizeForEval(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[*_`]/g, "")
    .toLowerCase();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function channelIdRegexSource(id: string): string {
  const [a, b] = id.split("-").map(escapeRegex);
  return `${a}\\s*[-–]\\s*${b}`;
}

function channelIdRegex(id: string): RegExp {
  return new RegExp(`\\b${channelIdRegexSource(id)}\\b`, "i");
}

function mentionsGate(text: string, gate: number): boolean {
  return new RegExp(`\\b(?:puertas?\\s*)?${gate}\\b`, "i").test(text);
}

export function evalMentionsCanonicalChannel(
  output: string,
  expected: ChannelExpectation,
): EvalResult {
  const clean = normalizeForEval(output);
  const expectedName = normalizeForEval(expected.name);
  const missing: string[] = [];

  if (!clean.includes(expectedName)) {
    missing.push(expected.name);
  }
  for (const gate of expected.gates) {
    if (!mentionsGate(clean, gate)) {
      missing.push(`Puerta ${gate}`);
    }
  }

  if (missing.length > 0) {
    return {
      pass: false,
      reason: `Canal esperado incompleto (${expected.id}): falta ${missing.join(", ")}`,
    };
  }

  return {
    pass: true,
    reason: `Menciona ${expected.name} (${expected.id}) con puertas ${expected.gates.join(" y ")}`,
  };
}

export function evalRejectsInvalidChannelPair(
  output: string,
  invalidChannelId: string,
): EvalResult {
  const clean = normalizeForEval(output);
  const idPattern = channelIdRegex(invalidChannelId);
  const [gateA, gateB] = invalidChannelId.split("-").map(Number);

  if (!idPattern.test(clean)) {
    return {
      pass: false,
      reason: `No menciona el par inválido ${invalidChannelId}; la respuesta debe rechazarlo explícitamente`,
    };
  }

  const rejectionPatterns = [
    /\bno existe\b/i,
    /\bno esta(?: definido| en| dentro| incluido| registrado)?\b/i,
    /\bno se encuentra\b/i,
    /\bno es un canal\b/i,
    /\bno forman(?: un)? canal\b/i,
    /\bno corresponde a un canal\b/i,
    /\bno forma parte\b/i,
    /\bno hay canal\b/i,
  ];
  const rejectsPair = rejectionPatterns.some((pattern) => pattern.test(clean));
  if (!rejectsPair) {
    return {
      pass: false,
      reason: `${invalidChannelId} no fue rechazado como canal inexistente`,
    };
  }

  const invalidIdSource = channelIdRegexSource(invalidChannelId);
  const affirmativePatterns = [
    new RegExp(
      `(?:^|[.!?]\\s+)canal\\s+${invalidIdSource}\\s+(?:existe|conecta|une|forma|es\\s+(?:un|el))`,
      "i",
    ),
    new RegExp(
      `puertas?\\s*${gateA}\\b[\\s\\S]{0,120}\\b(?:conectan|forman|crean|activan)\\b[\\s\\S]{0,120}\\bpuertas?\\s*${gateB}\\b`,
      "i",
    ),
    new RegExp(
      `puertas?\\s*${gateB}\\b[\\s\\S]{0,120}\\b(?:conectan|forman|crean|activan)\\b[\\s\\S]{0,120}\\bpuertas?\\s*${gateA}\\b`,
      "i",
    ),
  ];
  const hasExplicitPairNegation = /\bno forman(?: un)? canal\b/i.test(clean);
  const contradictsRejection =
    !hasExplicitPairNegation &&
    affirmativePatterns.some((pattern) => pattern.test(clean));
  if (contradictsRejection) {
    return {
      pass: false,
      reason: `${invalidChannelId} aparece afirmado como canal existente`,
    };
  }

  return {
    pass: true,
    reason: `${invalidChannelId} rechazado explícitamente como canal inexistente`,
  };
}

/** Output references at least one center by name */
export function evalMentionsCenters(output: string, definedCenters: string[], undefinedCenters: string[]): EvalResult {
  const centerNames: Record<string, string[]> = {
    Head: ["cabeza", "head"],
    Ajna: ["ajna", "mente"],
    Throat: ["garganta", "throat"],
    G: ["centro g", "centro de identidad", "centro del self"],
    Heart: ["corazón", "heart", "ego"],
    SolarPlexus: ["plexo solar", "solar plexus", "emocional"],
    Sacral: ["sacral", "sacro"],
    Spleen: ["bazo", "spleen"],
    Root: ["raíz", "root"],
  };

  const allCenters = [...definedCenters, ...undefinedCenters];
  const mentioned = allCenters.filter(c => {
    const names = centerNames[c] ?? [c.toLowerCase()];
    return names.some(n => output.toLowerCase().includes(n));
  });

  if (mentioned.length === 0) {
    return { pass: false, reason: "No menciona ningún centro del contexto" };
  }
  return { pass: true, reason: `Menciona ${mentioned.length} centros: ${mentioned.join(", ")}` };
}

// ─── Advisor Quality Evals (chat) ──────────────────────────────────────────────
// Heurísticas binarias derivadas de docs/ai-refactor/06-advisor-quality-audit.md.
// [H] heurística honesta · [A] proxy que el LLM-as-judge (token-gated) refinará.
//
// Guardrail astral-e2h.18: el grounding HD verificado (puertas/canales) se valida en
// evalMentionsGates / evalNoHallucinatedGates / evalMentionsCanonicalChannel sobre data
// del profile, NUNCA acá. evalHdCitationChangesAdvice solo mide causalidad lingüística,
// no la correctitud del canal.

const SPANISH_STOPWORDS = new Set([
  "para", "con", "los", "las", "del", "una", "uno", "unos", "unas", "que", "como", "por",
  "mas", "esta", "este", "estos", "estas", "esto", "mis", "tus", "sus", "de", "la", "el",
  "en", "un", "y", "a", "o", "se", "lo", "le", "les", "es", "al", "su", "ya", "si", "no",
  "me", "te", "nos", "pero", "porque", "cuando", "donde", "muy", "sin", "sobre", "entre",
  "hasta", "desde", "cada", "todo", "toda", "todos", "todas", "hay", "mi", "tu", "ser",
  "han", "hace", "esa", "ese", "eso", "esos", "esas",
]);

function extractSignificantWords(normalized: string, minLen: number): string[] {
  return normalized
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= minLen && !SPANISH_STOPWORDS.has(w));
}

function extractMoneyTokens(text: string): string[] {
  const money = text.match(/\b\d{1,3}\s?k\b/gi) ?? [];
  const bigNums = text.match(/\b\d{3,}\b/g) ?? [];
  return [...money.map((m) => m.replace(/\s+/g, "").toLowerCase()), ...bigNums];
}

function extractProperNouns(text: string): string[] {
  const matches = text.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b/g) ?? [];
  return matches
    .map((m) => normalizeForEval(m))
    .filter((w) => w.length >= 4 && !SPANISH_STOPWORDS.has(w));
}

function buildBusinessTokenSet(intake?: Intake, memory?: string): Set<string> {
  const tokens = new Set<string>();
  const addAll = (arr: string[]): void => {
    for (const t of arr) tokens.add(t);
  };

  if (intake) {
    const freeText = [intake.actividad, intake.desafio_actual, intake.objetivo_12m, intake.voz_marca]
      .filter((v): v is string => Boolean(v))
      .join(" ");
    addAll(extractSignificantWords(normalizeForEval(freeText), 4));
    addAll(extractProperNouns(freeText));
    addAll(extractMoneyTokens(freeText));
    if (intake.tipo_de_negocio) {
      addAll(intake.tipo_de_negocio.split("_").filter((t) => t.length >= 4));
    }
  }
  if (memory) {
    addAll(extractProperNouns(memory));
    addAll(extractMoneyTokens(memory));
    addAll(extractSignificantWords(normalizeForEval(memory), 5));
  }
  return tokens;
}

/**
 * [A] El output usa contexto concreto del negocio (intake/memoria) cuando existe.
 * Proxy: detecta *mención* de un token concreto, no si la recomendación cambió por él.
 */
export function evalUsesBusinessContext(output: string, intake?: Intake, memory?: string): EvalResult {
  const tokenSet = buildBusinessTokenSet(intake, memory);
  if (tokenSet.size === 0) {
    return { pass: true, reason: "Sin intake ni memoria: nada de contexto que exigir" };
  }
  const normalizedOutput = normalizeForEval(output);
  const matched: string[] = [];
  for (const token of tokenSet) {
    if (new RegExp(`\\b${escapeRegex(token)}\\b`).test(normalizedOutput)) {
      matched.push(token);
    }
  }
  if (matched.length === 0) {
    return { pass: false, reason: "No referencia ningún dato concreto del negocio (intake/memoria)" };
  }
  return { pass: true, reason: `Usa contexto del negocio: ${matched.slice(0, 5).join(", ")}` };
}

const HD_CAUSAL_CONNECTORS = [
  "por eso", "por lo que", "por lo tanto", "por ende", "por esto", "entonces", "asi que",
  "te conviene", "esto significa", "significa que", "implica que", "lo que implica",
  "lo que te permite", "esto te permite", "esto te pide", "te pide que", "usa esto",
  "aprovecha esto para", "razon por la cual", "de ahi que", "deberias",
];

function findHdCitationIndices(normalized: string): number[] {
  const indices: number[] = [];
  const patterns = [
    /(?:puerta|gate)s?\s*\d{1,2}/g,
    /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/g,
    /\b(?:garganta|sacral|sacro|plexo|bazo|ajna|raiz|corazon|cabeza)\b/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(normalized)) !== null) {
      indices.push(match.index);
    }
  }
  return indices;
}

/**
 * [A] Si el output cita HD, la cita debe estar ligada a un conector que cambie el consejo.
 * Sin cita HD → pass (no forzar HD). NO valida correctitud del canal (guardrail e2h.18).
 */
export function evalHdCitationChangesAdvice(output: string): EvalResult {
  const normalized = normalizeForEval(output);
  const citations = findHdCitationIndices(normalized);
  if (citations.length === 0) {
    return { pass: true, reason: "No cita HD: nada que justificar" };
  }
  const anchored = citations.some((idx) => {
    const window = normalized.slice(Math.max(0, idx - 40), idx + 160);
    return HD_CAUSAL_CONNECTORS.some((c) => window.includes(c));
  });
  if (!anchored) {
    return { pass: false, reason: "Cita HD sin conector causal: decorativa, no cambia el consejo" };
  }
  return { pass: true, reason: "La cita HD está ligada a un conector que cambia el consejo" };
}

const GENERIC_ADVISOR_PHRASES = [
  "esta semana es propicia", "esta semana es favorable", "semana propicia", "semana favorable",
  "es propicia para", "es favorable para", "momento propicio", "gran oportunidad",
  "energia propicia", "energia disponible", "comunicacion autentica", "comunicacion efectiva",
  "contar historias", "usar testimonios", "contenido visual", "conectar con tu esencia",
  "conecta con tu esencia", "fluir con", "aprovechar la energia", "aprovecha la energia",
  "venta significativa", "crecimiento significativo", "de manera autentica",
];

/** [H] No usar frases comodín de coach genérico (anti-patrones doc 06 §183-189). */
export function evalNoGenericAdvisorLanguage(output: string): EvalResult {
  const normalized = normalizeForEval(output);
  const opener = normalized.trimStart().slice(0, 90);
  const openerMatch = GENERIC_ADVISOR_PHRASES.find((p) => opener.includes(p));
  if (openerMatch) {
    return { pass: false, reason: `Opener comodín: "${openerMatch}"` };
  }
  const matched = GENERIC_ADVISOR_PHRASES.filter((p) => normalized.includes(p));
  if (matched.length >= 2) {
    return { pass: false, reason: `Lenguaje genérico (${matched.length}): ${matched.slice(0, 4).join(", ")}` };
  }
  return {
    pass: true,
    reason: matched.length === 1 ? `1 frase genérica tolerada: ${matched[0]}` : "Sin lenguaje de advisor genérico",
  };
}

const EMOJI_HEADING_RE =
  /^\s*[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

function opensWithEmojiHeading(output: string): boolean {
  const firstLine = output.trimStart().split(/\r?\n/, 1)[0] ?? "";
  return EMOJI_HEADING_RE.test(firstLine);
}

function countEmojiHeadingLines(output: string): number {
  return output.split(/\r?\n/).filter((l) => EMOJI_HEADING_RE.test(l)).length;
}

function countLegacyReportSections(output: string): number {
  return LEGACY_WEEKLY_REPORT_SECTIONS.filter((s) => output.includes(s)).length;
}

function usesReportScaffold(output: string): boolean {
  return countLegacyReportSections(output) >= 2 || countEmojiHeadingLines(output) >= 3;
}

const EMOTIONAL_INPUT_MARKERS = [
  "fallecio", "falleci", "murio", "muerte", "duelo", "perdi a", "perdida", "luto",
  "choque", "accidente", "crisis", "me conmovio", "conmovida", "conmovido", "tengo miedo",
  "no puedo mas", "angustia", "angustiada", "ansiedad", "deprimi", "llorar", "llore",
  "llorando", "asustada", "asustado", "panico", "me siento mal", "estoy mal", "mucho dolor",
  "destrozada", "destrozado", "me separe", "divorcio", "me despidieron", "quiebra", "colapso",
];

const CONTAINMENT_MARKERS = [
  "lamento", "lo siento", "cuanto lo siento", "siento mucho", "entiendo", "que dificil",
  "que duro", "imagino", "te acompano", "acompano", "es comprensible", "tiene sentido",
  "hoy no es un dia", "hoy no es dia", "tomate tu tiempo", "esta bien sentir", "esta bien no",
  "no estas sola", "no estas solo", "date permiso", "respira",
];

/**
 * [A] En un momento emocional, abrir con contención sobria, no con scaffold de informe.
 * Input no emocional → pass. Proxy estructural del tono.
 */
export function evalEmotionalAltitude(userInput: string, output: string): EvalResult {
  const normInput = normalizeForEval(userInput);
  const isEmotional = EMOTIONAL_INPUT_MARKERS.some((m) => normInput.includes(m));
  if (!isEmotional) {
    return { pass: true, reason: "Input no emocional: estructura permitida" };
  }
  if (usesReportScaffold(output) || opensWithEmojiHeading(output)) {
    return { pass: false, reason: "Momento emocional respondido con scaffold de informe" };
  }
  const head = normalizeForEval(output).trimStart().slice(0, 260);
  if (!CONTAINMENT_MARKERS.some((m) => head.includes(m))) {
    return { pass: false, reason: "Momento emocional sin contención sobria al inicio" };
  }
  return { pass: true, reason: "Abre con contención y sin scaffold de informe" };
}

const PLAN_INTENT_MARKERS = [
  "quiero", "voy a", "pienso", "estoy por", "planeo", "tengo que", "deberia", "me gustaria",
  "relanzar", "relanzo", "relanza", "lanzar", "lanzo", "lanza", "vender", "vendo",
  "automatizar", "escalar", "conviene", "estoy pensando",
];

const TENSION_MARKERS = [
  "no relances", "no lances", "no todavia", "todavia no", "no es el momento", "no es momento",
  "esto no esta listo", "no esta listo", "el riesgo es", "riesgo de", "antes de", "cuidado con",
  "ten cuidado", "estas segura", "estas seguro", "no recomiendo", "no conviene", "evita ",
  "no hagas", "no apresures", "no te apures", "ojo con", "no deberias", "frena", "pausa",
  "primero necesitas", "primero resolve", "te freno", "disiento", "no comparto",
];

/**
 * [A] Frente a un plan propuesto, poner tensión/límite en vez de validar todo.
 * El usuario no propone plan → pass. Proxy de presencia de límites.
 */
export function evalAntiSycophancy(userInput: string, output: string): EvalResult {
  const normInput = normalizeForEval(userInput);
  const proposesPlan = PLAN_INTENT_MARKERS.some((m) => normInput.includes(m));
  if (!proposesPlan) {
    return { pass: true, reason: "El usuario no propone un plan: nada que tensionar" };
  }
  const normOutput = normalizeForEval(output);
  if (!TENSION_MARKERS.some((m) => normOutput.includes(m))) {
    return { pass: false, reason: "Plan propuesto sin tensión ni límite: posible sobreamabilidad" };
  }
  return { pass: true, reason: "Pone tensión o límite frente al plan propuesto" };
}

const REPORT_REQUEST_MARKERS = [
  "informe", "reporte", "lectura de la semana", "lectura semanal", "lectura de mi",
  "analiza", "analizame", "analisis", "resumen de la semana", "hace un reporte",
  "dame un informe", "quiero un informe", "mi lectura",
];

/** [H/A] No imponer el scaffold fijo del POC si la pregunta no pidió informe/lectura. */
export function evalNoDefaultReportScaffold(userInput: string, output: string): EvalResult {
  const normInput = normalizeForEval(userInput);
  if (REPORT_REQUEST_MARKERS.some((m) => normInput.includes(m))) {
    return { pass: true, reason: "El usuario pidió informe/lectura: scaffold permitido" };
  }
  if (usesReportScaffold(output)) {
    return { pass: false, reason: "Usa scaffold fijo de informe sin que la pregunta lo pida" };
  }
  return { pass: true, reason: "Forma conversacional acorde a la pregunta" };
}

// ─── Composite Runner ────────────────────────────────────────────────────────

export interface EvalSuite {
  name: string;
  fn: () => EvalResult;
}

export function runEvals(evals: EvalSuite[]): { passed: number; failed: number; results: Array<{ name: string } & EvalResult> } {
  const results = evals.map(e => ({ name: e.name, ...e.fn() }));
  return {
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length,
    results,
  };
}
