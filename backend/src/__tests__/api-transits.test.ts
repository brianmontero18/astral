/**
 * Transits API — Integration tests
 *
 * Swiss Ephemeris is deterministic: same date → same positions.
 * Tests verify the API returns proper structure and impact analysis.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { TransitSnapshot } from "../transit-service.js";
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
const { updateUserBodygraph } = await import("../db.js");
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

    expect(body.planets).toHaveLength(14);
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
      "Sol", "Tierra", "Luna", "Mercurio", "Venus", "Marte",
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

    expect(body.planets).toHaveLength(14);
    expect(body.impact).toBeDefined();
    expect(Array.isArray(body.impact.personalChannels)).toBe(true);
    expect(Array.isArray(body.impact.reinforcedGates)).toBe(true);
    expect(Array.isArray(body.impact.conditionedCenters)).toBe(true);
    expect(Array.isArray(body.impact.educationalChannels)).toBe(true);
  });

  it("recomputes personalized impact from users.profile while reusing cached collective transits", async () => {
    const subject = "st-transits-profile-replace";
    const userId = await createLinkedTestUser(app, subject, "Transit Replace User", {
      humanDesign: {
        activatedGates: [{ number: 34 }],
        definedCenters: ["Sacral"],
        undefinedCenters: ["G", "Throat"],
      },
    });
    fetchWeeklyTransitsMock.mockResolvedValue({
      fetchedAt: "2026-05-08T00:00:00.000Z",
      weekRange: "4 — 10 may · 2026",
      planets: [
        {
          name: "Sol",
          longitude: 0,
          sign: "Aries",
          degree: 0,
          isRetrograde: false,
          hdGate: 20,
          hdLine: 1,
        },
      ],
      activatedChannels: [],
    });

    const url = "/api/transits?timeZone=Etc%2FUTC&clientNow=1778198400000";
    const first = await app.inject({
      method: "GET",
      url,
      headers: sessionHeaders(subject),
    });

    expect(first.statusCode).toBe(200);
    expect(JSON.parse(first.body).impact.personalChannels).toEqual([
      expect.objectContaining({
        channelId: "20-34",
        userGate: 34,
        transitGate: 20,
      }),
    ]);

    await updateUserBodygraph(
      userId,
      {
        humanDesign: {
          activatedGates: [{ number: 1 }],
          definedCenters: ["Sacral"],
          undefinedCenters: ["G", "Throat"],
        },
      },
      "asset-transit-profile",
    );

    const second = await app.inject({
      method: "GET",
      url,
      headers: sessionHeaders(subject),
    });

    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).impact.personalChannels).toEqual([]);
    expect(fetchWeeklyTransitsMock).toHaveBeenCalledTimes(1);
  });

  it("ignores userId query authority when there is no validated session", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "GET",
      url: `/api/transits?userId=${userId}`,
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.planets).toHaveLength(14);
    expect(body.impact).toBeUndefined();
  });

  it("accepts timeZone parameter", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/transits?timeZone=America/Argentina/Buenos_Aires",
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    // Spanish abbreviated date format, e.g. "27 abr — 3 may · 2026" or
    // "27 — 30 abr · 2026" depending on whether the week spans months.
    expect(body.weekRange).toMatch(/(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic).*\d{4}/);
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
    expect(recoveredBody.planets).toHaveLength(14);
    expect(recoveredBody.weekRange).toBeDefined();
    expect(fetchWeeklyTransitsMock).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/transits/experience", () => {
  const clientNow = Date.parse("2026-05-10T14:23:00.000Z");
  const selectedAt = Date.parse("2026-05-10T17:00:00.000Z");
  const baseUrl = `/api/transits/experience?mode=today&timeZone=Etc%2FUTC&clientNow=${clientNow}`;

  it("returns the v2 today contract with the exact selectedAt", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${baseUrl}&selectedAt=${selectedAt}`,
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.version).toBe("transits.v2");
    expect(body.mode).toBe("today");
    expect(body.selectedAt).toBe("2026-05-10T17:00:00.000Z");
    expect(body.range.kind).toBe("today");
    expect(body.snapshots[0].collective.activatedGates).toEqual(expect.any(Array));
    expect(body.snapshots[0].collective.activatedChannels).toEqual(expect.any(Array));
    expect(body.snapshots[0].collective.activatedCenters).toEqual(expect.any(Array));
    expect(body.snapshots[0].collective.temporarilyDefinedCenters).toEqual(expect.any(Array));
    expect(body.snapshots[0].personal).toBeUndefined();
  });

  it("includes 24 hourly snapshots and reuses cached collective hour facts", async () => {
    const url = `${baseUrl}&includeTimeline=true`;
    const first = await app.inject({ method: "GET", url });
    const second = await app.inject({ method: "GET", url });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const firstBody = JSON.parse(first.body);
    const secondBody = JSON.parse(second.body);
    const firstHourly = firstBody.snapshots.filter((snapshot: { id: string }) => snapshot.id.startsWith("hour:"));
    const secondHourly = secondBody.snapshots.filter((snapshot: { id: string }) => snapshot.id.startsWith("hour:"));

    expect(firstHourly).toHaveLength(24);
    expect(firstBody.snapshots).toHaveLength(25);
    expect(secondHourly).toHaveLength(24);
    expect(secondHourly[0].calculatedAt).toBe(firstHourly[0].calculatedAt);
    expect(secondHourly[0].collective).toEqual(firstHourly[0].collective);
  });

  it("recomputes personal facts from users.profile without changing cached collective facts", async () => {
    const subject = "st-transits-v2-profile-replace";
    const userId = await createLinkedTestUser(app, subject, "Transit V2 User", {
      humanDesign: {
        activatedGates: [],
        definedCenters: [],
        undefinedCenters: ["Head", "Ajna", "G", "Throat", "Sacral", "SolarPlexus", "Root", "Heart", "Spleen"],
      },
    });
    const url = `${baseUrl}&includeTimeline=true`;
    const first = await app.inject({
      method: "GET",
      url,
      headers: sessionHeaders(subject),
    });
    const firstBody = JSON.parse(first.body);
    const firstGate = firstBody.snapshots[0].collective.activatedGates[0].gate;

    await updateUserBodygraph(
      userId,
      {
        humanDesign: {
          activatedGates: [{ number: firstGate }],
          definedCenters: [],
          undefinedCenters: ["Head", "Ajna", "G", "Throat", "Sacral", "SolarPlexus", "Root", "Heart", "Spleen"],
        },
      },
      "asset-transit-v2-profile",
    );

    const second = await app.inject({
      method: "GET",
      url,
      headers: sessionHeaders(subject),
    });
    const secondBody = JSON.parse(second.body);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(firstBody.snapshots[0].personal.reinforcedGates).toEqual([]);
    expect(secondBody.snapshots[0].personal.reinforcedGates).toEqual([
      expect.objectContaining({ gate: firstGate }),
    ]);
    expect(secondBody.snapshots.find((snapshot: { id: string }) => snapshot.id.startsWith("hour:")).collective)
      .toEqual(firstBody.snapshots.find((snapshot: { id: string }) => snapshot.id.startsWith("hour:")).collective);
  });

  it("returns collective only for pending linked users", async () => {
    await createLinkedTestUser(
      app,
      "st-transits-v2-pending",
      "Transit Pending User",
      { humanDesign: { activatedGates: [{ number: 55 }], definedCenters: [] } },
      { onboardingStatus: "pending", onboardingStep: "name" },
    );

    const res = await app.inject({
      method: "GET",
      url: baseUrl,
      headers: sessionHeaders("st-transits-v2-pending"),
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.version).toBe("transits.v2");
    expect(body.snapshots[0].collective).toBeDefined();
    expect(body.snapshots[0].personal).toBeUndefined();
  });

  it("keeps activated, conditioned, and temporarily defined centers separate", async () => {
    const subject = "st-transits-v2-centers";
    await createLinkedTestUser(app, subject, "Transit Centers User", {
      humanDesign: {
        activatedGates: [],
        definedCenters: ["Sacral"],
        undefinedCenters: ["Head", "Ajna", "G", "Throat", "SolarPlexus", "Root", "Heart", "Spleen"],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: baseUrl,
      headers: sessionHeaders(subject),
    });
    const snapshot = JSON.parse(res.body).snapshots[0];

    expect(snapshot.collective.activatedCenters).toEqual(expect.any(Array));
    expect(snapshot.collective.temporarilyDefinedCenters).toEqual(expect.any(Array));
    expect(snapshot.personal.conditionedCenters).toEqual(expect.any(Array));
    const activatedIds = new Set(snapshot.collective.activatedCenters.map((center: { id: string }) => center.id));
    const definedIds = new Set(snapshot.collective.temporarilyDefinedCenters.map((center: { id: string }) => center.id));
    expect(snapshot.collective.activatedCenters.length).toBeGreaterThanOrEqual(definedIds.size);
    for (const centerId of definedIds) {
      expect(activatedIds.has(centerId)).toBe(true);
    }
  });

  it("does not report temporarily defined centers as merely conditioned", () => {
    const snapshot: TransitSnapshot = {
      id: "instant:test-channel",
      targetAt: "2026-05-10T14:00:00.000Z",
      calculatedAt: "2026-05-10T14:00:01.000Z",
      label: "Test",
      collective: {
        planets: [
          {
            name: "Venus",
            longitude: 0,
            sign: "Aries",
            degree: 0,
            isRetrograde: false,
            hdGate: 35,
            hdLine: 1,
          },
          {
            name: "Marte",
            longitude: 0,
            sign: "Aries",
            degree: 0,
            isRetrograde: false,
            hdGate: 36,
            hdLine: 1,
          },
        ],
        activatedGates: [
          { gate: 35, lines: [1], planets: ["Venus"], center: "Throat" },
          { gate: 36, lines: [1], planets: ["Marte"], center: "SolarPlexus" },
        ],
        activatedChannels: [
          {
            id: "35-36",
            name: "Canal de lo Transitorio",
            gates: [35, 36],
            centers: ["Throat", "SolarPlexus"],
          },
        ],
        activatedCenters: [
          { id: "Throat", displayName: "Garganta", gates: [35], channels: ["35-36"] },
          { id: "SolarPlexus", displayName: "Plexo Solar", gates: [36], channels: ["35-36"] },
        ],
        temporarilyDefinedCenters: [
          {
            id: "Throat",
            displayName: "Garganta",
            channels: [
              {
                id: "35-36",
                name: "Canal de lo Transitorio",
                gates: [35, 36],
                centers: ["Throat", "SolarPlexus"],
              },
            ],
          },
          {
            id: "SolarPlexus",
            displayName: "Plexo Solar",
            channels: [
              {
                id: "35-36",
                name: "Canal de lo Transitorio",
                gates: [35, 36],
                centers: ["Throat", "SolarPlexus"],
              },
            ],
          },
        ],
      },
    };

    const personal = actualTransitService.analyzeTransitExperienceImpact(
      snapshot,
      { activatedGates: [], definedCenters: [] },
    );

    expect(personal.temporarilyDefinedCenters.map((center) => center.id).sort()).toEqual([
      "SolarPlexus",
      "Throat",
    ]);
    expect(personal.conditionedCenters).toEqual([]);
  });

  it("returns panorama step for next7Days MVP", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/transits/experience?mode=next7Days&timeZone=Etc%2FUTC&clientNow=${clientNow}`,
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.version).toBe("transits.v2");
    expect(body.mode).toBe("next7Days");
    expect(body.range.step).toBe("panorama");
  });

  it("includes 7 daily snapshots in next7Days alongside the panorama snapshot", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/transits/experience?mode=next7Days&timeZone=Etc%2FUTC&clientNow=${clientNow}`,
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(body.snapshots)).toBe(true);
    expect(body.snapshots.length).toBeGreaterThanOrEqual(8);
    const daySnapshots = body.snapshots.filter((s: { id: string }) => s.id.startsWith("day:"));
    expect(daySnapshots).toHaveLength(7);
  });

  it("includes a chronological dayKeyFacts array in next7Days", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/transits/experience?mode=next7Days&timeZone=Etc%2FUTC&clientNow=${clientNow}`,
    });
    const body = JSON.parse(res.body);

    expect(Array.isArray(body.dayKeyFacts)).toBe(true);
    expect(body.dayKeyFacts.length).toBeGreaterThanOrEqual(1);
    expect(body.dayKeyFacts.length).toBeLessThanOrEqual(6);

    const firstFact = body.dayKeyFacts[0];
    expect(firstFact.kind).toBe("today");
    expect(firstFact.dayLabel).toMatch(/^Hoy /);
    expect(typeof firstFact.summary).toBe("string");

    const isoTimestamps = body.dayKeyFacts.map((f: { atTargetIso: string }) => f.atTargetIso);
    const sorted = [...isoTimestamps].sort();
    expect(isoTimestamps).toEqual(sorted);
  });

  it("does not emit dayKeyFacts for the today mode", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/transits/experience?mode=today&timeZone=Etc%2FUTC&clientNow=${clientNow}`,
    });
    const body = JSON.parse(res.body);

    expect(body.dayKeyFacts).toBeUndefined();
  });

  it("validates timeZone and time params", async () => {
    const badTz = await app.inject({
      method: "GET",
      url: `/api/transits/experience?mode=today&timeZone=Nope%2FNowhere&clientNow=${clientNow}`,
    });
    const badTime = await app.inject({
      method: "GET",
      url: "/api/transits/experience?mode=today&timeZone=Etc%2FUTC&clientNow=nope",
    });

    expect(badTz.statusCode).toBe(400);
    expect(JSON.parse(badTz.body).error).toBe("invalid_time_zone");
    expect(badTime.statusCode).toBe(400);
    expect(JSON.parse(badTime.body).error).toBe("invalid_time");
  });
});
