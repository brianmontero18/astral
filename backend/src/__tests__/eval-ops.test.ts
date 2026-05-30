/**
 * Eval ops pure helpers — Unit tests (astral-y3c.3)
 *
 * Covers the testable logic behind the seed-corpus and pass-rate-alert scripts,
 * which themselves only wire these to prod I/O.
 */

import { describe, it, expect } from "vitest";
import type { EvalPassRateRow } from "../db.js";
import {
  DEFAULT_PASSRATE_THRESHOLD,
  findDegradedEvals,
  mapSeedRow,
  resolvePassRateThreshold,
} from "../evals/eval-ops.js";

describe("mapSeedRow", () => {
  it("maps a full row and parses the intake JSON", () => {
    const entry = mapSeedRow({
      assistant_id: 42,
      user_id: "u1",
      assistant_content: "respuesta",
      created_at: "2026-05-29T10:00:00.000Z",
      user_content: "pregunta",
      name: "Pilar",
      email: "pilar@example.com",
      intake: JSON.stringify({ actividad: "mentora" }),
      memory_md: "## Identidad\n- coach",
    });

    expect(entry).toEqual({
      assistantMsgId: 42,
      userId: "u1",
      name: "Pilar",
      email: "pilar@example.com",
      userInput: "pregunta",
      output: "respuesta",
      intake: { actividad: "mentora" },
      memory: "## Identidad\n- coach",
      createdAt: "2026-05-29T10:00:00.000Z",
    });
  });

  it("nulls out missing optional fields and bad JSON", () => {
    const entry = mapSeedRow({
      assistant_id: 7,
      user_id: "u2",
      assistant_content: "hola",
      created_at: "2026-05-29T10:00:00.000Z",
      user_content: null,
      name: null,
      email: null,
      intake: "not-json",
      memory_md: null,
    });

    expect(entry.userInput).toBeNull();
    expect(entry.name).toBeNull();
    expect(entry.intake).toBeNull();
    expect(entry.memory).toBeNull();
  });
});

describe("resolvePassRateThreshold", () => {
  it("uses the default when missing or invalid", () => {
    expect(resolvePassRateThreshold(undefined)).toBe(DEFAULT_PASSRATE_THRESHOLD);
    expect(resolvePassRateThreshold("")).toBe(DEFAULT_PASSRATE_THRESHOLD);
    expect(resolvePassRateThreshold("abc")).toBe(DEFAULT_PASSRATE_THRESHOLD);
    expect(resolvePassRateThreshold("1.5")).toBe(DEFAULT_PASSRATE_THRESHOLD);
  });

  it("parses a valid threshold in [0,1]", () => {
    expect(resolvePassRateThreshold("0.85")).toBe(0.85);
    expect(resolvePassRateThreshold("0")).toBe(0);
  });
});

describe("findDegradedEvals", () => {
  const rows: EvalPassRateRow[] = [
    { evalName: "anti-sycophancy", surface: "chat", total: 10, passed: 5, passRate: 0.5 },
    { evalName: "spanish", surface: "chat", total: 10, passed: 10, passRate: 1 },
    { evalName: "empty", surface: "chat", total: 0, passed: 0, passRate: 0 },
  ];

  it("returns only evals below the threshold with samples", () => {
    const degraded = findDegradedEvals(rows, 0.7);
    expect(degraded.map((r) => r.evalName)).toEqual(["anti-sycophancy"]);
  });

  it("returns nothing when all evals are above the threshold", () => {
    expect(findDegradedEvals(rows, 0.4)).toHaveLength(0);
  });
});
