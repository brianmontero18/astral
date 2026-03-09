/**
 * Health & Utils — Integration + unit tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "./helpers.js";
import { getISOWeekKey } from "../db.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.ts).toBeDefined();
  });
});

describe("getISOWeekKey", () => {
  it("returns YYYY-WXX format", () => {
    const key = getISOWeekKey(new Date("2026-03-09"));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("same week dates produce same key", () => {
    // Use local dates to avoid UTC timezone shifts
    const monday = getISOWeekKey(new Date(2026, 2, 9));    // Mon Mar 9
    const wednesday = getISOWeekKey(new Date(2026, 2, 11)); // Wed Mar 11
    const sunday = getISOWeekKey(new Date(2026, 2, 15));    // Sun Mar 15
    expect(monday).toBe(wednesday);
    expect(wednesday).toBe(sunday);
  });

  it("different week dates produce different keys", () => {
    const week1 = getISOWeekKey(new Date(2026, 2, 9));  // Mar 9
    const week2 = getISOWeekKey(new Date(2026, 2, 16)); // Mar 16
    expect(week1).not.toBe(week2);
  });

  it("handles year boundaries", () => {
    const key = getISOWeekKey(new Date(2025, 11, 31)); // Dec 31
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });
});
