/**
 * Human Design Gate Mapper
 *
 * Converts a planet's ecliptic longitude (0–360°) to a Human Design gate (1–64).
 *
 * The HD wheel maps the 64 hexagrams of the I Ching onto the 360° zodiac wheel
 * starting at 0° Aries, but NOT in sequential order — the gates follow the
 * specific Ra Uru Hu mapping derived from the Rave Mandala.
 *
 * Each gate covers 360/64 = 5.625°
 *
 * Source: Standard HD gate sequence used by Jovian Archive, myBodyGraph, etc.
 */

// Gate sequence around the wheel, starting at 0° Aries (Vernal Equinox)
// Position 0 = 0°–5.625°, position 1 = 5.625°–11.25°, etc.
const GATE_SEQUENCE: number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2,  23, 8,  20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7,  4,  29, 59, 40, 64, 47, 6,  46, 18, 48, 57, 32, 50,
  28, 44, 1,  43, 14, 34, 9,  5,  26, 11, 10, 58, 38, 54, 61, 60,
];

const DEGREES_PER_GATE = 360 / 64; // 5.625°

export function degreeToGate(longitude: number): { gate: number; line: number } {
  // Normalize to 0–360
  const normalized = ((longitude % 360) + 360) % 360;

  // Which gate slot (0–63)
  const slot = Math.floor(normalized / DEGREES_PER_GATE);
  const gate = GATE_SEQUENCE[slot];

  // Which line within the gate (1–6)
  // Each gate has 6 lines, each covering DEGREES_PER_GATE / 6 = 0.9375°
  const positionWithinGate = normalized - slot * DEGREES_PER_GATE;
  const line = Math.floor(positionWithinGate / (DEGREES_PER_GATE / 6)) + 1;

  return { gate, line: Math.min(line, 6) };
}
