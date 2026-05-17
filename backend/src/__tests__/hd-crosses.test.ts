/**
 * Unit tests para hd-crosses — tabla canónica de Incarnation Crosses.
 *
 * La tabla cubre los 192 cruces (64 gates × 3 angles). Cross-referenced contra
 * SharpAstrology.HumanDesign (MIT).
 */
import { describe, expect, it } from "vitest";
import { lookupIncarnationCross, profileToAngle } from "../hd-crosses.js";

describe("profileToAngle", () => {
  it("maps the 7 right-angle profiles", () => {
    expect(profileToAngle("1/3")).toBe("right");
    expect(profileToAngle("1/4")).toBe("right");
    expect(profileToAngle("2/4")).toBe("right");
    expect(profileToAngle("2/5")).toBe("right");
    expect(profileToAngle("3/5")).toBe("right");
    expect(profileToAngle("3/6")).toBe("right");
    expect(profileToAngle("4/6")).toBe("right");
  });

  it("maps the 4 left-angle profiles", () => {
    expect(profileToAngle("5/1")).toBe("left");
    expect(profileToAngle("5/2")).toBe("left");
    expect(profileToAngle("6/2")).toBe("left");
    expect(profileToAngle("6/3")).toBe("left");
  });

  it("maps the single juxtaposition profile (4/1)", () => {
    expect(profileToAngle("4/1")).toBe("juxtaposition");
  });

  it("returns null for unknown / malformed profiles", () => {
    expect(profileToAngle("7/2")).toBeNull();
    expect(profileToAngle("4-6")).toBeNull();
    expect(profileToAngle("")).toBeNull();
    expect(profileToAngle("1/2")).toBeNull(); // 1/2 isn't a canonical HD profile
  });
});

describe("lookupIncarnationCross", () => {
  describe("canonical fixtures", () => {
    it("returns RAX Service 4 for Agos (gate=58, profile=4/6)", () => {
      expect(lookupIncarnationCross(58, "4/6")).toBe("RAX Service 4");
    });

    it("returns LAX Industry for (gate=30, profile=6/2)", () => {
      expect(lookupIncarnationCross(30, "6/2")).toBe("LAX Industry");
    });

    it("returns JUX Conflict for (gate=6, profile=4/1)", () => {
      expect(lookupIncarnationCross(6, "4/1")).toBe("JUX Conflict");
    });

    it("returns RAX Sphinx for (gate=13, profile=1/3) — the canonical first right-angle cross", () => {
      expect(lookupIncarnationCross(13, "1/3")).toBe("RAX Sphinx");
    });
  });

  describe("invalid inputs", () => {
    it("returns empty string for invalid gate numbers", () => {
      expect(lookupIncarnationCross(0, "4/6")).toBe("");
      expect(lookupIncarnationCross(65, "4/6")).toBe("");
      expect(lookupIncarnationCross(-1, "4/6")).toBe("");
      expect(lookupIncarnationCross(1.5, "4/6")).toBe("");
    });

    it("returns empty string for invalid profile", () => {
      expect(lookupIncarnationCross(13, "7/2")).toBe("");
      expect(lookupIncarnationCross(13, "")).toBe("");
    });
  });

  describe("coverage — all 192 entries return a populated short name", () => {
    const PROFILES_BY_ANGLE: Record<"right" | "left" | "juxtaposition", string> = {
      right: "1/3",
      left: "5/1",
      juxtaposition: "4/1",
    };

    for (const angle of ["right", "left", "juxtaposition"] as const) {
      it(`returns a name with the expected prefix for every gate in the ${angle} table`, () => {
        const expectedPrefix =
          angle === "right" ? "RAX " : angle === "left" ? "LAX " : "JUX ";
        const profile = PROFILES_BY_ANGLE[angle];
        for (let g = 1; g <= 64; g++) {
          const name = lookupIncarnationCross(g, profile);
          expect(name, `(${g}, ${angle})`).toMatch(/^(RAX|LAX|JUX) /);
          expect(name.startsWith(expectedPrefix), `(${g}, ${angle}) got "${name}"`).toBe(true);
        }
      });
    }
  });
});
