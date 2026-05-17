/**
 * Tests para calculateBodygraph — el cálculo determinístico desde birth data.
 *
 * Validados contra 2 PDFs reales (Agos 1988-12-28 06:13 UTC, Brian
 * 1989-02-18 12:00 UTC). 26/26 gates por persona en el POC manual.
 */
import { describe, expect, it } from "vitest";
import { calculateBodygraph, type BirthData } from "../bodygraph/calculate.js";

function sortGates(g: Array<{ planet: string; isPersonality: boolean; number: number; line: number }>) {
  return [...g].sort((a, b) => {
    if (a.isPersonality !== b.isPersonality) return a.isPersonality ? 1 : -1;
    return a.planet.localeCompare(b.planet);
  });
}

describe("calculateBodygraph", () => {
  describe("ground truth: Agos — UTC 1988-12-28 06:13", () => {
    // The PDF (Genetic Matrix) reads:
    //   Type: Emotional Projector, Profile 4/6, Triple Split,
    //   Authority: Solar Plexus, Channels: 18-58, 37-40, 1-8.
    const AGOS: BirthData = {
      date: "1988-12-28",
      time: "06:13",
      timezoneOffsetHours: 0, // birth time given already in UTC
      name: "Agos",
    };

    it("derives 26 gates that match the PDF", async () => {
      const profile = await calculateBodygraph(AGOS);
      const gates = sortGates(profile.humanDesign.activatedGates);
      // Compact "gate.line" representation for diff readability.
      const compact = gates.map((g) => `[${g.isPersonality ? "P" : "D"}] ${g.planet}: ${g.number}.${g.line}`);
      expect(compact).toEqual([
        "[D] Earth: 17.6",
        "[D] Jupiter: 16.1",
        "[D] Mars: 17.1",
        "[D] Mercury: 50.1",
        "[D] Moon: 12.5",
        "[D] Neptune: 58.4",
        "[D] North Node: 63.3",
        "[D] Pluto: 44.4",
        "[D] Saturn: 11.5",
        "[D] South Node: 64.3",
        "[D] Sun: 18.6",
        "[D] Uranus: 11.6",
        "[D] Venus: 29.3",
        "[P] Earth: 52.4",
        "[P] Jupiter: 8.3",
        "[P] Mars: 51.4",
        "[P] Mercury: 61.1",
        "[P] Moon: 59.6",
        "[P] Neptune: 38.1",
        "[P] North Node: 37.1",
        "[P] Pluto: 1.2",
        "[P] Saturn: 58.2",
        "[P] South Node: 40.1",
        "[P] Sun: 58.4",
        "[P] Uranus: 10.4",
        "[P] Venus: 5.2",
      ]);
    });

    it("derives type, profile, authority, definition from the gates", async () => {
      const profile = await calculateBodygraph(AGOS);
      const hd = profile.humanDesign;
      expect(hd.type).toBe("Proyector");
      expect(hd.profile).toBe("4/6");
      expect(hd.authority).toBe("Emocional (Plexo Solar)");
      expect(hd.definition).toBe("Definición triple dividida");
      // Channels visible in the PDF.
      const channelIds = hd.channels.map((c) => c.id).sort();
      expect(channelIds).toContain("1-8");
      expect(channelIds).toContain("18-58");
      expect(channelIds).toContain("37-40");
    });

    it("fills strategy and notSelfTheme from type via deriveImpliedFields", async () => {
      const profile = await calculateBodygraph(AGOS);
      expect(profile.humanDesign.strategy).toBe("Esperar la invitación");
      expect(profile.humanDesign.notSelfTheme).toBe("Amargura");
    });

    it("populates the new P0 fields (birthData, profileName, typeQualifier, themes, designDate, retrograde)", async () => {
      const profile = await calculateBodygraph({ ...AGOS, placeLabel: "Esquel, Chubut, Argentina" });

      // birthData
      expect(profile.birthData).toBeDefined();
      expect(profile.birthData!.dateLocalIso).toBe("1988-12-28T06:13:00+00:00");
      expect(profile.birthData!.dateUtcIso).toBe("1988-12-28T06:13:00.000Z");
      expect(profile.birthData!.placeLabel).toBe("Esquel, Chubut, Argentina");
      expect(profile.birthData!.timezoneOffsetHours).toBe(0);
      // ageYears at runtime — varies by today's date; just sanity check.
      expect(profile.birthData!.ageYears).toBeGreaterThanOrEqual(30);
      expect(profile.birthData!.ageYears).toBeLessThan(60);

      // HD identity enriched
      expect(profile.humanDesign.typeQualifier).toBe("Emotional");
      expect(profile.humanDesign.profileName).toBe("Opportunistic / Role Model");
      expect(profile.humanDesign.themes).toEqual({ positive: "Success", notSelf: "Amargura" });

      // designDate ~88° before personality (≈ early October 1988).
      expect(profile.humanDesign.design).toBeDefined();
      expect(profile.humanDesign.design!.date).toMatch(/^1988-10-0\dT/);

      // Retrograde flag is populated on every activatedGate.
      const allHaveFlag = profile.humanDesign.activatedGates.every(
        (g) => typeof g.isRetrograde === "boolean",
      );
      expect(allHaveFlag).toBe(true);
      // Sun and Moon never retrograde (geocentric semantics).
      const sunMoon = profile.humanDesign.activatedGates.filter(
        (g) => g.planet === "Sun" || g.planet === "Moon" || g.planet === "Earth",
      );
      for (const g of sunMoon) expect(g.isRetrograde).toBe(false);

      // Anchor specific retrograde values for Agos against Swiss Eph ground truth:
      //   Design moment ~= 1988-10-01 17:14 UTC
      //     Mercury speed = -0.343°/day  → retrograde
      //   Personality moment = 1988-12-28 06:13 UTC
      //     Mercury speed = +1.547°/day  → direct
      // Mercury was in a retro cycle that ended around mid-October 1988.
      const mercuryDesign = profile.humanDesign.activatedGates.find(
        (g) => g.planet === "Mercury" && !g.isPersonality,
      );
      const mercuryPersonality = profile.humanDesign.activatedGates.find(
        (g) => g.planet === "Mercury" && g.isPersonality,
      );
      expect(mercuryDesign?.isRetrograde).toBe(true);
      expect(mercuryPersonality?.isRetrograde).toBe(false);
    });

    it("uses timezone offset in dateLocalIso", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "03:13",
        timezoneOffsetHours: -3,
      });
      expect(profile.birthData!.dateLocalIso).toBe("1988-12-28T03:13:00-03:00");
      expect(profile.birthData!.dateUtcIso).toBe("1988-12-28T06:13:00.000Z");
    });
  });

  describe("ground truth: Brian — UTC 1989-02-18 12:00", () => {
    // Genetic Matrix fixture: Emotional Manifesting Generator, 6/2,
    // Split - Small (6), Solar Plexus.
    const BRIAN: BirthData = {
      date: "1989-02-18",
      time: "12:00",
      timezoneOffsetHours: 0,
      name: "Brian Montero",
    };

    it("derives 26 gates that match the fixture", async () => {
      const profile = await calculateBodygraph(BRIAN);
      const gates = sortGates(profile.humanDesign.activatedGates);
      const compact = gates.map((g) => `[${g.isPersonality ? "P" : "D"}] ${g.planet}: ${g.number}.${g.line}`);
      expect(compact).toEqual([
        "[D] Earth: 20.2",
        "[D] Jupiter: 20.1",
        "[D] Mars: 17.1",
        "[D] Mercury: 14.4",
        "[D] Moon: 20.5",
        "[D] Neptune: 58.5",
        "[D] North Node: 37.5",
        "[D] Pluto: 1.1",
        "[D] Saturn: 10.4",
        "[D] South Node: 40.5",
        "[D] Sun: 34.2",
        "[D] Uranus: 10.2",
        "[D] Venus: 50.5",
        "[P] Earth: 29.6",
        "[P] Jupiter: 8.4",
        "[P] Mars: 2.5",
        "[P] Mercury: 41.2",
        "[P] Moon: 31.5",
        "[P] Neptune: 38.3",
        "[P] North Node: 55.6",
        "[P] Pluto: 1.3",
        "[P] Saturn: 38.2",
        "[P] South Node: 59.6",
        "[P] Sun: 30.6",
        "[P] Uranus: 58.1",
        "[P] Venus: 13.6",
      ]);
    });

    it("derives Generador Manifestante 6/2 Emocional", async () => {
      const profile = await calculateBodygraph(BRIAN);
      const hd = profile.humanDesign;
      expect(hd.type).toBe("Generador Manifestante");
      expect(hd.profile).toBe("6/2");
      expect(hd.authority).toBe("Emocional (Plexo Solar)");
      expect(hd.strategy).toBe("Esperar para responder y luego informar");
      expect(hd.notSelfTheme).toBe("Frustración");
    });

    it("populates the new P0 fields for Brian", async () => {
      const profile = await calculateBodygraph(BRIAN);
      expect(profile.humanDesign.typeQualifier).toBe("Emotional");
      expect(profile.humanDesign.profileName).toBe("Role Model / Hermit");
      expect(profile.humanDesign.themes).toEqual({ positive: "Satisfaction", notSelf: "Frustración" });
      expect(profile.humanDesign.design!.date).toMatch(/^1988-11-2\dT/);
    });
  });

  describe("P2 — tone (subdivisión line/6) en activatedGates", () => {
    it("populates a valid tone [1..6] on every activated gate for Agos", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      for (const g of profile.humanDesign.activatedGates) {
        expect(typeof g.tone).toBe("number");
        expect(g.tone).toBeGreaterThanOrEqual(1);
        expect(g.tone).toBeLessThanOrEqual(6);
      }
    });

    it("is deterministic across timezone equivalence", async () => {
      // Same absolute moment, two different (date,time,tz) inputs.
      const utc = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      const localMinus3 = await calculateBodygraph({
        date: "1988-12-28",
        time: "03:13",
        timezoneOffsetHours: -3,
      });
      // All activatedGates have identical (gate, line, tone) — same moment.
      const key = (g: { number: number; line: number; tone?: number; planet: string; isPersonality: boolean }) =>
        `${g.planet}-${g.isPersonality ? "P" : "D"}`;
      const byKey = new Map(localMinus3.humanDesign.activatedGates.map((g) => [key(g), g]));
      for (const g of utc.humanDesign.activatedGates) {
        const other = byKey.get(key(g));
        expect(other?.tone).toBe(g.tone);
      }
    });
  });

  describe("timezone handling", () => {
    it("converts local time to UTC using the offset", async () => {
      const localUtcMinus3: BirthData = {
        date: "1988-12-28",
        time: "03:13",
        timezoneOffsetHours: -3,
      };
      const localUtc: BirthData = {
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      };
      const a = await calculateBodygraph(localUtcMinus3);
      const b = await calculateBodygraph(localUtc);
      // Same moment in absolute time → same bodygraph.
      expect(a.humanDesign.activatedGates).toEqual(b.humanDesign.activatedGates);
    });
  });
});
