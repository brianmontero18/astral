import type { PlanetTransit } from "../types";

export type TransitMode = "today" | "next7Days";
export type TransitRangeStep = "now" | "hour" | "day" | "panorama";

export interface TransitGateFact {
  gate: number;
  lines: number[];
  planets: string[];
  center: string;
}

export interface TransitChannelFact {
  id: string;
  name: string;
  gates: [number, number];
  centers: string[];
}

export interface TransitCenterFact {
  id: string;
  displayName: string;
  gates: number[];
  channels: string[];
}

export interface TransitCenterDefinitionFact {
  id: string;
  displayName: string;
  channels: TransitChannelFact[];
}

export interface CollectiveTransitFacts {
  planets: PlanetTransit[];
  activatedGates: TransitGateFact[];
  activatedChannels: TransitChannelFact[];
  activatedCenters: TransitCenterFact[];
  temporarilyDefinedCenters: TransitCenterDefinitionFact[];
}

export interface TransitExperiencePersonalChannel {
  channelId: string;
  channelName: string;
  userGate: number;
  transitGate: number;
  transitPlanet: string;
  gates: [number, number];
  centers: string[];
}

export interface TransitExperienceEducationalChannel {
  channelId: string;
  channelName: string;
  planet1: string;
  planet2: string;
  gates: [number, number];
  centers: string[];
}

export interface TransitExperienceReinforcedGate {
  gate: number;
  planet: string;
  center: string;
}

export interface TransitExperienceConditionedCenter {
  center: string;
  displayName: string;
  gates: Array<{ gate: number; planet: string }>;
}

export interface PersonalTransitFacts {
  reinforcedGates: TransitExperienceReinforcedGate[];
  personalChannels: TransitExperiencePersonalChannel[];
  educationalChannels: TransitExperienceEducationalChannel[];
  conditionedCenters: TransitExperienceConditionedCenter[];
  activatedCenters: TransitCenterFact[];
  reinforcedCenters: TransitCenterFact[];
  temporarilyDefinedCenters: TransitCenterDefinitionFact[];
}

export interface TransitSnapshot {
  id: string;
  targetAt: string;
  calculatedAt: string;
  label: string;
  collective: CollectiveTransitFacts;
  personal?: PersonalTransitFacts;
}

export interface TransitExperienceResponse {
  version: "transits.v2";
  mode: TransitMode;
  timeZone: string;
  generatedAt: string;
  selectedAt: string;
  range: {
    kind: TransitMode;
    label: string;
    startsAt: string;
    endsAt: string;
    step: TransitRangeStep;
  };
  selectedSnapshotId: string;
  snapshots: TransitSnapshot[];
  dayKeyFacts?: DayKeyFact[];
}

export type DayKeyFactKind =
  | "today"
  | "channelOpen"
  | "channelClose"
  | "centerConditioned"
  | "planetMove";

export interface DayKeyFact {
  id: string;
  atTargetIso: string;
  dayLabel: string;
  kind: DayKeyFactKind;
  summary: string;
  impactLabel?: string;
}

export interface BodygraphSnapshot {
  userDefinedCenters: string[];
  userActivatedGates: number[];
  transitActivatedCenters: string[];
  transitConditionedCenters: string[];
  temporarilyDefinedCenters: string[];
  activatedChannels: Array<{ id: string }>;
  temporarilyDefinedChannels: Array<{ id: string }>;
  personalChannels: Array<{ id: string }>;
}

export interface TransitChatContext {
  source: "transitScreen";
  mode: TransitMode;
  snapshotId: string;
  targetAt: string;
  timeZone: string;
}

export interface TransitAskAgentPayload {
  source: "now" | "selectedTime" | "weekly";
  snapshotId: string;
  targetAt: string;
  timeZone: string;
  mode: TransitMode;
  prefill: string;
}

export interface TransitScreenModel {
  mode: TransitMode;
  header: {
    title: string;
    rangeLabel: string;
    activeLabel: string;
    subtitle: string;
    calculatedLabel: string;
  };
  selector: {
    options: Array<{ mode: TransitMode; label: string; selected: boolean }>;
  };
  timeline?: {
    selectedSnapshotId: string;
    snapshots: Array<{ id: string; label: string; targetAt: string }>;
  };
  primaryInsight: {
    eyebrow: string;
    title: string;
    body: string;
    headlineDetail?: string;
    attribution?: string;
    duration?: string;
    pulseChannels?: Array<{ id: string; name: string; centers: string }>;
    pulseGates?: Array<{ id: number; label: string }>;
    supportingFacts: string[];
  };
  nextChange?: {
    kicker: string;
    atLabel: string;
    summary: string;
    atTargetIso: string;
  };
  dayKeyFacts?: DayKeyFact[];
  bodygraphSnapshot?: BodygraphSnapshot;
  personalSections: TransitImpactSectionModel[];
  centerGroups: TransitCenterGroupModel[];
  planetDetails: TransitPlanetDetailModel[];
  actions: {
    askAgent: TransitAskAgentPayload;
  };
  screenOrder: Array<"primaryInsight" | "personalSections" | "timeline" | "centers" | "planetDetails">;
  loadingState: "ready" | "refreshing" | "timelineLoading" | "error";
}

export interface TransitImpactSectionModel {
  id: string;
  kind: "temporaryChannel" | "conditionedCenter" | "reinforcedGate" | "educationalChannel";
  title: string;
  subtitle?: string;
  items: TransitImpactCardModel[];
}

export interface TransitImpactCardModel {
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  meta: string;
}

export interface TransitCenterGroupModel {
  kind: "temporarilyDefined" | "conditioned" | "activated";
  label: string;
  centers: Array<{
    id: string;
    displayName: string;
    sourceIds: string[];
  }>;
}

export interface TransitPlanetDetailModel {
  id: string;
  name: string;
  glyph: string;
  sign: string;
  degree: number;
  isRetrograde: boolean;
  hdGate: number;
  hdLine: number;
}
