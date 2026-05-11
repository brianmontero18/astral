import { describe, expect, it } from "vitest";

import { buildTransitScreenModel } from "../../../frontend/src/transits/adapter";
import type { TransitExperienceResponse, TransitSnapshot } from "../../../frontend/src/transits/types";

function buildExperience(overrides: Partial<TransitExperienceResponse> = {}): TransitExperienceResponse {
  const base: TransitExperienceResponse = {
    version: "transits.v2",
    mode: "today",
    timeZone: "Etc/UTC",
    generatedAt: "2026-05-10T14:24:00.000Z",
    selectedAt: "2026-05-10T14:23:00.000Z",
    range: {
      kind: "today",
      label: "Hoy",
      startsAt: "2026-05-10T00:00:00.000Z",
      endsAt: "2026-05-10T23:59:59.999Z",
      step: "hour",
    },
    selectedSnapshotId: "instant:2026-05-10T14:23:00.000Z",
    snapshots: [
      {
        id: "instant:2026-05-10T14:23:00.000Z",
        targetAt: "2026-05-10T14:23:00.000Z",
        calculatedAt: "2026-05-10T14:24:00.000Z",
        label: "Ahora",
        collective: {
          planets: [
            {
              name: "Sol",
              longitude: 12,
              sign: "Tauro",
              degree: 2,
              isRetrograde: false,
              hdGate: 35,
              hdLine: 2,
            },
            {
              name: "Marte",
              longitude: 18,
              sign: "Tauro",
              degree: 8,
              isRetrograde: false,
              hdGate: 36,
              hdLine: 3,
            },
          ],
          activatedGates: [
            { gate: 35, lines: [2], planets: ["Sol"], center: "Throat" },
            { gate: 36, lines: [3], planets: ["Marte"], center: "SolarPlexus" },
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
            { id: "Throat", displayName: "Garganta", gates: [35], channels: [] },
            { id: "SolarPlexus", displayName: "Plexo Solar", gates: [36], channels: [] },
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
          ],
        },
        personal: {
          reinforcedGates: [{ gate: 35, planet: "Sol", center: "Throat" }],
          personalChannels: [
            {
              channelId: "35-36",
              channelName: "Canal de lo Transitorio",
              userGate: 35,
              transitGate: 36,
              transitPlanet: "Marte",
              gates: [35, 36],
              centers: ["Throat", "SolarPlexus"],
            },
          ],
          educationalChannels: [],
          conditionedCenters: [
            {
              center: "SolarPlexus",
              displayName: "Plexo Solar",
              gates: [{ gate: 36, planet: "Marte" }],
            },
          ],
          activatedCenters: [
            { id: "Throat", displayName: "Garganta", gates: [35], channels: [] },
          ],
          reinforcedCenters: [],
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
          ],
        },
      },
      {
        id: "hour:2026-05-10T14:00:00.000Z",
        targetAt: "2026-05-10T14:00:00.000Z",
        calculatedAt: "2026-05-10T14:24:00.000Z",
        label: "14:00",
        collective: {
          planets: [],
          activatedGates: [],
          activatedChannels: [],
          activatedCenters: [],
          temporarilyDefinedCenters: [],
        },
      },
    ],
  };

  return { ...base, ...overrides };
}

describe("frontend transit experience adapter", () => {
  it("maps TransitExperienceResponse to the screen model in the expected order", () => {
    const model = buildTransitScreenModel(buildExperience());

    expect(model.mode).toBe("today");
    expect(model.header.activeLabel).toContain("Ahora");
    expect(model.primaryInsight.eyebrow).toBe("LO PRINCIPAL AHORA");
    expect(model.screenOrder).toEqual([
      "primaryInsight",
      "personalSections",
      "timeline",
      "centers",
      "planetDetails",
    ]);
    expect(model.planetDetails).toHaveLength(2);
  });

  it("degrades to collective view without fake personal sections", () => {
    const response = buildExperience({
      snapshots: buildExperience().snapshots.map((snapshot) => ({
        ...snapshot,
        personal: undefined,
      })),
    });
    const model = buildTransitScreenModel(response);

    expect(model.personalSections).toEqual([]);
    expect(model.primaryInsight.body).toContain("Lectura colectiva");
    expect(model.centerGroups.find((group) => group.kind === "activated")).toBeDefined();
  });

  it("respects center bucket precedence (temp > reinforced > conditioned > activated)", () => {
    const model = buildTransitScreenModel(buildExperience());
    const temporary = model.centerGroups.find((group) => group.kind === "temporarilyDefined");
    const conditioned = model.centerGroups.find((group) => group.kind === "conditioned");
    const activated = model.centerGroups.find((group) => group.kind === "activated");

    // Throat is temporarily-defined (full channel through it) so it should
    // appear in temporary only — NOT in the activated bucket.
    expect(temporary?.centers.map((center) => center.id)).toEqual(["Throat"]);
    expect(conditioned?.centers.map((center) => center.id)).toEqual(["SolarPlexus"]);
    expect(activated).toBeUndefined();
  });

  it("surfaces reinforcedCenters as a dedicated bucket when the user has matching definitions", () => {
    const base = buildExperience();
    const enriched: TransitExperienceResponse = {
      ...base,
      snapshots: base.snapshots.map((snapshot, index) => {
        if (index !== 0 || !snapshot.personal) return snapshot;
        return {
          ...snapshot,
          personal: {
            ...snapshot.personal,
            // User has Sacral defined permanently; transit touches it →
            // reinforcedCenters should pick it up.
            reinforcedCenters: [
              { id: "Sacral", displayName: "Sacral", gates: [34], channels: [] },
            ],
          },
        };
      }),
    };

    const model = buildTransitScreenModel(enriched);
    const reinforced = model.centerGroups.find((group) => group.kind === "reinforced");

    expect(reinforced).toBeDefined();
    expect(reinforced?.label).toBe("Reforzados");
    expect(reinforced?.centers.map((c) => c.id)).toEqual(["Sacral"]);
  });

  it("does not duplicate a center across temporarilyDefined and reinforced", () => {
    const base = buildExperience();
    const enriched: TransitExperienceResponse = {
      ...base,
      snapshots: base.snapshots.map((snapshot, index) => {
        if (index !== 0 || !snapshot.personal) return snapshot;
        return {
          ...snapshot,
          personal: {
            ...snapshot.personal,
            // User has Throat defined; the channel 35-36 also temp-defines it.
            // Temp takes precedence over reinforced.
            reinforcedCenters: [
              { id: "Throat", displayName: "Garganta", gates: [35], channels: [] },
            ],
          },
        };
      }),
    };

    const model = buildTransitScreenModel(enriched);
    const temporary = model.centerGroups.find((group) => group.kind === "temporarilyDefined");
    const reinforced = model.centerGroups.find((group) => group.kind === "reinforced");

    expect(temporary?.centers.map((c) => c.id)).toEqual(["Throat"]);
    expect(reinforced).toBeUndefined();
  });

  it("labels next7Days honestly as a panorama", () => {
    const panoramaSnapshot = {
      ...buildExperience().snapshots[0],
      id: "panorama:2026-05-10T00:00:00.000Z",
      targetAt: "2026-05-10T00:00:00.000Z",
      label: "Panorama",
    };
    const model = buildTransitScreenModel(buildExperience({
      mode: "next7Days",
      selectedAt: "2026-05-10T00:00:00.000Z",
      selectedSnapshotId: "panorama:2026-05-10T00:00:00.000Z",
      range: {
        kind: "next7Days",
        label: "10 may - 16 may",
        startsAt: "2026-05-10T00:00:00.000Z",
        endsAt: "2026-05-16T23:59:59.999Z",
        step: "panorama",
      },
      snapshots: [panoramaSnapshot],
    }));

    expect(model.header.rangeLabel).toBe("Próximos 7 días");
    expect(model.header.activeLabel).toBe("Tema de la semana");
    expect(model.primaryInsight.body).toContain("sin prometer precisión diaria");
    expect(model.actions.askAgent).toMatchObject({
      source: "weekly",
      mode: "next7Days",
      snapshotId: "panorama:2026-05-10T00:00:00.000Z",
      targetAt: "2026-05-10T00:00:00.000Z",
    });
  });

  it("generates askAgent payload with targetAt, snapshotId, and timeZone", () => {
    const model = buildTransitScreenModel(
      buildExperience(),
      "hour:2026-05-10T14:00:00.000Z",
    );

    expect(model.actions.askAgent).toMatchObject({
      source: "selectedTime",
      mode: "today",
      snapshotId: "hour:2026-05-10T14:00:00.000Z",
      targetAt: "2026-05-10T14:00:00.000Z",
      timeZone: "Etc/UTC",
    });
  });

  it("includes attribution with planets and lines when channels are present", () => {
    const model = buildTransitScreenModel(buildExperience());

    expect(model.primaryInsight.attribution).toBeDefined();
    expect(model.primaryInsight.attribution).toContain("Sol");
    expect(model.primaryInsight.attribution).toContain("35.2");
    expect(model.primaryInsight.attribution).toContain("Marte");
    expect(model.primaryInsight.attribution).toContain("36.3");
  });

  it("derives nextChange when a future hourly snapshot clears the temporary definition", () => {
    const base = buildExperience();
    const futureFlatSnapshot: TransitSnapshot = {
      id: "hour:2026-05-10T16:00:00.000Z",
      targetAt: "2026-05-10T16:00:00.000Z",
      calculatedAt: "2026-05-10T14:24:00.000Z",
      label: "16:00",
      collective: {
        planets: [],
        activatedGates: [],
        activatedChannels: [],
        activatedCenters: [],
        temporarilyDefinedCenters: [],
      },
    };
    const enrichedExperience: TransitExperienceResponse = {
      ...base,
      snapshots: [...base.snapshots, futureFlatSnapshot],
    };

    const model = buildTransitScreenModel(enrichedExperience);

    expect(model.nextChange).toBeDefined();
    expect(model.nextChange?.atLabel).toBe("16:00");
    expect(model.nextChange?.kicker).toBe("PRÓXIMO CAMBIO");
    expect(model.nextChange?.atTargetIso).toBe("2026-05-10T16:00:00.000Z");
    expect(model.nextChange?.summary).toContain("Canal de lo Transitorio");
  });

  it("omits nextChange when the day stays flat after the selected snapshot", () => {
    const flatExperience = buildExperience({
      snapshots: [
        buildExperience().snapshots[0],
      ],
    });

    const model = buildTransitScreenModel(flatExperience);

    expect(model.nextChange).toBeUndefined();
  });

});
