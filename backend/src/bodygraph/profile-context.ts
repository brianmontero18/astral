import type { UserProfile } from "../types/agent.js";

export interface HumanDesignProfileSummary {
  name: string;
  type: string;
  typeQualifier?: string;
  strategy: string;
  authority: string;
  profile: string;
  profileName?: string;
  definition: string;
  incarnationCross: string;
  definedCenters: string[];
  undefinedCenters: string[];
  channels: UserProfile["humanDesign"]["channels"];
  channelCount: number;
  activatedGateCount: number;
}

export interface HumanDesignProfileContextPack {
  status: "ready";
  model: "v1_single_active_chart";
  source: {
    profile: "users.profile";
    birthData: "users.profile.birthData";
    humanDesign: "users.profile.humanDesign";
  };
  summary: HumanDesignProfileSummary;
  profile: {
    name: string;
    birthData: UserProfile["birthData"];
    humanDesign: UserProfile["humanDesign"] & {
      activatedGatesBySide: {
        personality: UserProfile["humanDesign"]["activatedGates"];
        design: UserProfile["humanDesign"]["activatedGates"];
      };
    };
  };
}

export interface HumanDesignCoreSummary {
  type: string | null;
  authority: string | null;
  profile: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function hasRequiredString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string" && record[key].trim().length > 0;
}

function isActivatedGateRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    Number.isInteger(value.number) &&
    Number(value.number) >= 1 &&
    Number(value.number) <= 64 &&
    Number.isInteger(value.line) &&
    Number(value.line) >= 1 &&
    Number(value.line) <= 6 &&
    typeof value.planet === "string" &&
    value.planet.trim().length > 0 &&
    typeof value.isPersonality === "boolean"
  );
}

function isChannelRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    hasRequiredString(value, "id") &&
    hasRequiredString(value, "name") &&
    hasRequiredString(value, "circuit")
  );
}

export function hasCalculatedBodygraphProfile(profile: unknown): profile is UserProfile {
  if (!isRecord(profile) || !hasRequiredString(profile, "name")) {
    return false;
  }

  const humanDesign = profile.humanDesign;
  if (!isRecord(humanDesign)) {
    return false;
  }

  const requiredStrings = [
    "type",
    "strategy",
    "authority",
    "profile",
    "definition",
    "incarnationCross",
    "notSelfTheme",
  ];
  if (!requiredStrings.every((key) => hasRequiredString(humanDesign, key))) {
    return false;
  }

  const activatedGates = humanDesign.activatedGates;
  const channels = humanDesign.channels;
  const definedCenters = humanDesign.definedCenters;
  const undefinedCenters = humanDesign.undefinedCenters;

  return (
    Array.isArray(activatedGates) &&
    activatedGates.length > 0 &&
    activatedGates.every(isActivatedGateRecord) &&
    Array.isArray(channels) &&
    channels.every(isChannelRecord) &&
    Array.isArray(definedCenters) &&
    definedCenters.every((center) => typeof center === "string" && center.trim().length > 0) &&
    Array.isArray(undefinedCenters) &&
    undefinedCenters.every((center) => typeof center === "string" && center.trim().length > 0)
  );
}

export function extractHumanDesignCoreSummary(profile: unknown): HumanDesignCoreSummary {
  const root = isRecord(profile) ? profile : null;
  const humanDesign = isRecord(root?.humanDesign)
    ? root.humanDesign
    : root;

  return {
    type: getOptionalString(humanDesign?.type),
    authority: getOptionalString(humanDesign?.authority),
    profile: getOptionalString(humanDesign?.profile),
  };
}

export function buildHumanDesignSummary(profile: UserProfile): HumanDesignProfileSummary {
  const hd = profile.humanDesign;

  return {
    name: profile.name,
    type: hd.type,
    typeQualifier: hd.typeQualifier,
    strategy: hd.strategy,
    authority: hd.authority,
    profile: hd.profile,
    profileName: hd.profileName,
    definition: hd.definition,
    incarnationCross: hd.incarnationCross,
    definedCenters: hd.definedCenters,
    undefinedCenters: hd.undefinedCenters,
    channels: hd.channels,
    channelCount: hd.channels.length,
    activatedGateCount: hd.activatedGates.length,
  };
}

export function buildHumanDesignProfileContextPack(
  profile: UserProfile,
): HumanDesignProfileContextPack {
  const hd = profile.humanDesign;
  const personalityGates = hd.activatedGates.filter((gate) => gate.isPersonality);
  const designGates = hd.activatedGates.filter((gate) => !gate.isPersonality);

  return {
    status: "ready",
    model: "v1_single_active_chart",
    source: {
      profile: "users.profile",
      birthData: "users.profile.birthData",
      humanDesign: "users.profile.humanDesign",
    },
    summary: buildHumanDesignSummary(profile),
    profile: {
      name: profile.name,
      birthData: profile.birthData,
      humanDesign: {
        ...hd,
        activatedGatesBySide: {
          personality: personalityGates,
          design: designGates,
        },
      },
    },
  };
}
