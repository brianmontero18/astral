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
      expect(profile.humanDesign.typeQualifier).toBe("Emocional");
      expect(profile.humanDesign.profileName).toBe("Oportunista / Modelo a Seguir");
      expect(profile.humanDesign.themes).toEqual({ positive: "Éxito", notSelf: "Amargura" });
      expect(profile.humanDesign.incarnationCross).toBe("RAX Service 4");

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
      expect(profile.humanDesign.typeQualifier).toBe("Emocional");
      expect(profile.humanDesign.profileName).toBe("Modelo a Seguir / Ermitaño");
      expect(profile.humanDesign.themes).toEqual({ positive: "Satisfacción", notSelf: "Frustración" });
      expect(profile.humanDesign.design!.date).toMatch(/^1988-11-2\dT/);
    });

    it("derives Brian's incarnation cross from Personality.Sun=30 + 6/2 profile", async () => {
      // 6/2 → "left" angle; (30, left) → "LAX Industry 1" per Genetic Matrix.
      // Validated against Foundation Chart de Brian (Genetic Matrix).
      const profile = await calculateBodygraph(BRIAN);
      expect(profile.humanDesign.incarnationCross).toBe("LAX Industry 1");
    });
  });

  describe("P1 — Fixing state per planet/gate/line (astral-13j)", () => {
    it("populates fixingState on every activated gate (boolean-tri shape)", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      for (const g of profile.humanDesign.activatedGates) {
        // Either "exalted", "detriment", or null — never undefined or other.
        expect(g.fixingState === "exalted" || g.fixingState === "detriment" || g.fixingState === null).toBe(true);
      }
    });

    it("matches the SharpAstrology canon for Agos's 6 verified entries", async () => {
      // 6 fixings cross-checked against image #13 (Foundation Chart de Agos)
      // AND the SharpAstrology Utility/HumanDesignUtility.cs table. Other two
      // ambiguous markers from the image (P Sun 58.4, P Mercury 61.1) NOT
      // included — they may have been a misread of small markers in the image.
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      const find = (planet: string, isP: boolean) =>
        profile.humanDesign.activatedGates.find(
          (g) => g.planet === planet && g.isPersonality === isP,
        );
      // Personality side
      expect(find("Venus", true)?.fixingState).toBe("exalted");      // 5.2
      expect(find("Uranus", true)?.fixingState).toBe("exalted");     // 10.4
      expect(find("Neptune", true)?.fixingState).toBe("exalted");    // 38.1
      // Design side
      expect(find("Mars", false)?.fixingState).toBe("exalted");      // 17.1
      expect(find("Neptune", false)?.fixingState).toBe("detriment"); // 58.4
      expect(find("Pluto", false)?.fixingState).toBe("exalted");     // 44.4
    });

    it("returns null for planet/gate/line combos that have no canonical fixing", async () => {
      const profile = await calculateBodygraph({
        date: "1989-02-18",
        time: "12:00",
        timezoneOffsetHours: 0,
      });
      // Most positions have no fixing — sanity that at least SOME are null.
      const nullCount = profile.humanDesign.activatedGates.filter(
        (g) => g.fixingState === null,
      ).length;
      expect(nullCount).toBeGreaterThan(0);
    });
  });

  describe("P2 — Variable Wheel canonical (4 vars × 4 props)", () => {
    it("populates the 4 Variables for Agos from Sun & NorthNode activations", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
        name: "Agos",
      });
      const vars = profile.humanDesign.variables;
      expect(vars).toBeDefined();
      // All 4 variables present with the canonical shape.
      for (const key of ["digestion", "awareness", "environment", "perspective"] as const) {
        const v = vars![key];
        expect(v).toBeDefined();
        expect(v.orientation).toMatch(/^(left|right)$/);
        expect(v.color).toBeGreaterThanOrEqual(1);
        expect(v.color).toBeLessThanOrEqual(6);
        expect(v.tone).toBeGreaterThanOrEqual(1);
        expect(v.tone).toBeLessThanOrEqual(6);
        expect(v.base).toBeGreaterThanOrEqual(1);
        expect(v.base).toBeLessThanOrEqual(5);
      }
    });

    it("uses Tone.ToOrientation: 1-3 left, 4-6 right (per SharpAstrology canon)", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      const vars = profile.humanDesign.variables!;
      for (const v of [vars.digestion, vars.awareness, vars.environment, vars.perspective]) {
        if (v.tone <= 3) expect(v.orientation).toBe("left");
        else expect(v.orientation).toBe("right");
      }
    });

    it("sources Variables from the canonical planet/side pairs", async () => {
      // Per SharpAstrology HumanDesignChart._Variables():
      //   Digestion   = Design.Sun
      //   Awareness   = Personality.Sun
      //   Environment = Design.NorthNode
      //   Perspective = Personality.NorthNode
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      const vars = profile.humanDesign.variables!;
      const dSun = profile.humanDesign.activatedGates.find(
        (g) => g.planet === "Sun" && !g.isPersonality,
      );
      const pSun = profile.humanDesign.activatedGates.find(
        (g) => g.planet === "Sun" && g.isPersonality,
      );
      const dNode = profile.humanDesign.activatedGates.find(
        (g) => g.planet === "North Node" && !g.isPersonality,
      );
      const pNode = profile.humanDesign.activatedGates.find(
        (g) => g.planet === "North Node" && g.isPersonality,
      );
      expect(vars.digestion.color).toBe(dSun!.color);
      expect(vars.digestion.tone).toBe(dSun!.tone);
      expect(vars.digestion.base).toBe(dSun!.base);
      expect(vars.awareness.color).toBe(pSun!.color);
      expect(vars.environment.color).toBe(dNode!.color);
      expect(vars.perspective.color).toBe(pNode!.color);
    });
  });

  describe("P2 — color / tone / base subdivisiones HD en activatedGates", () => {
    it("populates valid color/tone/base on every activated gate for Agos", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      for (const g of profile.humanDesign.activatedGates) {
        expect(g.color).toBeGreaterThanOrEqual(1);
        expect(g.color).toBeLessThanOrEqual(6);
        expect(g.tone).toBeGreaterThanOrEqual(1);
        expect(g.tone).toBeLessThanOrEqual(6);
        expect(g.base).toBeGreaterThanOrEqual(1);
        expect(g.base).toBeLessThanOrEqual(5);
      }
    });

    it("is deterministic across timezone equivalence", async () => {
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
      const key = (g: { planet: string; isPersonality: boolean }) =>
        `${g.planet}-${g.isPersonality ? "P" : "D"}`;
      const byKey = new Map(localMinus3.humanDesign.activatedGates.map((g) => [key(g), g]));
      for (const g of utc.humanDesign.activatedGates) {
        const other = byKey.get(key(g));
        expect(other?.color).toBe(g.color);
        expect(other?.tone).toBe(g.tone);
        expect(other?.base).toBe(g.base);
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

  describe("DST-aware path via coordinates (geo-tz + luxon)", () => {
    describe("Agos — 1988-12-28 04:13 local Esquel (Chubut, AR)", () => {
      // Argentina DST 1988 verano activo → offset histórico -2. UTC = 06:13.
      const AGOS_COORDS: BirthData = {
        date: "1988-12-28",
        time: "04:13",
        coordinates: { lat: -42.9135, lon: -71.3217 },
        placeLabel: "Esquel, Chubut, Argentina",
        name: "Agos",
      };

      it("derives the same 26 gates as the UTC=06:13 fixture", async () => {
        const fromCoords = await calculateBodygraph(AGOS_COORDS);
        const fromUtc = await calculateBodygraph({
          date: "1988-12-28",
          time: "06:13",
          timezoneOffsetHours: 0,
          name: "Agos",
        });
        expect(fromCoords.humanDesign.activatedGates).toEqual(
          fromUtc.humanDesign.activatedGates,
        );
      });

      it("resolves the historical DST offset to -2", async () => {
        const profile = await calculateBodygraph(AGOS_COORDS);
        expect(profile.birthData!.timezoneOffsetHours).toBe(-2);
      });

      it("records the resolved coordinates in birthData", async () => {
        const profile = await calculateBodygraph(AGOS_COORDS);
        expect(profile.birthData!.coordinates).toEqual({ lat: -42.9135, lon: -71.3217 });
        expect(profile.birthData!.placeLabel).toBe("Esquel, Chubut, Argentina");
      });
    });

    describe("Brian — 1989-02-18 08:00 local Punta Cardón (Falcón, VE)", () => {
      // Venezuela 1989 sin DST → offset histórico -4. UTC = 12:00.
      const BRIAN_COORDS: BirthData = {
        date: "1989-02-18",
        time: "08:00",
        coordinates: { lat: 11.6757, lon: -70.2197 },
        name: "Brian Montero",
      };

      it("derives the same 26 gates as the UTC=12:00 fixture", async () => {
        const fromCoords = await calculateBodygraph(BRIAN_COORDS);
        const fromUtc = await calculateBodygraph({
          date: "1989-02-18",
          time: "12:00",
          timezoneOffsetHours: 0,
        });
        expect(fromCoords.humanDesign.activatedGates).toEqual(
          fromUtc.humanDesign.activatedGates,
        );
      });

      it("resolves Venezuela 1989 offset to -4", async () => {
        const profile = await calculateBodygraph(BRIAN_COORDS);
        expect(profile.birthData!.timezoneOffsetHours).toBe(-4);
      });
    });

    describe("Venezuela huso history (2007 / 2016)", () => {
      // Caracas coordinates. Venezuela cambió a UTC-4:30 el 2007-12-09 y volvió
      // a UTC-4 el 2016-05-01. Validamos que la tzdb captura el switch.
      const CARACAS = { lat: 10.4806, lon: -66.9036 };

      it("applies offset -4 pre-2007", async () => {
        const profile = await calculateBodygraph({
          date: "2000-06-15",
          time: "12:00",
          coordinates: CARACAS,
        });
        expect(profile.birthData!.timezoneOffsetHours).toBe(-4);
      });

      it("applies offset -4.5 during Chávez period (2007–2016)", async () => {
        const profile = await calculateBodygraph({
          date: "2010-06-15",
          time: "12:00",
          coordinates: CARACAS,
        });
        expect(profile.birthData!.timezoneOffsetHours).toBe(-4.5);
      });

      it("applies offset -4 again post-2016 (Maduro reverted)", async () => {
        const profile = await calculateBodygraph({
          date: "2020-06-15",
          time: "12:00",
          coordinates: CARACAS,
        });
        expect(profile.birthData!.timezoneOffsetHours).toBe(-4);
      });
    });

    describe("Argentina DST repealed in 2000", () => {
      // Buenos Aires coords. Validamos que luxon respeta la derogación DST.
      const BS_AS = { lat: -34.6037, lon: -58.3816 };

      it("applies standard offset -3 in 2010 (post-DST repeal)", async () => {
        const profile = await calculateBodygraph({
          date: "2010-06-15",
          time: "12:00",
          coordinates: BS_AS,
        });
        expect(profile.birthData!.timezoneOffsetHours).toBe(-3);
      });
    });

    describe("validation", () => {
      it("throws when neither coordinates nor timezoneOffsetHours are provided", async () => {
        await expect(
          calculateBodygraph({ date: "1988-12-28", time: "06:13" } as BirthData),
        ).rejects.toThrow(/coordinates or timezoneOffsetHours/);
      });

      it("throws on out-of-range coordinates", async () => {
        await expect(
          calculateBodygraph({
            date: "1988-12-28",
            time: "06:13",
            coordinates: { lat: 999, lon: 999 },
          }),
        ).rejects.toThrow();
      });

      it("prefers coordinates over legacy timezoneOffsetHours when both are provided", async () => {
        // Brian-en-VE: legacy con offset incorrecto (0) Y coordinates correctas.
        // Coordinates ganan → resuelve a -4 y produce el bodygraph correcto.
        const fromBoth = await calculateBodygraph({
          date: "1989-02-18",
          time: "08:00",
          timezoneOffsetHours: 0, // intentionally wrong, should be ignored
          coordinates: { lat: 11.6757, lon: -70.2197 },
        });
        const fromUtcOnly = await calculateBodygraph({
          date: "1989-02-18",
          time: "12:00",
          timezoneOffsetHours: 0,
        });
        expect(fromBoth.humanDesign.activatedGates).toEqual(
          fromUtcOnly.humanDesign.activatedGates,
        );
      });
    });
  });
});
