import { describe, expect, it } from "vitest";

import {
  buildHumanDesignProfileContextPack,
  buildHumanDesignSummary,
  extractHumanDesignCoreSummary,
  hasCalculatedBodygraphProfile,
} from "../bodygraph/profile-context.js";
import type { UserProfile } from "../types/agent.js";

function sampleProfile(): UserProfile {
  return {
    name: "Domain Context User",
    birthData: {
      dateLocalIso: "1990-04-03T10:15:00-03:00",
      dateUtcIso: "1990-04-03T13:15:00.000Z",
      placeLabel: "Buenos Aires, Argentina",
      coordinates: { lat: -34.6037, lon: -58.3816 },
      timezoneOffsetHours: -3,
      ageYears: 36,
    },
    humanDesign: {
      type: "Projector",
      typeQualifier: "Self-Projected",
      strategy: "Wait for the Invitation",
      authority: "Self-Projected",
      profile: "2/4",
      profileName: "Hermit / Opportunist",
      definition: "Single Definition",
      incarnationCross: "Right Angle Cross of Explanation",
      themes: { positive: "Success", notSelf: "Bitterness" },
      notSelfTheme: "Bitterness",
      variable: "PRR DRL",
      digestion: "Cold",
      environment: "Markets",
      strongestSense: "Outer Vision",
      design: { date: "1990-01-04T13:15:00.000Z" },
      variables: {
        digestion: { orientation: "right", color: 2, tone: 3, base: 1 },
        awareness: { orientation: "right", color: 4, tone: 5, base: 2 },
        environment: { orientation: "left", color: 1, tone: 2, base: 3 },
        perspective: { orientation: "right", color: 6, tone: 1, base: 4 },
      },
      variableLabels: {
        brain: "Passive Brain",
        determination: "Cold",
        determinationCategory: "Temperature",
        cognition: "Outer Vision",
        environment: "Markets",
        environmentDetail: "Internal Markets",
        environmentStyle: "Observed",
        personality: "Right Mind",
        motivation: "Hope",
        sense: "Outer Vision",
        trajectory: "Theist",
        viewPerspective: "Personal",
        view: "Possibility",
        transferredMotivation: "Guilt",
        transferredView: "Probability",
      },
      channels: [{ id: "1-8", name: "Canal de Inspiracion", circuit: "Individual" }],
      activatedGates: [
        {
          number: 1,
          line: 1,
          color: 2,
          tone: 3,
          base: 1,
          planet: "Sun",
          isPersonality: true,
          isRetrograde: true,
          fixingState: "exalted",
        },
        {
          number: 8,
          line: 2,
          color: 4,
          tone: 5,
          base: 2,
          planet: "Earth",
          isPersonality: false,
          isRetrograde: false,
          fixingState: "detriment",
        },
      ],
      definedCenters: ["G", "Throat"],
      undefinedCenters: ["Head", "Ajna", "Spleen", "SolarPlexus", "Heart", "Sacral", "Root"],
    },
  };
}

describe("bodygraph profile context domain", () => {
  it("detects whether an unknown profile has a calculated bodygraph", () => {
    expect(hasCalculatedBodygraphProfile(sampleProfile())).toBe(true);
    expect(hasCalculatedBodygraphProfile({ humanDesign: { activatedGates: [] } })).toBe(false);
    expect(hasCalculatedBodygraphProfile({})).toBe(false);
  });

  it("rejects malformed active-chart false positives", () => {
    const profile = sampleProfile();

    expect(hasCalculatedBodygraphProfile(null)).toBe(false);
    expect(hasCalculatedBodygraphProfile({
      ...profile,
      name: "",
    })).toBe(false);
    expect(hasCalculatedBodygraphProfile({
      ...profile,
      humanDesign: {
        ...profile.humanDesign,
        type: "",
      },
    })).toBe(false);
    expect(hasCalculatedBodygraphProfile({
      ...profile,
      humanDesign: {
        ...profile.humanDesign,
        activatedGates: [{ number: 65, line: 1, planet: "Sun", isPersonality: true }],
      },
    })).toBe(false);
    expect(hasCalculatedBodygraphProfile({
      ...profile,
      humanDesign: {
        ...profile.humanDesign,
        activatedGates: [{ number: 1, line: 7, planet: "Sun", isPersonality: true }],
      },
    })).toBe(false);
    expect(hasCalculatedBodygraphProfile({
      ...profile,
      humanDesign: {
        ...profile.humanDesign,
        activatedGates: [{ number: 1, line: 1, planet: "", isPersonality: true }],
      },
    })).toBe(false);
    expect(hasCalculatedBodygraphProfile({
      ...profile,
      humanDesign: {
        ...profile.humanDesign,
        activatedGates: [{ number: 1, line: 1, planet: "Sun" }],
      },
    })).toBe(false);
    expect(hasCalculatedBodygraphProfile({
      ...profile,
      humanDesign: {
        ...profile.humanDesign,
        channels: [{ id: "1-8", name: "Canal de Inspiracion" }],
      },
    })).toBe(false);
    expect(hasCalculatedBodygraphProfile({
      ...profile,
      humanDesign: {
        ...profile.humanDesign,
        definedCenters: ["G", ""],
      },
    })).toBe(false);
  });

  it("allows calculated profiles with no channels or defined centers", () => {
    const profile = sampleProfile();

    expect(hasCalculatedBodygraphProfile({
      ...profile,
      humanDesign: {
        ...profile.humanDesign,
        type: "Reflector",
        strategy: "Wait a Lunar Cycle",
        authority: "Lunar",
        definition: "No Definition",
        channels: [],
        definedCenters: [],
        undefinedCenters: [
          "Head",
          "Ajna",
          "Throat",
          "G",
          "Heart",
          "Sacral",
          "Spleen",
          "SolarPlexus",
          "Root",
        ],
      },
    })).toBe(true);
  });

  it("builds one reusable Human Design summary from UserProfile", () => {
    expect(buildHumanDesignSummary(sampleProfile())).toEqual({
      name: "Domain Context User",
      type: "Projector",
      typeQualifier: "Self-Projected",
      strategy: "Wait for the Invitation",
      authority: "Self-Projected",
      profile: "2/4",
      profileName: "Hermit / Opportunist",
      definition: "Single Definition",
      incarnationCross: "Right Angle Cross of Explanation",
      definedCenters: ["G", "Throat"],
      undefinedCenters: ["Head", "Ajna", "Spleen", "SolarPlexus", "Heart", "Sacral", "Root"],
      channels: [{ id: "1-8", name: "Canal de Inspiracion", circuit: "Individual" }],
      channelCount: 1,
      activatedGateCount: 2,
    });
  });

  it("extracts a tolerant core summary for route-level projections", () => {
    expect(extractHumanDesignCoreSummary(sampleProfile())).toEqual({
      type: "Projector",
      authority: "Self-Projected",
      profile: "2/4",
    });
    expect(extractHumanDesignCoreSummary({
      type: "Generator",
      authority: "Emotional",
      profile: "6/2",
    })).toEqual({
      type: "Generator",
      authority: "Emotional",
      profile: "6/2",
    });
    expect(extractHumanDesignCoreSummary({ humanDesign: { type: 42 } })).toEqual({
      type: null,
      authority: null,
      profile: null,
    });
  });

  it("builds the external context pack from the same domain summary", () => {
    const profile = sampleProfile();
    const contextPack = buildHumanDesignProfileContextPack(profile);

    expect(contextPack.summary).toEqual(buildHumanDesignSummary(profile));
    expect(contextPack).toMatchObject({
      status: "ready",
      model: "v1_single_active_chart",
      source: {
        profile: "users.profile",
        humanDesign: "users.profile.humanDesign",
      },
      profile: {
        name: "Domain Context User",
        humanDesign: {
          activatedGatesBySide: {
            personality: [
              {
                number: 1,
                line: 1,
                color: 2,
                tone: 3,
                base: 1,
                planet: "Sun",
                isPersonality: true,
                isRetrograde: true,
                fixingState: "exalted",
              },
            ],
            design: [
              {
                number: 8,
                line: 2,
                color: 4,
                tone: 5,
                base: 2,
                planet: "Earth",
                isPersonality: false,
                isRetrograde: false,
                fixingState: "detriment",
              },
            ],
          },
        },
      },
    });
    expect(contextPack.profile.birthData).toEqual(profile.birthData);
    expect(contextPack.profile.humanDesign.incarnationCross).toBe(
      "Right Angle Cross of Explanation",
    );
    expect(contextPack.profile.humanDesign.variables).toEqual(profile.humanDesign.variables);
    expect(contextPack.profile.humanDesign.variableLabels).toEqual(
      profile.humanDesign.variableLabels,
    );
    expect(contextPack.profile.humanDesign.design).toEqual(profile.humanDesign.design);
    expect(contextPack.profile.humanDesign.activatedGates).toEqual(
      profile.humanDesign.activatedGates,
    );
  });
});
