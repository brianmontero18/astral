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

  it("handles negative longitudes via modulo wrap", () => {
    // -58° == 302° (Gate 41 start)
    const result = degreeToGate(-58);
    expect(result.gate).toBe(41);
    expect(result.line).toBe(1);
  });

  it("handles longitudes greater than 360° via modulo wrap", () => {
    // 720° + 302° == 302° (Gate 41 start)
    const result = degreeToGate(720 + 302);
    expect(result.gate).toBe(41);
    expect(result.line).toBe(1);
  });

  it("respects exact line boundaries within Gate 41 (5.625° / 6 = 0.9375°)", () => {
    // Each line covers 0.9375°. Verify boundary moments rather than midpoints.
    expect(degreeToGate(302).line).toBe(1);             // Line 1 start
    expect(degreeToGate(302.9374).line).toBe(1);        // Line 1 end (just before)
    expect(degreeToGate(302.9375).line).toBe(2);        // Line 2 start
    expect(degreeToGate(303.875).line).toBe(3);         // Line 3 start (302 + 2 * 0.9375)
    expect(degreeToGate(304.8125).line).toBe(4);
    expect(degreeToGate(305.75).line).toBe(5);
    expect(degreeToGate(306.6875).line).toBe(6);
    // Just before next gate (307.625): still line 6 of Gate 41
    expect(degreeToGate(307.6249).line).toBe(6);
  });

  it("maps every Rave Mandala slot to its expected gate (full 64-slot validation)", () => {
    // Each slot is 5.625° starting at 302°. Probe a tiny epsilon past the slot
    // start so we don't catch the previous gate's line 6 boundary.
    const SEQUENCE = [
      41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
      27, 24, 2,  23, 8,  20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
      31, 33, 7,  4,  29, 59, 40, 64, 47, 6,  46, 18, 48, 57, 32, 50,
      28, 44, 1,  43, 14, 34, 9,  5,  26, 11, 10, 58, 38, 54, 61, 60,
    ];
    for (let slot = 0; slot < 64; slot += 1) {
      const longitude = (302 + slot * 5.625 + 0.001) % 360;
      const { gate, line } = degreeToGate(longitude);
      expect(gate, `slot ${slot} should map to gate ${SEQUENCE[slot]}`).toBe(SEQUENCE[slot]);
      expect(line, `slot ${slot} line should be 1`).toBe(1);
    }
  });

  it("respects exact gate boundaries around 0° Aries", () => {
    // 0° Aries falls inside Gate 25 (slot 10), which starts at 302 + 10*5.625 = 358.25°
    // and ends at 363.875° (wrapping to 3.875° Aries).
    expect(degreeToGate(358.25).gate).toBe(25);
    expect(degreeToGate(0).gate).toBe(25);
    expect(degreeToGate(3.5).gate).toBe(25);
    expect(degreeToGate(3.875).gate).toBe(17);
  });

  describe("tone (sixth subdivision of a line)", () => {
    // Each line is 0.9375°, each tone is 0.9375/6 = 0.15625°.
    it("returns tone 1 at the start of line 1 of Gate 41", () => {
      expect(degreeToGate(302).tone).toBe(1);
    });

    it("returns tone 6 at the end of line 1 of Gate 41", () => {
      // Line 1 spans 302° to 302.9375°. The last tone slot starts at
      // 302 + 5*0.15625 = 302.78125° and ends at 302.9375°.
      expect(degreeToGate(302.78125).tone).toBe(6);
      expect(degreeToGate(302.9374).tone).toBe(6);
    });

    it("rolls tone back to 1 when crossing into the next line", () => {
      // 302.9375° is the start of line 2 → tone 1 of line 2.
      const r = degreeToGate(302.9375);
      expect(r.line).toBe(2);
      expect(r.tone).toBe(1);
    });

    it("matches every tone slot within line 1 of Gate 41", () => {
      const TONE_WIDTH = 0.15625;
      for (let tone = 1; tone <= 6; tone++) {
        // Probe a tiny epsilon past the tone slot start.
        const longitude = 302 + (tone - 1) * TONE_WIDTH + 0.001;
        const r = degreeToGate(longitude);
        expect(r.gate, `tone ${tone} probe should still be gate 41`).toBe(41);
        expect(r.line, `tone ${tone} probe should still be line 1`).toBe(1);
        expect(r.tone, `tone slot ${tone}`).toBe(tone);
      }
    });

    it("returns tone in [1, 6] for any degree", () => {
      for (let deg = 0; deg < 360; deg += 0.7) {
        const { tone } = degreeToGate(deg);
        expect(tone).toBeGreaterThanOrEqual(1);
        expect(tone).toBeLessThanOrEqual(6);
      }
    });
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
