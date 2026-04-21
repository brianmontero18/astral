/**
 * Transits API — Integration tests
 *
 * Swiss Ephemeris is deterministic: same date → same positions.
 * Tests verify the API returns proper structure and impact analysis.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

const { fetchWeeklyTransitsMock } = vi.hoisted(() => ({
  fetchWeeklyTransitsMock: vi.fn(),
}));

vi.mock("../auth/session.js", () => mockSessionModule());

vi.mock("../transit-service.js", async () => {
  const actual = await vi.importActual<typeof import("../transit-service.js")>(
    "../transit-service.js",
  );

  return {
    ...actual,
    fetchWeeklyTransits: fetchWeeklyTransitsMock,
  };
});

const {
  createLinkedTestUser,
  createTestApp,
  createTestUser,
  sessionHeaders,
} = await import("./helpers.js");
const actualTransitService = await vi.importActual<typeof import("../transit-service.js")>(
  "../transit-service.js",
);

let app: FastifyInstance;

beforeAll(async () => {
  fetchWeeklyTransitsMock.mockImplementation(actualTransitService.fetchWeeklyTransits);
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  fetchWeeklyTransitsMock.mockReset();
  fetchWeeklyTransitsMock.mockImplementation(actualTransitService.fetchWeeklyTransits);
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

  it("does NOT include impact without a validated session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/transits" });
    const body = JSON.parse(res.body);

    expect(body.impact).toBeUndefined();
  });

  it("includes impact for the linked session user even without a query userId", async () => {
    await createLinkedTestUser(app, "st-transits-linked");
    const res = await app.inject({
      method: "GET",
      url: "/api/transits",
      headers: sessionHeaders("st-transits-linked"),
    });
    const body = JSON.parse(res.body);

    expect(body.planets).toHaveLength(13);
    expect(body.impact).toBeDefined();
    expect(Array.isArray(body.impact.personalChannels)).toBe(true);
    expect(Array.isArray(body.impact.reinforcedGates)).toBe(true);
    expect(Array.isArray(body.impact.conditionedCenters)).toBe(true);
    expect(Array.isArray(body.impact.educationalChannels)).toBe(true);
  });

  it("ignores userId query authority when there is no validated session", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "GET",
      url: `/api/transits?userId=${userId}`,
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

  it("returns 502 on upstream transit failures and recovers on a later request", async () => {
    fetchWeeklyTransitsMock
      .mockRejectedValueOnce(new Error("Swiss Ephemeris unavailable"))
      .mockImplementation(actualTransitService.fetchWeeklyTransits);
    const recoveryUrl = "/api/transits?timeZone=Pacific%2FHonolulu";

    const failedRes = await app.inject({
      method: "GET",
      url: recoveryUrl,
    });

    expect(failedRes.statusCode).toBe(502);
    expect(JSON.parse(failedRes.body)).toMatchObject({
      error: expect.any(String),
    });

    const recoveredRes = await app.inject({
      method: "GET",
      url: recoveryUrl,
    });
    const recoveredBody = JSON.parse(recoveredRes.body);

    expect(recoveredRes.statusCode).toBe(200);
    expect(recoveredBody.planets).toHaveLength(13);
    expect(recoveredBody.weekRange).toBeDefined();
    expect(fetchWeeklyTransitsMock).toHaveBeenCalledTimes(2);
  });
});
