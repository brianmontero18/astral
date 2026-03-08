/**
 * Human Design Gate Mapper
 *
 * Converts a planet's ecliptic longitude (0–360°) to a Human Design gate (1–64).
 *
 * The HD wheel maps the 64 hexagrams of the I Ching onto the 360° zodiac wheel.
 * The gates follow the Rave Mandala sequence (Ra Uru Hu), NOT sequential 1–64.
 * The sequence does NOT start at 0° Aries — it starts at an offset of 302°
 * (2°0' Aquarius), where Gate 41 begins.
 *
 * Each gate covers 360/64 = 5.625°
 *
 * Sources: Jovian Archive Rave Mandala, validated against
 * barneyandflow.com/gate-zodiac-degrees and
 * embodyyourdesign.com/blog/cheatsheet-astrology-positions-of-human-design-gates
 *
 * Full reference: docs/human-design-reference.md
 */

// Gate sequence around the Rave Mandala.
// Position 0 = Gate 41, starting at 302° absolute (2°0' Aquarius).
const GATE_SEQUENCE: number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2,  23, 8,  20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7,  4,  29, 59, 40, 64, 47, 6,  46, 18, 48, 57, 32, 50,
  28, 44, 1,  43, 14, 34, 9,  5,  26, 11, 10, 58, 38, 54, 61, 60,
];

const DEGREES_PER_GATE = 360 / 64; // 5.625°

/**
 * Offset del Rave Mandala.
 * Gate 41 (primera posición del array) comienza en 2°0' Acuario = 302° absolutos.
 * Gate 25 comienza en 28°15' Piscis = 358.25° absolutos (posición 10 del array).
 */
const WHEEL_OFFSET = 302;

export function degreeToGate(longitude: number): { gate: number; line: number } {
  const normalized = ((longitude % 360) + 360) % 360;
  const adjusted = ((normalized - WHEEL_OFFSET) % 360 + 360) % 360;

  const slot = Math.floor(adjusted / DEGREES_PER_GATE);
  const gate = GATE_SEQUENCE[slot];

  // Each gate has 6 lines, each covering 5.625° / 6 = 0.9375°
  const positionWithinGate = adjusted - slot * DEGREES_PER_GATE;
  const line = Math.floor(positionWithinGate / (DEGREES_PER_GATE / 6)) + 1;

  return { gate, line: Math.min(line, 6) };
}

// ─── Gate-to-Center mapping (64 gates → 9 centers) ───────────────────────────

export const GATE_TO_CENTER: Record<number, string> = {
  // Head (3)
  64: "Head", 61: "Head", 63: "Head",
  // Ajna (6)
  47: "Ajna", 24: "Ajna", 4: "Ajna", 17: "Ajna", 43: "Ajna", 11: "Ajna",
  // Throat (11)
  62: "Throat", 23: "Throat", 56: "Throat", 35: "Throat", 12: "Throat",
  45: "Throat", 33: "Throat", 8: "Throat", 31: "Throat", 20: "Throat", 16: "Throat",
  // G Center (8)
  7: "G", 1: "G", 13: "G", 10: "G", 15: "G", 2: "G", 46: "G", 25: "G",
  // Heart/Will/Ego (4)
  21: "Heart", 40: "Heart", 26: "Heart", 51: "Heart",
  // Spleen (7)
  48: "Spleen", 57: "Spleen", 44: "Spleen", 50: "Spleen", 32: "Spleen", 28: "Spleen", 18: "Spleen",
  // Sacral (9)
  5: "Sacral", 14: "Sacral", 29: "Sacral", 59: "Sacral", 9: "Sacral",
  3: "Sacral", 42: "Sacral", 27: "Sacral", 34: "Sacral",
  // Solar Plexus (7)
  6: "SolarPlexus", 37: "SolarPlexus", 22: "SolarPlexus", 36: "SolarPlexus",
  30: "SolarPlexus", 55: "SolarPlexus", 49: "SolarPlexus",
  // Root (9)
  53: "Root", 60: "Root", 52: "Root", 19: "Root", 39: "Root",
  41: "Root", 58: "Root", 38: "Root", 54: "Root",
};

// ─── Center name normalization ────────────────────────────────────────────────
// GPT-4o Vision extraction produces Spanish names; code uses canonical English IDs.

const CENTER_NORMALIZE: Record<string, string> = {
  // Canonical English
  "Head": "Head", "Ajna": "Ajna", "Throat": "Throat", "G": "G",
  "Heart": "Heart", "Spleen": "Spleen", "Sacral": "Sacral",
  "SolarPlexus": "SolarPlexus", "Root": "Root",
  // Spanish (from extraction HD_PROMPT)
  "Cabeza": "Head", "Garganta": "Throat", "Centro G": "G",
  "Corazón/Ego": "Heart", "Corazón": "Heart",
  "Bazo": "Spleen", "Raíz": "Root",
  "Solar Plexus": "SolarPlexus", "Plexo Solar": "SolarPlexus",
  // Common English variants
  "G Center": "G", "Identity": "G", "Self": "G",
  "Will": "Heart", "Ego": "Heart", "Splenic": "Spleen",
  "Emotional": "SolarPlexus",
};

export function normalizeCenter(name: string): string {
  return CENTER_NORMALIZE[name] ?? name;
}
