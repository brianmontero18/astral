/**
 * Transit Service — astronomical and HD-impact tests.
 *
 * Two layers:
 *   1. Pure function tests (analyzeTransitImpact, analyzeTransitExperienceImpact):
 *      no Swiss Ephemeris, no I/O. Validate HD semantics.
 *   2. Integration tests (calculatePlanetTransits): run real Swiss Ephemeris
 *      against a fixed UTC instant and verify the canonical 14-body shape,
 *      Earth = Sun + 180°, TRUE_NODE-derived South Node, and gate/line bounds.
 */

import { describe, it, expect } from "vitest";
import {
  analyzeTransitImpact,
  analyzeTransitExperienceImpact,
  fetchWeeklyTransits,
  type PlanetTransit,
  type TransitSnapshot,
  type UserHDProfile,
  type WeeklyTransits,
} from "../transit-service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planet(
  name: string,
  hdGate: number,
  hdLine: number,
  overrides: Partial<PlanetTransit> = {},
): PlanetTransit {
  return {
    name,
    longitude: 0,
    sign: "Aries",
    degree: 0,
    isRetrograde: false,
    hdGate,
    hdLine,
    ...overrides,
  };
}

function weeklyTransits(planets: PlanetTransit[], activatedChannels: string[] = []): WeeklyTransits {
  return {
    fetchedAt: new Date().toISOString(),
    weekRange: "test-range",
    planets,
    activatedChannels,
  };
}

function snapshot(planets: PlanetTransit[]): TransitSnapshot {
  return {
    id: "instant:test",
    targetAt: new Date().toISOString(),
    calculatedAt: new Date().toISOString(),
    label: "Test",
    collective: {
      planets,
      activatedGates: [],
      activatedChannels: [],
      activatedCenters: [
        // Stubbed to validate the no-filter behaviour in analyzeTransitExperienceImpact.
        { id: "Throat", displayName: "Garganta", gates: [35], channels: [] },
        { id: "Sacral", displayName: "Sacral", gates: [34], channels: [] },
      ],
      temporarilyDefinedCenters: [],
    },
  };
}

// ─── analyzeTransitImpact: HD semantic checks ─────────────────────────────────

describe("analyzeTransitImpact — channels and gates", () => {
  it("detects a personal channel when user has one gate and transit has the other", () => {
    const transits = weeklyTransits([
      planet("Marte", 36, 3),
    ]);
    const profile: UserHDProfile = {
      activatedGates: [{ number: 35 }],
      definedCenters: ["Throat"],
    };

    const result = analyzeTransitImpact(transits, profile);

    expect(result.personalChannels).toHaveLength(1);
    expect(result.personalChannels[0]).toMatchObject({
      channelId: "35-36",
      userGate: 35,
      transitGate: 36,
      transitPlanet: "Marte",
    });
  });

  it("detects an educational channel when neither gate is in the user but both are in transit", () => {
    const transits = weeklyTransits([
      planet("Sol", 35, 2),
      planet("Marte", 36, 3),
    ]);
    const profile: UserHDProfile = {
      activatedGates: [],
      definedCenters: [],
    };

    const result = analyzeTransitImpact(transits, profile);

    expect(result.educationalChannels).toHaveLength(1);
    expect(result.educationalChannels[0]).toMatchObject({
      channelId: "35-36",
      planet1: "Sol",
      planet2: "Marte",
    });
    expect(result.personalChannels).toHaveLength(0);
  });

  it("emits reinforcedGates only for user gates NOT already explained by a personal channel", () => {
    // User has gates 35 AND 60. Transit activates:
    //   - 36 (completes channel 35-36 with user's 35) → personal channel
    //   - 35 (same gate user has, but used inside the personal channel above)
    //   - 3  (completes channel 3-60 with user's 60) → personal channel
    //   - 60 (same gate user has)
    //   - 17 (user has this gate; not part of any completing channel)
    const transits = weeklyTransits([
      planet("Marte", 36, 3),
      planet("Saturno", 35, 2),
      planet("Júpiter", 3, 1),
      planet("Plutón", 60, 5),
      planet("Mercurio", 17, 4),
    ]);
    const profile: UserHDProfile = {
      activatedGates: [{ number: 35 }, { number: 60 }, { number: 17 }],
      definedCenters: ["Throat", "Sacral"],
    };

    const result = analyzeTransitImpact(transits, profile);

    expect(result.personalChannels.map((c) => c.userGate)).toEqual(expect.arrayContaining([35, 60]));
    const reinforcedGateNumbers = result.reinforcedGates.map((g) => g.gate);
    expect(reinforcedGateNumbers).not.toContain(35);
    expect(reinforcedGateNumbers).not.toContain(60);
    expect(reinforcedGateNumbers).toContain(17);
  });

  it("does not emit a reinforcedGate for an isolated gate that is not the user's", () => {
    const transits = weeklyTransits([planet("Sol", 22, 1)]);
    const profile: UserHDProfile = {
      activatedGates: [{ number: 35 }],
      definedCenters: [],
    };

    const result = analyzeTransitImpact(transits, profile);

    expect(result.reinforcedGates).toHaveLength(0);
  });

  it("marks a center as conditioned only when it is undefined in the user", () => {
    // User has Sacral defined; Throat undefined. Transit hits gates in both.
    const transits = weeklyTransits([
      planet("Sol", 23, 2),     // Throat (undefined in user → conditioned)
      planet("Marte", 34, 5),   // Sacral (defined in user → NOT conditioned)
    ]);
    const profile: UserHDProfile = {
      activatedGates: [{ number: 5 }],
      definedCenters: ["Sacral"],
    };

    const result = analyzeTransitImpact(transits, profile);

    const conditionedCenters = result.conditionedCenters.map((c) => c.center);
    expect(conditionedCenters).toContain("Throat");
    expect(conditionedCenters).not.toContain("Sacral");
  });

  it("skips conditionedCenters for gates the user already has (those are reinforced, not conditioning)", () => {
    const transits = weeklyTransits([planet("Sol", 17, 2)]);
    const profile: UserHDProfile = {
      activatedGates: [{ number: 17 }],
      definedCenters: [],  // Ajna undefined but user already has gate 17
    };

    const result = analyzeTransitImpact(transits, profile);

    expect(result.conditionedCenters.map((c) => c.center)).not.toContain("Ajna");
    expect(result.reinforcedGates.map((g) => g.gate)).toContain(17);
  });
});

// ─── analyzeTransitExperienceImpact: experience-level semantics ───────────────

describe("analyzeTransitExperienceImpact — ADR semantics", () => {
  it("returns activatedCenters from the collective snapshot WITHOUT filtering by user definition", () => {
    // ADR: "centro activado por tránsito = al menos una puerta del centro activada".
    // The user's defined centers should NOT filter this set.
    const userProfile: UserHDProfile = {
      activatedGates: [],
      definedCenters: [],  // user has no defined centers
    };

    const result = analyzeTransitExperienceImpact(snapshot([]), userProfile);

    // Both stub centers (Throat, Sacral) should pass through even though the user has none defined.
    expect(result.activatedCenters.map((c) => c.id)).toEqual(
      expect.arrayContaining(["Throat", "Sacral"]),
    );
  });

  it("excludes temporarily-defined centers from conditionedCenters (precedence)", () => {
    // Personal channel 35-36 completes through user's gate 35; this temp-defines Throat.
    // The Throat must not also appear as "conditioned" — temp-defined wins.
    const userProfile: UserHDProfile = {
      activatedGates: [{ number: 35 }],
      definedCenters: [],  // Throat undefined permanently
    };
    const snap = snapshot([planet("Marte", 36, 3)]);

    const result = analyzeTransitExperienceImpact(snap, userProfile);

    const tempDefinedIds = result.temporarilyDefinedCenters.map((c) => c.id);
    const conditionedCenters = result.conditionedCenters.map((c) => c.center);

    expect(tempDefinedIds).toContain("Throat");
    expect(conditionedCenters).not.toContain("Throat");
  });

  it("returns reinforcedCenters as the user's defined centers that the collective is currently touching", () => {
    // Distinct from activatedCenters (no user filter), reinforcedCenters
    // intersects activatedCenters with the user's permanently-defined set.
    const userProfile: UserHDProfile = {
      activatedGates: [],
      definedCenters: ["Throat"],  // Sacral undefined for this user
    };

    const result = analyzeTransitExperienceImpact(snapshot([]), userProfile);

    // Snapshot stub activates Throat + Sacral collectively.
    expect(result.activatedCenters.map((c) => c.id)).toEqual(
      expect.arrayContaining(["Throat", "Sacral"]),
    );
    // reinforcedCenters keeps only the centers the user actually has defined.
    expect(result.reinforcedCenters.map((c) => c.id)).toEqual(["Throat"]);
  });

  it("returns an empty reinforcedCenters when the user has no defined centers", () => {
    const userProfile: UserHDProfile = {
      activatedGates: [],
      definedCenters: [],
    };

    const result = analyzeTransitExperienceImpact(snapshot([]), userProfile);

    expect(result.reinforcedCenters).toEqual([]);
    // activatedCenters keeps its full pass-through (ADR semantics).
    expect(result.activatedCenters.length).toBeGreaterThan(0);
  });

  it("normalizes the center field on reinforced gates", () => {
    const userProfile: UserHDProfile = {
      activatedGates: [{ number: 17 }],
      definedCenters: ["Ajna"],
    };
    const snap = snapshot([planet("Sol", 17, 2)]);

    const result = analyzeTransitExperienceImpact(snap, userProfile);

    // Gate 17 belongs to Ajna; the center in reinforcedGates must match the
    // canonical English id, not raw lookup output.
    expect(result.reinforcedGates.find((g) => g.gate === 17)?.center).toBe("Ajna");
  });
});

// ─── Integration: Swiss Ephemeris real calculation ────────────────────────────

describe("fetchWeeklyTransits / Swiss Ephemeris integration", () => {
  it("returns exactly 14 canonical HD bodies including Tierra", async () => {
    const data = await fetchWeeklyTransits();
    const names = data.planets.map((p) => p.name);

    expect(data.planets).toHaveLength(14);
    expect(names).toEqual(
      expect.arrayContaining([
        "Sol", "Tierra", "Luna",
        "Mercurio", "Venus", "Marte",
        "Júpiter", "Saturno", "Urano",
        "Neptuno", "Plutón", "Quirón",
        "Nodo Norte", "Nodo Sur",
      ]),
    );
  }, 30_000);

  it("places Tierra exactly 180° away from the Sun", async () => {
    const data = await fetchWeeklyTransits();
    const sun = data.planets.find((p) => p.name === "Sol")!;
    const earth = data.planets.find((p) => p.name === "Tierra")!;

    expect(sun).toBeDefined();
    expect(earth).toBeDefined();

    const diff = Math.abs(earth.longitude - sun.longitude);
    const normalizedDiff = Math.abs(180 - (diff % 360));
    // Allow a 0.0001° tolerance for floating point.
    expect(normalizedDiff).toBeLessThan(0.0001);
  }, 30_000);

  it("places Nodo Sur exactly 180° away from Nodo Norte", async () => {
    const data = await fetchWeeklyTransits();
    const north = data.planets.find((p) => p.name === "Nodo Norte")!;
    const south = data.planets.find((p) => p.name === "Nodo Sur")!;

    expect(north).toBeDefined();
    expect(south).toBeDefined();

    const diff = Math.abs(south.longitude - north.longitude);
    const normalizedDiff = Math.abs(180 - (diff % 360));
    expect(normalizedDiff).toBeLessThan(0.0001);
  }, 30_000);

  it("derives Tierra and Nodo Sur with valid gate (1-64) and line (1-6)", async () => {
    const data = await fetchWeeklyTransits();
    const derived = ["Tierra", "Nodo Sur"];

    for (const name of derived) {
      const body = data.planets.find((p) => p.name === name);
      expect(body, `Missing derived body: ${name}`).toBeDefined();
      expect(body!.hdGate).toBeGreaterThanOrEqual(1);
      expect(body!.hdGate).toBeLessThanOrEqual(64);
      expect(body!.hdLine).toBeGreaterThanOrEqual(1);
      expect(body!.hdLine).toBeLessThanOrEqual(6);
    }
  }, 30_000);

  it("never reports Tierra as retrograde (geocentric definition)", async () => {
    const data = await fetchWeeklyTransits();
    const earth = data.planets.find((p) => p.name === "Tierra")!;
    expect(earth.isRetrograde).toBe(false);
  }, 30_000);

  it("returns each body's longitude in 0..360 range with sign+degree split", async () => {
    const data = await fetchWeeklyTransits();
    const VALID_SIGNS = new Set([
      "Aries", "Tauro", "Géminis", "Cáncer",
      "Leo", "Virgo", "Libra", "Escorpio",
      "Sagitario", "Capricornio", "Acuario", "Piscis",
    ]);
    for (const body of data.planets) {
      expect(body.longitude).toBeGreaterThanOrEqual(0);
      expect(body.longitude).toBeLessThan(360);
      expect(VALID_SIGNS.has(body.sign), `${body.name}: invalid sign ${body.sign}`).toBe(true);
      expect(body.degree).toBeGreaterThanOrEqual(0);
      expect(body.degree).toBeLessThan(30);
      expect(body.hdGate).toBeGreaterThanOrEqual(1);
      expect(body.hdGate).toBeLessThanOrEqual(64);
      expect(body.hdLine).toBeGreaterThanOrEqual(1);
      expect(body.hdLine).toBeLessThanOrEqual(6);
    }
  }, 30_000);
});
