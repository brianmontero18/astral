/**
 * eval_results persistence — Integration tests
 *
 * Covers insertEvalResults / getEvalResultsForUser / getEvalResultsByTarget /
 * getEvalPassRates: round-trip, polymorphic surfaces, the three sources sharing a
 * target (alignment base), context snapshot persistence, and pass-rate aggregation.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

const { createLinkedTestUser, createTestApp } = await import("./helpers.js");
const {
  insertEvalResults,
  getEvalResultsForUser,
  getEvalResultsByTarget,
  getEvalPassRates,
} = await import("../db.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

describe("insertEvalResults / getEvalResultsForUser", () => {
  it("round-trips rows and maps pass to boolean", async () => {
    const userId = await createLinkedTestUser(app, "eval-roundtrip");
    await insertEvalResults([
      { userId, surface: "chat", targetId: "10", source: "heuristic", evalName: "anti-sycophancy", pass: false, reason: "sin tensión" },
      { userId, surface: "chat", targetId: "10", source: "heuristic", evalName: "spanish", pass: true, reason: "ok" },
    ]);

    const rows = await getEvalResultsForUser(userId);
    expect(rows).toHaveLength(2);
    const sycophancy = rows.find((r) => r.evalName === "anti-sycophancy");
    expect(sycophancy?.pass).toBe(false);
    expect(sycophancy?.reason).toBe("sin tensión");
    expect(sycophancy?.surface).toBe("chat");
    expect(sycophancy?.source).toBe("heuristic");
  });

  it("is a no-op on empty input", async () => {
    const userId = await createLinkedTestUser(app, "eval-empty");
    await insertEvalResults([]);
    expect(await getEvalResultsForUser(userId)).toHaveLength(0);
  });

  it("persists the context snapshot as JSON", async () => {
    const userId = await createLinkedTestUser(app, "eval-snapshot");
    await insertEvalResults([
      {
        userId,
        surface: "chat",
        targetId: "20",
        source: "heuristic",
        evalName: "uses-business-context",
        pass: true,
        reason: "ok",
        contextSnapshot: { intake: { actividad: "mentora" }, memoryPresent: true },
      },
    ]);

    const [row] = await getEvalResultsForUser(userId);
    expect(row.contextSnapshotJson).toBeTypeOf("string");
    expect(JSON.parse(row.contextSnapshotJson ?? "{}")).toMatchObject({
      intake: { actividad: "mentora" },
      memoryPresent: true,
    });
  });

  it("filters by surface (polymorphic chat + report on one user)", async () => {
    const userId = await createLinkedTestUser(app, "eval-polymorphic");
    await insertEvalResults([
      { userId, surface: "chat", targetId: "30", source: "heuristic", evalName: "spanish", pass: true, reason: "ok" },
      { userId, surface: "report", targetId: "rep-uuid", source: "heuristic", evalName: "legacy-sections", pass: true, reason: "ok" },
    ]);

    const chatOnly = await getEvalResultsForUser(userId, { surface: "chat" });
    expect(chatOnly).toHaveLength(1);
    expect(chatOnly[0].surface).toBe("chat");

    const reportOnly = await getEvalResultsForUser(userId, { surface: "report" });
    expect(reportOnly).toHaveLength(1);
    expect(reportOnly[0].targetId).toBe("rep-uuid");
  });
});

describe("getEvalResultsByTarget", () => {
  it("returns heuristic, human and judge rows for the same target", async () => {
    const userId = await createLinkedTestUser(app, "eval-by-target");
    const targetId = "alignment-target";
    await insertEvalResults([
      { userId, surface: "chat", targetId, source: "heuristic", evalName: "anti-sycophancy", pass: false, reason: "h" },
      { userId, surface: "chat", targetId, source: "human", evalName: "overall", pass: false, reason: "valida todo" },
      { userId, surface: "chat", targetId, source: "judge", evalName: "overall", pass: false, reason: "j", model: "gpt-4o-mini" },
    ]);

    const rows = await getEvalResultsByTarget(targetId);
    expect(rows.map((r) => r.source).sort()).toEqual(["heuristic", "human", "judge"]);
    const judge = rows.find((r) => r.source === "judge");
    expect(judge?.model).toBe("gpt-4o-mini");
  });
});

describe("getEvalPassRates", () => {
  it("aggregates pass-rate per eval since a cutoff", async () => {
    const userId = await createLinkedTestUser(app, "eval-passrate");
    const since = new Date(Date.now() - 60_000).toISOString();
    // Unique eval_name keeps the assertion deterministic regardless of other rows.
    const evalName = "passrate-fixture-xyz";
    await insertEvalResults([
      { userId, surface: "chat", targetId: "p1", source: "heuristic", evalName, pass: true, reason: "" },
      { userId, surface: "chat", targetId: "p2", source: "heuristic", evalName, pass: true, reason: "" },
      { userId, surface: "chat", targetId: "p3", source: "heuristic", evalName, pass: false, reason: "" },
    ]);

    const rates = await getEvalPassRates({ since, surface: "chat", source: "heuristic" });
    const fixture = rates.find((r) => r.evalName === evalName);
    expect(fixture).toBeDefined();
    expect(fixture?.total).toBe(3);
    expect(fixture?.passed).toBe(2);
    expect(fixture?.passRate).toBeCloseTo(2 / 3, 5);
  });
});
