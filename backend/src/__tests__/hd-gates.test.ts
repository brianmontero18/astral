/**
 * HD Gate Mapping — Deterministic tests
 *
 * Tests the Rave Mandala zodiac-to-gate conversion, center mappings,
 * and center normalization. All pure functions, no I/O.
 */

import { describe, it, expect } from "vitest";
import { degreeToGate, GATE_TO_CENTER, normalizeCenter } from "../hd-gates.js";

describe("degreeToGate", () => {
  it("maps Gate 41 at the start of the Rave Mandala (302°)", () => {
    const result = degreeToGate(302);
    expect(result.gate).toBe(41);
    expect(result.line).toBe(1);
  });

  it("maps Gate 41 line 6 near the end of its 5.625° span", () => {
    // Gate 41 spans 302° to 307.625°
    const result = degreeToGate(307.5);
    expect(result.gate).toBe(41);
    expect(result.line).toBe(6);
  });

  it("maps Gate 19 right after Gate 41", () => {
    // Gate 19 starts at 302 + 5.625 = 307.625°
    const result = degreeToGate(308);
    expect(result.gate).toBe(19);
  });

  it("wraps around 360° correctly", () => {
    // Gate 60 is the last in the sequence (position 63)
    // Starts at 302 + 63 * 5.625 = 302 + 354.375 = 656.375 → 296.375°
    const result = degreeToGate(297);
    expect(result.gate).toBe(60);
  });

  it("maps 0° Aries correctly (should NOT be gate 1)", () => {
    // 0° Aries is NOT the start of the HD wheel — the offset is 302°
    const result = degreeToGate(0);
    expect(result.gate).not.toBe(1);
  });

  it("returns line between 1 and 6 for any degree", () => {
    for (let deg = 0; deg < 360; deg += 7.5) {
      const { line } = degreeToGate(deg);
      expect(line).toBeGreaterThanOrEqual(1);
      expect(line).toBeLessThanOrEqual(6);
    }
  });

  it("returns a valid gate (1-64) for any degree", () => {
    for (let deg = 0; deg < 360; deg += 1) {
      const { gate } = degreeToGate(deg);
      expect(gate).toBeGreaterThanOrEqual(1);
      expect(gate).toBeLessThanOrEqual(64);
    }
  });
});

describe("GATE_TO_CENTER", () => {
  it("maps all 64 gates to a center", () => {
    for (let gate = 1; gate <= 64; gate++) {
      expect(GATE_TO_CENTER[gate], `Gate ${gate} missing from GATE_TO_CENTER`).toBeDefined();
    }
  });

  it("has exactly 9 unique centers", () => {
    const centers = new Set(Object.values(GATE_TO_CENTER));
    expect(centers.size).toBe(9);
    expect(centers).toContain("Head");
    expect(centers).toContain("Ajna");
    expect(centers).toContain("Throat");
    expect(centers).toContain("G");
    expect(centers).toContain("Heart");
    expect(centers).toContain("Spleen");
    expect(centers).toContain("Sacral");
    expect(centers).toContain("SolarPlexus");
    expect(centers).toContain("Root");
  });

  it("has correct gate counts per center", () => {
    const counts: Record<string, number> = {};
    for (const center of Object.values(GATE_TO_CENTER)) {
      counts[center] = (counts[center] ?? 0) + 1;
    }
    expect(counts.Head).toBe(3);
    expect(counts.Ajna).toBe(6);
    expect(counts.Throat).toBe(11);
    expect(counts.G).toBe(8);
    expect(counts.Heart).toBe(4);
    expect(counts.Spleen).toBe(7);
    expect(counts.Sacral).toBe(9);
    expect(counts.SolarPlexus).toBe(7);
    expect(counts.Root).toBe(9);
  });

  it("totals exactly 64 gates", () => {
    expect(Object.keys(GATE_TO_CENTER).length).toBe(64);
  });
});

describe("normalizeCenter", () => {
  it("passes through canonical English names", () => {
    expect(normalizeCenter("Head")).toBe("Head");
    expect(normalizeCenter("Ajna")).toBe("Ajna");
    expect(normalizeCenter("SolarPlexus")).toBe("SolarPlexus");
  });

  it("normalizes Spanish names from GPT extraction", () => {
    expect(normalizeCenter("Cabeza")).toBe("Head");
    expect(normalizeCenter("Garganta")).toBe("Throat");
    expect(normalizeCenter("Centro G")).toBe("G");
    expect(normalizeCenter("Corazón")).toBe("Heart");
    expect(normalizeCenter("Bazo")).toBe("Spleen");
    expect(normalizeCenter("Raíz")).toBe("Root");
    expect(normalizeCenter("Plexo Solar")).toBe("SolarPlexus");
  });

  it("normalizes English variants", () => {
    expect(normalizeCenter("Will")).toBe("Heart");
    expect(normalizeCenter("Ego")).toBe("Heart");
    expect(normalizeCenter("Splenic")).toBe("Spleen");
    expect(normalizeCenter("Emotional")).toBe("SolarPlexus");
    expect(normalizeCenter("G Center")).toBe("G");
  });

  it("returns original name if not found in mapping", () => {
    expect(normalizeCenter("UnknownCenter")).toBe("UnknownCenter");
  });
});
