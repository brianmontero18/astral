/**
 * Prompt Eval Functions
 *
 * Pure functions that evaluate LLM output against structural and grounding rules.
 * No API calls — these receive a string and return pass/fail with reason.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvalResult {
  pass: boolean;
  reason: string;
}

// ─── Report Structure Evals ──────────────────────────────────────────────────

const REPORT_SECTIONS = [
  "🔭 PANORAMA GENERAL",
  "⚡ ENERGÍA & CUERPO",
  "💼 TRABAJO & CREATIVIDAD",
  "❤️ VÍNCULOS & AMOR",
  "📣 COMUNICACIÓN & MARCA",
  "🧭 ESTRATEGIA DE LA SEMANA",
  "⚠️ PUNTOS DE ATENCIÓN",
] as const;

/** Report contains exactly the 7 required sections in order */
export function evalReportSections(output: string): EvalResult {
  const missing: string[] = [];
  let lastIndex = -1;
  let outOfOrder = false;

  for (const section of REPORT_SECTIONS) {
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

/** No text before the first emoji in a report */
export function evalNoPreText(output: string): EvalResult {
  const trimmed = output.trimStart();
  const firstEmoji = trimmed.charAt(0) + trimmed.charAt(1);
  // The first section emoji is 🔭 — check if output starts with it
  if (trimmed.startsWith("🔭")) {
    return { pass: true, reason: "Empieza directo con 🔭" };
  }
  return { pass: false, reason: `Texto antes del primer emoji: "${trimmed.slice(0, 50)}..."` };
}

/** Each section has at least 3 sentences (rough heuristic: 3+ periods) */
export function evalMinSentencesPerSection(output: string, minSentences = 3): EvalResult {
  const failures: string[] = [];

  for (let i = 0; i < REPORT_SECTIONS.length; i++) {
    const start = output.indexOf(REPORT_SECTIONS[i]);
    if (start === -1) continue;

    const contentStart = start + REPORT_SECTIONS[i].length;
    const nextSection = i + 1 < REPORT_SECTIONS.length
      ? output.indexOf(REPORT_SECTIONS[i + 1])
      : output.length;
    const sectionText = output.slice(contentStart, nextSection === -1 ? output.length : nextSection).trim();

    // Count sentence-ending punctuation
    const sentences = sectionText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < minSentences) {
      failures.push(`${REPORT_SECTIONS[i]} tiene ~${sentences.length} oraciones (mín ${minSentences})`);
    }
  }

  if (failures.length > 0) {
    return { pass: false, reason: failures.join("; ") };
  }
  return { pass: true, reason: `Todas las secciones tienen ≥${minSentences} oraciones` };
}

// ─── Format Evals ────────────────────────────────────────────────────────────

/** No markdown symbols (**, ##, `, etc.) */
export function evalNoMarkdown(output: string): EvalResult {
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
