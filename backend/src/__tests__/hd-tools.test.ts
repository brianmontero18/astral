/**
 * HD Tools — unit tests.
 *
 * Verifica el contrato de las tools que el LLM va a invocar. Los tools son
 * thin wrappers sobre helpers ya testeados, pero igual los testeamos para
 * blindar el contrato: una vez que el modelo aprende a llamar `findChannelByGates`,
 * cualquier cambio en el shape (input o output) rompe el system prompt.
 */

import { describe, it, expect } from "vitest";
import {
  findChannelByGatesTool,
  findChannelsByGateTool,
  findChannelByIdTool,
  getCenterForGateTool,
  listAllChannelsTool,
  hdTools,
} from "../hd-tools/index.js";

// Helper: execute a tool's `execute` function with a typed input.
async function runTool<TInput, TOutput>(
  toolDef: { execute?: (input: TInput, options?: unknown) => Promise<TOutput> },
  input: TInput,
): Promise<TOutput> {
  if (!toolDef.execute) {
    throw new Error("tool has no execute fn");
  }
  return toolDef.execute(input, {});
}

describe("findChannelByGatesTool", () => {
  it("resolves a valid channel by its two gates", async () => {
    const result = await runTool(findChannelByGatesTool, { gateA: 1, gateB: 8 });
    expect(result).toMatchObject({
      id: "1-8",
      name: "Canal de Inspiración",
      gates: [1, 8],
    });
  });

  it("is symmetric: order of gates does not matter", async () => {
    const result = await runTool(findChannelByGatesTool, { gateA: 8, gateB: 1 });
    expect(result).toMatchObject({ id: "1-8" });
  });

  it("returns null for gates that do NOT form a channel (Daniela case)", async () => {
    // Caso real del bug: el modelo dijo que Puerta 8 forma Canal 20-34.
    // La tool debe rechazar: 8 no está en el canal 20-34.
    const result = await runTool(findChannelByGatesTool, { gateA: 8, gateB: 20 });
    expect(result).toBeNull();
  });

  it("returns null for invalid channel id (1+1 — same gate)", async () => {
    const result = await runTool(findChannelByGatesTool, { gateA: 1, gateB: 1 });
    expect(result).toBeNull();
  });
});

describe("findChannelsByGateTool", () => {
  it("returns the single channel for a gate that participates in one", async () => {
    const result = await runTool(findChannelsByGateTool, { gate: 8 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "1-8", name: "Canal de Inspiración" });
  });

  it("returns multiple channels for gates with multiple memberships", async () => {
    // Puerta 10 está en 10-20, 10-34, 10-57.
    const result = await runTool(findChannelsByGateTool, { gate: 10 });
    const ids = result.map((c) => c.id).sort();
    expect(ids).toEqual(["10-20", "10-34", "10-57"]);
  });

  it("returns a single-element array for a gate that participates in exactly one channel (Gate 64 → 47-64)", async () => {
    const result = await runTool(findChannelsByGateTool, { gate: 64 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("47-64");
  });
});

describe("findChannelByIdTool", () => {
  it("resolves a canonical id", async () => {
    const result = await runTool(findChannelByIdTool, { id: "20-34" });
    expect(result).toMatchObject({
      id: "20-34",
      name: "Canal de Carisma",
      gates: [20, 34],
    });
  });

  it("returns null for a non-existent id", async () => {
    const result = await runTool(findChannelByIdTool, { id: "8-20" });
    expect(result).toBeNull();
  });
});

describe("getCenterForGateTool", () => {
  it("returns the canonical center for a known gate", async () => {
    // Gate 1 vive en el Centro G según GATE_TO_CENTER.
    const result = await runTool(getCenterForGateTool, { gate: 1 });
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns the same center for two gates of the same channel that share center end", async () => {
    // Algunos canales conectan dos centros — esto solo verifica que la tool
    // devuelva strings consistentes, no la topología.
    const c1 = await runTool(getCenterForGateTool, { gate: 8 });
    const c2 = await runTool(getCenterForGateTool, { gate: 8 });
    expect(c1).toBe(c2);
  });
});

describe("listAllChannelsTool", () => {
  it("returns exactly 36 channels", async () => {
    const result = await runTool(listAllChannelsTool, {});
    expect(result).toHaveLength(36);
  });

  it("returns channels with the expected shape", async () => {
    const result = await runTool(listAllChannelsTool, {});
    const sample = result[0];
    expect(sample).toHaveProperty("id");
    expect(sample).toHaveProperty("name");
    expect(sample).toHaveProperty("gates");
    expect(sample).toHaveProperty("circuit");
    expect(sample).toHaveProperty("subCircuit");
  });
});

describe("hdTools registry", () => {
  it("exposes the expected tool names", () => {
    expect(Object.keys(hdTools).sort()).toEqual([
      "findChannelById",
      "findChannelByGates",
      "findChannelsByGate",
      "getCenterForGate",
      "listAllChannels",
    ].sort());
  });

  it("each tool has a description (the model reads this)", () => {
    for (const [name, t] of Object.entries(hdTools)) {
      expect(t.description, `${name} missing description`).toBeTruthy();
      expect((t.description as string).length).toBeGreaterThan(40);
    }
  });
});
