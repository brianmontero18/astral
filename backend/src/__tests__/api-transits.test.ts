/**
 * Transits API — Integration tests
 *
 * Swiss Ephemeris is deterministic: same date → same positions.
 * Tests verify the API returns proper structure and impact analysis.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, createTestUser } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/transits", () => {
  it("returns 13 planets with HD gate data", async () => {
    const res = await app.inject({ method: "GET", url: "/api/transits" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.planets).toHaveLength(13);
    expect(body.weekRange).toBeDefined();
    expect(body.fetchedAt).toBeDefined();
    expect(Array.isArray(body.activatedChannels)).toBe(true);

    // Verify each planet has required fields
    for (const planet of body.planets) {
      expect(planet.name).toBeDefined();
      expect(planet.sign).toBeDefined();
      expect(planet.degree).toBeGreaterThanOrEqual(0);
      expect(planet.hdGate).toBeGreaterThanOrEqual(1);
      expect(planet.hdGate).toBeLessThanOrEqual(64);
      expect(planet.hdLine).toBeGreaterThanOrEqual(1);
      expect(planet.hdLine).toBeLessThanOrEqual(6);
      expect(typeof planet.isRetrograde).toBe("boolean");
    }
  });

  it("includes all expected planet names", async () => {
    const res = await app.inject({ method: "GET", url: "/api/transits" });
    const names = JSON.parse(res.body).planets.map((p: { name: string }) => p.name);

    const expected = [
      "Sol", "Luna", "Mercurio", "Venus", "Marte",
      "Júpiter", "Saturno", "Urano", "Neptuno", "Plutón",
      "Quirón", "Nodo Norte", "Nodo Sur",
    ];
    for (const name of expected) {
      expect(names, `Missing planet: ${name}`).toContain(name);
    }
  });

  it("does NOT include impact without userId", async () => {
    const res = await app.inject({ method: "GET", url: "/api/transits" });
    const body = JSON.parse(res.body);

    expect(body.impact).toBeUndefined();
  });

  it("includes impact with valid userId", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "GET",
      url: `/api/transits?userId=${userId}`,
    });
    const body = JSON.parse(res.body);

    expect(body.planets).toHaveLength(13);
    expect(body.impact).toBeDefined();
    expect(Array.isArray(body.impact.personalChannels)).toBe(true);
    expect(Array.isArray(body.impact.reinforcedGates)).toBe(true);
    expect(Array.isArray(body.impact.conditionedCenters)).toBe(true);
    expect(Array.isArray(body.impact.educationalChannels)).toBe(true);
  });

  it("returns transits without impact for nonexistent userId (graceful)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/transits?userId=nonexistent-fake-id",
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.planets).toHaveLength(13);
    expect(body.impact).toBeUndefined();
  });

  it("accepts timeZone parameter", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/transits?timeZone=America/Argentina/Buenos_Aires",
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.weekRange).toMatch(/de \w+ de \d{4}/); // Spanish date format
  });
});
