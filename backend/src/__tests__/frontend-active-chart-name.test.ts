import { describe, expect, it } from "vitest";

import {
  getActiveChartNameError,
  normalizeActiveChartName,
} from "../../../frontend/src/active-chart-name";

describe("frontend active chart name validation", () => {
  it("normalizes surrounding and repeated whitespace", () => {
    expect(normalizeActiveChartName("  María   José  ")).toBe("María José");
  });

  it("accepts human-readable names with accents and punctuation", () => {
    expect(getActiveChartNameError("M. Paula-Luz")).toBeNull();
  });

  it("rejects blank, invisible, symbol-only and overly long names", () => {
    expect(getActiveChartNameError("   ")).toBe("Ingresá un nombre para esta carta.");
    expect(getActiveChartNameError("\u0000Agus")).toBe("Usá letras o números visibles.");
    expect(getActiveChartNameError("!!!")).toBe("Usá letras o números visibles.");
    expect(getActiveChartNameError("a".repeat(61))).toBe("Usá un nombre más corto.");
  });
});
