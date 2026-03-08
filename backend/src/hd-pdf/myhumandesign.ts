import type { UserProfile } from "../agent-service.js";
import { extractPdfText } from "./pdf-text.js";
import { validateActivatedGates } from "./validate.js";

const GATE_LINE_REGEX = /\b\d{1,2}\.\d\b/g;

const MYHUMANDESIGN_PLANETS = [
  "Sun",
  "Earth",
  "North Node",
  "South Node",
  "Moon",
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
  return matches.map((value) => {
    const [gateRaw, lineRaw] = value.split(".");
    return { gate: Number(gateRaw), line: Number(lineRaw) };
  });
}

function mapGateLinesToPlanets(gateLines: GateLine[]): ActivatedGate[] {
  if (gateLines.length !== 26) {
    throw new Error(`MyHumanDesign PDF: expected 26 gate.line values, got ${gateLines.length}`);
  }

  const mapped = gateLines.map((gateLine, index) => ({
    number: gateLine.gate,
    line: gateLine.line,
    planet: MYHUMANDESIGN_PLANETS[index % 13],
    isPersonality: index >= 13,
  }));
  validateActivatedGates(mapped, MYHUMANDESIGN_PLANETS, "MyHumanDesign");
  return mapped;
}

export async function parseMyHumanDesignPdf(
  buffer: Buffer,
): Promise<ActivatedGate[]> {
  const text = await extractPdfText(buffer);
  const gateLines = parseGateLines(text);
  return mapGateLinesToPlanets(gateLines);
}
