/**
 * Transit Impact Analysis — Deterministic tests
 *
 * analyzeTransitImpact() is a pure function: given transits + user profile,
 * it returns the same impact every time. No LLM, no network.
 */

import { describe, it, expect } from "vitest";
import { analyzeTransitImpact, type WeeklyTransits, type UserHDProfile } from "../transit-service.js";

// Helper: create minimal transit data
function makeTransits(planets: Array<{ name: string; hdGate: number }>): WeeklyTransits {
  return {
    fetchedAt: new Date().toISOString(),
    weekRange: "test week",
    planets: planets.map((p) => ({
      name: p.name,
      longitude: 0,
      sign: "Aries",
      degree: 0,
      isRetrograde: false,
      hdGate: p.hdGate,
      hdLine: 1,
    })),
    activatedChannels: [],
  };
}

// User profile: gates 37, 40, 55 defined; centers G, Throat, Sacral, SolarPlexus, Root, Heart defined
const testProfile: UserHDProfile = {
  activatedGates: [
    { number: 37 }, { number: 40 }, // Canal de la Comunidad
    { number: 55 },                 // Half of Canal de la Emoción (39-55)
    { number: 1 }, { number: 8 },   // Canal de Inspiración
  ],
  definedCenters: ["G", "Throat", "Sacral", "SolarPlexus", "Root", "Heart"],
};

describe("analyzeTransitImpact", () => {
  it("detects reinforced gates when transit hits user's gate", () => {
    const transits = makeTransits([
      { name: "Marte", hdGate: 55 },
      { name: "Sol", hdGate: 22 }, // user does NOT have gate 22
    ]);

    const impact = analyzeTransitImpact(transits, testProfile);

    expect(impact.reinforcedGates).toContainEqual({ gate: 55, planet: "Marte" });
    expect(impact.reinforcedGates.find((r) => r.gate === 22)).toBeUndefined();
  });

  it("detects personal channels (user has one gate, transit has the other)", () => {
    // User has gate 55, transit puts planet on gate 39 → Canal de la Emoción (39-55)
    const transits = makeTransits([
      { name: "Júpiter", hdGate: 39 },
    ]);

    const impact = analyzeTransitImpact(transits, testProfile);

    expect(impact.personalChannels).toHaveLength(1);
    expect(impact.personalChannels[0]).toMatchObject({
      channelName: "Canal de la Emoción",
      userGate: 55,
      transitGate: 39,
      transitPlanet: "Júpiter",
    });
  });

  it("does NOT detect personal channel when user has both gates", () => {
    // User has both 37 and 40 — transit on 40 is reinforcement, not personal channel
    const transits = makeTransits([
      { name: "Luna", hdGate: 40 },
    ]);

    const impact = analyzeTransitImpact(transits, testProfile);

    expect(impact.personalChannels).toHaveLength(0);
    expect(impact.reinforcedGates).toContainEqual({ gate: 40, planet: "Luna" });
  });

  it("detects conditioned centers (transit activates undefined center)", () => {
    // Gate 63 is in Head center — Head is undefined for our test user
    const transits = makeTransits([
      { name: "Mercurio", hdGate: 63 },
    ]);

    const impact = analyzeTransitImpact(transits, testProfile);

    expect(impact.conditionedCenters).toHaveLength(1);
    expect(impact.conditionedCenters[0].center).toBe("Head");
    expect(impact.conditionedCenters[0].gates).toContainEqual({ gate: 63, planet: "Mercurio" });
  });

  it("does NOT condition a defined center", () => {
    // Gate 22 is in SolarPlexus — which is defined for our user
    const transits = makeTransits([
      { name: "Sol", hdGate: 22 },
    ]);

    const impact = analyzeTransitImpact(transits, testProfile);

    const solarPlexus = impact.conditionedCenters.find((c) => c.center === "SolarPlexus");
    expect(solarPlexus).toBeUndefined();
  });

  it("detects educational channels (neither gate in user, both in transit)", () => {
    // User has neither gate 12 nor 22. Both in transit → Canal de la Apertura
    const transits = makeTransits([
      { name: "Sol", hdGate: 22 },
      { name: "Venus", hdGate: 12 },
    ]);

    const impact = analyzeTransitImpact(transits, testProfile);

    expect(impact.educationalChannels).toContainEqual(
      expect.objectContaining({ channelName: "Canal de la Apertura" }),
    );
  });

  it("returns empty impact when transits touch no user gates", () => {
    const transits = makeTransits([
      { name: "Sol", hdGate: 64 }, // user doesn't have 64
    ]);

    const impact = analyzeTransitImpact(transits, testProfile);

    expect(impact.reinforcedGates).toHaveLength(0);
    expect(impact.personalChannels).toHaveLength(0);
  });

  it("handles multiple planets on same gate", () => {
    const transits = makeTransits([
      { name: "Sol", hdGate: 55 },
      { name: "Marte", hdGate: 55 },
    ]);

    const impact = analyzeTransitImpact(transits, testProfile);

    expect(impact.reinforcedGates).toHaveLength(2);
    expect(impact.reinforcedGates.map((r) => r.planet)).toContain("Sol");
    expect(impact.reinforcedGates.map((r) => r.planet)).toContain("Marte");
  });

  it("handles empty user profile gracefully", () => {
    const transits = makeTransits([
      { name: "Sol", hdGate: 22 },
    ]);
    const emptyProfile: UserHDProfile = { activatedGates: [], definedCenters: [] };

    const impact = analyzeTransitImpact(transits, emptyProfile);

    expect(impact.reinforcedGates).toHaveLength(0);
    expect(impact.personalChannels).toHaveLength(0);
    // All centers are undefined, so conditioning should apply
    expect(impact.conditionedCenters.length).toBeGreaterThan(0);
  });
});
