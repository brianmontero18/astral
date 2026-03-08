import type { UserProfile } from "../agent-service.js";
import { extractPdfText } from "./pdf-text.js";

const GATE_LINE_REGEX = /\b\d{1,2}\.\d\b/g;
const ANCHOR = "www.geneticmatrix.com";
const FILTER_VALUE = "0.1";

const GENETIC_MATRIX_PLANETS = [
  "Sun",
  "Earth",
  "Moon",
  "North Node",
  "South Node",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
] as const;

type ActivatedGate = UserProfile["humanDesign"]["activatedGates"][number];

type GateLine = { gate: number; line: number };

function parseGateLines(text: string): GateLine[] {
  const matches = text.match(GATE_LINE_REGEX) ?? [];
  const filtered = matches.filter((value) => value !== FILTER_VALUE);
  return filtered.map((value) => {
    const [gateRaw, lineRaw] = value.split(".");
    return { gate: Number(gateRaw), line: Number(lineRaw) };
  });
}

function mapGateLinesToPlanets(gateLines: GateLine[]): ActivatedGate[] {
  if (gateLines.length !== 26) {
    throw new Error(`Genetic Matrix PDF: expected 26 gate.line values, got ${gateLines.length}`);
  }

  return gateLines.map((gateLine, index) => ({
    number: gateLine.gate,
    line: gateLine.line,
    planet: GENETIC_MATRIX_PLANETS[index % 13],
    isPersonality: index >= 13,
  }));
}

export async function parseGeneticMatrixPdf(
  buffer: Buffer,
): Promise<ActivatedGate[]> {
  const text = await extractPdfText(buffer);
  const anchorIndex = text.indexOf(ANCHOR);
  if (anchorIndex === -1) {
    throw new Error("Genetic Matrix PDF: anchor not found");
  }

  const scopedText = text.slice(anchorIndex + ANCHOR.length);
  const gateLines = parseGateLines(scopedText);
  return mapGateLinesToPlanets(gateLines);
}
