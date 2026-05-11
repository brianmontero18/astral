/**
 * Transit Service — Swiss Ephemeris (WASM)
 *
 * Calcula posiciones planetarias reales usando Swiss Ephemeris,
 * la misma fuente que Astro.com, Jovian Archive y todo software serio.
 * Sin API keys, sin límites, sin costo.
 */

import SwissEph from "swisseph-wasm";
import { degreeToGate, GATE_TO_CENTER, normalizeCenter } from "./hd-gates.js";
import { HD_CHANNELS } from "./hd-channels.js";
import {
  getCachedTransitSnapshot,
  setCachedTransitSnapshot,
} from "./db.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanetTransit {
  name: string;
  longitude: number;
  sign: string;
  degree: number;
  isRetrograde: boolean;
  hdGate: number;
  hdLine: number;
}

export interface WeeklyTransits {
  fetchedAt: string;
  weekRange: string;
  planets: PlanetTransit[];
  activatedChannels: string[];
}

export type TransitExperienceMode = "today" | "next7Days";
export type TransitSnapshotKind = "instant" | "hour" | "day" | "panorama";

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

export interface TransitExperiencePersonalChannel extends PersonalChannel {
  gates: [number, number];
  centers: string[];
}

export interface TransitExperienceEducationalChannel extends EducationalChannel {
  gates: [number, number];
  centers: string[];
}

export interface TransitExperienceReinforcedGate extends ReinforcedGate {
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
  mode: TransitExperienceMode;
  timeZone: string;
  generatedAt: string;
  selectedAt: string;
  range: {
    kind: TransitExperienceMode;
    label: string;
    startsAt: string;
    endsAt: string;
    step: "now" | "hour" | "day" | "panorama";
  };
  selectedSnapshotId: string;
  snapshots: TransitSnapshot[];
}

export interface BuildTransitExperienceInput {
  mode: TransitExperienceMode;
  clientNow: Date;
  selectedAt?: Date;
  includeTimeline?: boolean;
  timeZone: string;
}

// ─── Planet config ────────────────────────────────────────────────────────────

interface PlanetDef {
  id: number;
  name: string;
}

// ─── Zodiac signs ─────────────────────────────────────────────────────────────

const SIGNS = [
  "Aries", "Tauro", "Géminis", "Cáncer",
  "Leo", "Virgo", "Libra", "Escorpio",
  "Sagitario", "Capricornio", "Acuario", "Piscis",
];

function longitudeToSign(lon: number): { sign: string; degree: number } {
  const normalized = ((lon % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const degree = parseFloat((normalized - signIndex * 30).toFixed(2));
  return { sign: SIGNS[signIndex], degree };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let cachedTransits: WeeklyTransits | null = null;
let currentWeekRange: string | null = null;
let currentTimeZone: string | null = null;

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export async function fetchWeeklyTransits(
  now: Date = new Date(),
  timeZone?: string,
): Promise<WeeklyTransits> {
  const weekRange = getWeekRange(now, timeZone);

  if (
    cachedTransits &&
    currentWeekRange === weekRange &&
    currentTimeZone === (timeZone ?? null)
  ) {
    return cachedTransits;
  }

  const planets = await calculatePlanetTransits(now);
  const activatedChannels = getActivatedChannelFacts(planets).map((channel) => channel.name);

  const transits = {
    fetchedAt: now.toISOString(),
    weekRange,
    planets,
    activatedChannels,
  };

  // Update in-memory cache
  cachedTransits = transits;
  currentWeekRange = weekRange;
  currentTimeZone = timeZone ?? null;

  return transits;
}

async function calculatePlanetTransits(now: Date): Promise<PlanetTransit[]> {
  const swe = new SwissEph();
  await swe.initSwissEph();

  const jd = swe.julday(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours() + now.getUTCMinutes() / 60,
  );

  const PLANETS: PlanetDef[] = [
    { id: swe.SE_SUN,     name: "Sol"       },
    { id: swe.SE_MOON,    name: "Luna"      },
    { id: swe.SE_MERCURY, name: "Mercurio"  },
    { id: swe.SE_VENUS,   name: "Venus"     },
    { id: swe.SE_MARS,    name: "Marte"     },
    { id: swe.SE_JUPITER, name: "Júpiter"   },
    { id: swe.SE_SATURN,  name: "Saturno"   },
    { id: swe.SE_URANUS,  name: "Urano"     },
    { id: swe.SE_NEPTUNE, name: "Neptuno"   },
    { id: swe.SE_PLUTO,   name: "Plutón"    },
    { id: swe.SE_CHIRON,  name: "Quirón"    },
    { id: swe.SE_MEAN_NODE, name: "Nodo Norte" },
  ];

  const planets: PlanetTransit[] = [];

  for (const planet of PLANETS) {
    const result = swe.calc_ut(jd, planet.id, swe.SEFLG_SWIEPH | swe.SEFLG_SPEED);
    const longitude = ((result[0] % 360) + 360) % 360;
    const speed = result[3]; // negative = retrograde
    const { sign, degree } = longitudeToSign(longitude);
    const { gate, line } = degreeToGate(longitude);

    planets.push({
      name: planet.name,
      longitude: parseFloat(longitude.toFixed(4)),
      sign,
      degree,
      isRetrograde: speed < 0,
      hdGate: gate,
      hdLine: line,
    });

    // South Node = opposite of North Node
    if (planet.id === swe.SE_MEAN_NODE) {
      const southLon = ((longitude + 180) % 360 + 360) % 360;
      const southPos = longitudeToSign(southLon);
      const southGate = degreeToGate(southLon);
      planets.push({
        name: "Nodo Sur",
        longitude: parseFloat(southLon.toFixed(4)),
        sign: southPos.sign,
        degree: southPos.degree,
        isRetrograde: false,
        hdGate: southGate.gate,
        hdLine: southGate.line,
      });
    }
  }

  swe.close();
  return planets;
}

const CENTER_DISPLAY_ES: Record<string, string> = {
  Head: "Cabeza",
  Ajna: "Ajna",
  Throat: "Garganta",
  G: "Centro G",
  Heart: "Corazón",
  Spleen: "Bazo",
  Sacral: "Sacral",
  SolarPlexus: "Plexo Solar",
  Root: "Raíz",
};

function displayCenter(center: string): string {
  return CENTER_DISPLAY_ES[center] ?? center;
}

function parseChannelId(channelId: string): [number, number] {
  const [g1, g2] = channelId.split("-").map(Number);
  return [g1, g2];
}

function buildChannelFact(channelId: string, name: string): TransitChannelFact {
  const gates = parseChannelId(channelId);
  const centers = Array.from(
    new Set(gates.map((gate) => GATE_TO_CENTER[gate]).filter(Boolean)),
  );
  return { id: channelId, name, gates, centers };
}

function getActivatedChannelFacts(planets: PlanetTransit[]): TransitChannelFact[] {
  const activeGates = new Set(planets.map((planet) => planet.hdGate));
  const channels: TransitChannelFact[] = [];

  for (const [channelId, name] of Object.entries(HD_CHANNELS)) {
    const [g1, g2] = parseChannelId(channelId);
    if (activeGates.has(g1) && activeGates.has(g2)) {
      channels.push(buildChannelFact(channelId, name));
    }
  }

  return channels;
}

function getActivatedGateFacts(planets: PlanetTransit[]): TransitGateFact[] {
  const gateMap = new Map<number, { lines: Set<number>; planets: string[] }>();

  for (const planet of planets) {
    const entry = gateMap.get(planet.hdGate) ?? { lines: new Set<number>(), planets: [] };
    entry.lines.add(planet.hdLine);
    entry.planets.push(planet.name);
    gateMap.set(planet.hdGate, entry);
  }

  return Array.from(gateMap.entries())
    .map(([gate, entry]) => ({
      gate,
      lines: Array.from(entry.lines).sort((a, b) => a - b),
      planets: entry.planets,
      center: GATE_TO_CENTER[gate] ?? "Unknown",
    }))
    .sort((a, b) => a.gate - b.gate);
}

function buildCenterFactsFromGates(
  gates: TransitGateFact[],
  channels: TransitChannelFact[] = [],
): TransitCenterFact[] {
  const centerMap = new Map<string, { gates: Set<number>; channels: Set<string> }>();

  for (const gate of gates) {
    if (!centerMap.has(gate.center)) {
      centerMap.set(gate.center, { gates: new Set<number>(), channels: new Set<string>() });
    }
    centerMap.get(gate.center)!.gates.add(gate.gate);
  }

  for (const channel of channels) {
    for (const center of channel.centers) {
      if (!centerMap.has(center)) {
        centerMap.set(center, { gates: new Set<number>(), channels: new Set<string>() });
      }
      centerMap.get(center)!.channels.add(channel.id);
    }
  }

  return Array.from(centerMap.entries())
    .map(([id, entry]) => ({
      id,
      displayName: displayCenter(id),
      gates: Array.from(entry.gates).sort((a, b) => a - b),
      channels: Array.from(entry.channels).sort(),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
}

function buildCenterDefinitionsFromChannels(
  channels: TransitChannelFact[],
): TransitCenterDefinitionFact[] {
  const centerMap = new Map<string, TransitChannelFact[]>();

  for (const channel of channels) {
    for (const center of channel.centers) {
      const entry = centerMap.get(center) ?? [];
      entry.push(channel);
      centerMap.set(center, entry);
    }
  }

  return Array.from(centerMap.entries())
    .map(([id, centerChannels]) => ({
      id,
      displayName: displayCenter(id),
      channels: centerChannels,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
}

function buildCollectiveFacts(planets: PlanetTransit[]): CollectiveTransitFacts {
  const activatedGates = getActivatedGateFacts(planets);
  const activatedChannels = getActivatedChannelFacts(planets);
  const activatedCenters = buildCenterFactsFromGates(activatedGates, activatedChannels);
  const temporarilyDefinedCenters = buildCenterDefinitionsFromChannels(activatedChannels);

  return {
    planets,
    activatedGates,
    activatedChannels,
    activatedCenters,
    temporarilyDefinedCenters,
  };
}

export async function calculateTransitSnapshot(
  targetAt: Date,
  timeZone: string,
  options: { id?: string; label?: string } = {},
): Promise<TransitSnapshot> {
  const planets = await calculatePlanetTransits(targetAt);

  return {
    id: options.id ?? `instant:${targetAt.toISOString()}`,
    targetAt: targetAt.toISOString(),
    calculatedAt: new Date().toISOString(),
    label: options.label ?? formatSnapshotLabel(targetAt, timeZone),
    collective: buildCollectiveFacts(planets),
  };
}

interface CachedCollectivePayload {
  calculatedAt: string;
  collective: CollectiveTransitFacts;
}

export async function getTransitSnapshotCached(
  kind: TransitSnapshotKind,
  targetAt: Date,
  timeZone: string,
  label?: string,
): Promise<TransitSnapshot> {
  if (kind === "instant") {
    return calculateTransitSnapshot(targetAt, timeZone, {
      id: `instant:${targetAt.toISOString()}`,
      label,
    });
  }

  const bucketAt = getSnapshotBucketDate(kind, targetAt, timeZone);
  const cacheKey = getTransitSnapshotCacheKey(kind, bucketAt, timeZone);
  const cached = await getCachedTransitSnapshot(cacheKey);

  if (cached) {
    const data = cached.data as CachedCollectivePayload;
    return {
      id: `${kind}:${bucketAt.toISOString()}`,
      targetAt: cached.target_at,
      calculatedAt: data.calculatedAt,
      label: label ?? formatSnapshotLabel(new Date(cached.target_at), timeZone),
      collective: data.collective,
    };
  }

  const fresh = await calculateTransitSnapshot(bucketAt, timeZone, {
    id: `${kind}:${bucketAt.toISOString()}`,
    label: label ?? formatSnapshotLabel(bucketAt, timeZone),
  });

  await setCachedTransitSnapshot({
    cacheKey,
    kind,
    timeZone,
    targetAt: fresh.targetAt,
    data: {
      calculatedAt: fresh.calculatedAt,
      collective: fresh.collective,
    },
  });

  return fresh;
}

export function transitSnapshotToWeeklyTransits(snapshot: TransitSnapshot): WeeklyTransits {
  return {
    fetchedAt: snapshot.targetAt,
    weekRange: snapshot.label,
    planets: snapshot.collective.planets,
    activatedChannels: snapshot.collective.activatedChannels.map((channel) => channel.name),
  };
}

// ─── Transit Impact Types ─────────────────────────────────────────────────────

export interface PersonalChannel {
  channelId: string;
  channelName: string;
  userGate: number;
  transitGate: number;
  transitPlanet: string;
}

export interface EducationalChannel {
  channelId: string;
  channelName: string;
  planet1: string;
  planet2: string;
}

export interface ReinforcedGate {
  gate: number;
  planet: string;
}

export interface ConditionedCenter {
  center: string;
  gates: Array<{ gate: number; planet: string }>;
}

export interface TransitImpact {
  personalChannels: PersonalChannel[];
  educationalChannels: EducationalChannel[];
  reinforcedGates: ReinforcedGate[];
  conditionedCenters: ConditionedCenter[];
}

export interface UserHDProfile {
  activatedGates: Array<{ number: number }>;
  definedCenters: string[];
}

// ─── Impact Analysis ──────────────────────────────────────────────────────────

export function analyzeTransitImpact(
  transits: WeeklyTransits,
  hdProfile: UserHDProfile,
): TransitImpact {
  const userGateSet = new Set(
    (hdProfile.activatedGates ?? []).map(g => g.number)
  );
  const definedCenterSet = new Set(
    (hdProfile.definedCenters ?? []).map(c => normalizeCenter(c))
  );

  // Map: gate number → transiting planet name(s)
  const transitGateMap = new Map<number, string[]>();
  for (const p of transits.planets) {
    const existing = transitGateMap.get(p.hdGate) ?? [];
    existing.push(p.name);
    transitGateMap.set(p.hdGate, existing);
  }

  const personalChannels: PersonalChannel[] = [];
  const educationalChannels: EducationalChannel[] = [];
  const reinforcedGates: ReinforcedGate[] = [];
  const conditionedCenterMap = new Map<string, Array<{ gate: number; planet: string }>>();

  // 1. Reinforced gates: transit hits a gate user already has
  for (const [gate, planets] of transitGateMap) {
    if (userGateSet.has(gate)) {
      for (const planet of planets) {
        reinforcedGates.push({ gate, planet });
      }
    }
  }

  // 2. Channel analysis
  for (const [pair, channelName] of Object.entries(HD_CHANNELS)) {
    const [g1, g2] = pair.split("-").map(Number);
    const g1InUser = userGateSet.has(g1);
    const g2InUser = userGateSet.has(g2);
    const g1InTransit = transitGateMap.has(g1);
    const g2InTransit = transitGateMap.has(g2);

    // Personal channel: user has one gate, transit has the other
    if (g1InUser && !g2InUser && g2InTransit) {
      for (const planet of transitGateMap.get(g2)!) {
        personalChannels.push({ channelId: pair, channelName, userGate: g1, transitGate: g2, transitPlanet: planet });
      }
    } else if (g2InUser && !g1InUser && g1InTransit) {
      for (const planet of transitGateMap.get(g1)!) {
        personalChannels.push({ channelId: pair, channelName, userGate: g2, transitGate: g1, transitPlanet: planet });
      }
    }

    // Educational channel: neither gate in user, both in transit
    if (!g1InUser && !g2InUser && g1InTransit && g2InTransit) {
      educationalChannels.push({ channelId: pair, channelName, planet1: transitGateMap.get(g1)![0], planet2: transitGateMap.get(g2)![0] });
    }
  }

  // 3. Conditioned centers: transit activates gate in user's undefined center
  for (const [gate, planets] of transitGateMap) {
    if (userGateSet.has(gate)) continue;
    const center = GATE_TO_CENTER[gate];
    if (!center || definedCenterSet.has(center)) continue;

    if (!conditionedCenterMap.has(center)) {
      conditionedCenterMap.set(center, []);
    }
    for (const planet of planets) {
      conditionedCenterMap.get(center)!.push({ gate, planet });
    }
  }

  const conditionedCenters: ConditionedCenter[] = [];
  for (const [center, gates] of conditionedCenterMap) {
    conditionedCenters.push({ center, gates });
  }

  return { personalChannels, educationalChannels, reinforcedGates, conditionedCenters };
}

export function analyzeTransitExperienceImpact(
  snapshot: TransitSnapshot,
  hdProfile: UserHDProfile,
): PersonalTransitFacts {
  const legacyImpact = analyzeTransitImpact(
    transitSnapshotToWeeklyTransits(snapshot),
    hdProfile,
  );
  const definedCenterSet = new Set(
    (hdProfile.definedCenters ?? []).map((center) => normalizeCenter(center)),
  );
  const channelMap = new Map(
    Object.entries(HD_CHANNELS).map(([id, name]) => [id, buildChannelFact(id, name)]),
  );
  const temporarilyDefinedChannels = new Map<string, TransitChannelFact>();

  const personalChannels: TransitExperiencePersonalChannel[] =
    legacyImpact.personalChannels.map((channel) => {
      const fact = channelMap.get(channel.channelId) ?? buildChannelFact(channel.channelId, channel.channelName);
      temporarilyDefinedChannels.set(fact.id, fact);
      return {
        ...channel,
        gates: fact.gates,
        centers: fact.centers,
      };
    });

  const educationalChannels: TransitExperienceEducationalChannel[] =
    legacyImpact.educationalChannels.map((channel) => {
      const fact = channelMap.get(channel.channelId) ?? buildChannelFact(channel.channelId, channel.channelName);
      temporarilyDefinedChannels.set(fact.id, fact);
      return {
        ...channel,
        gates: fact.gates,
        centers: fact.centers,
      };
    });

  const reinforcedGates: TransitExperienceReinforcedGate[] =
    legacyImpact.reinforcedGates.map((gate) => ({
      ...gate,
      center: GATE_TO_CENTER[gate.gate] ?? "Unknown",
    }));

  const activatedCenters = snapshot.collective.activatedCenters
    .filter((center) => definedCenterSet.has(normalizeCenter(center.id)));

  const temporarilyDefinedCenters = buildCenterDefinitionsFromChannels(
    Array.from(temporarilyDefinedChannels.values()),
  );
  const temporarilyDefinedCenterSet = new Set(
    temporarilyDefinedCenters.map((center) => normalizeCenter(center.id)),
  );
  const conditionedCenters: TransitExperienceConditionedCenter[] =
    legacyImpact.conditionedCenters
      .filter((center) => !temporarilyDefinedCenterSet.has(normalizeCenter(center.center)))
      .map((center) => ({
        center: center.center,
        displayName: displayCenter(center.center),
        gates: center.gates,
      }));

  return {
    reinforcedGates,
    personalChannels,
    educationalChannels,
    conditionedCenters,
    activatedCenters,
    temporarilyDefinedCenters,
  };
}

export async function buildTransitExperience(
  input: BuildTransitExperienceInput,
  profile?: UserHDProfile,
): Promise<TransitExperienceResponse> {
  const generatedAt = new Date().toISOString();
  const selectedTarget = input.selectedAt ?? input.clientNow;

  if (input.mode === "next7Days") {
    const range = getNextSevenDaysRange(input.clientNow, input.timeZone);
    const snapshot = await getTransitSnapshotCached(
      "panorama",
      input.clientNow,
      input.timeZone,
      "Panorama",
    );
    const enriched = attachPersonalFacts(snapshot, profile);

    return {
      version: "transits.v2",
      mode: "next7Days",
      timeZone: input.timeZone,
      generatedAt,
      selectedAt: input.clientNow.toISOString(),
      range: {
        kind: "next7Days",
        label: range.label,
        startsAt: range.startsAt.toISOString(),
        endsAt: range.endsAt.toISOString(),
        step: "panorama",
      },
      selectedSnapshotId: enriched.id,
      snapshots: [enriched],
    };
  }

  const localDay = getLocalDateParts(selectedTarget, input.timeZone);
  const startsAt = zonedTimeToUtc(localDay.year, localDay.month, localDay.day, 0, 0, 0, input.timeZone);
  const endsAt = new Date(zonedTimeToUtc(localDay.year, localDay.month, localDay.day + 1, 0, 0, 0, input.timeZone).getTime() - 1);
  const selectedSnapshot = attachPersonalFacts(
    await getTransitSnapshotCached(
      "instant",
      selectedTarget,
      input.timeZone,
      input.selectedAt ? formatHourLabel(selectedTarget, input.timeZone) : "Ahora",
    ),
    profile,
  );
  const snapshots: TransitSnapshot[] = [selectedSnapshot];

  if (input.includeTimeline) {
    for (let hour = 0; hour < 24; hour += 1) {
      const targetAt = zonedTimeToUtc(localDay.year, localDay.month, localDay.day, hour, 0, 0, input.timeZone);
      const hourlySnapshot = await getTransitSnapshotCached(
        "hour",
        targetAt,
        input.timeZone,
        formatHourLabel(targetAt, input.timeZone),
      );
      snapshots.push(attachPersonalFacts(hourlySnapshot, profile));
    }
  }

  return {
    version: "transits.v2",
    mode: "today",
    timeZone: input.timeZone,
    generatedAt,
    selectedAt: selectedTarget.toISOString(),
    range: {
      kind: "today",
      label: "Hoy",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      step: input.includeTimeline ? "hour" : input.selectedAt ? "hour" : "now",
    },
    selectedSnapshotId: selectedSnapshot.id,
    snapshots,
  };
}

function attachPersonalFacts(
  snapshot: TransitSnapshot,
  profile?: UserHDProfile,
): TransitSnapshot {
  if (!profile) return snapshot;
  return {
    ...snapshot,
    personal: analyzeTransitExperienceImpact(snapshot, profile),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getLocalDateParts(now: Date, timeZone?: string): { year: number; month: number; day: number } {
  if (!timeZone) {
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  };
}

function getLocalDateTimeParts(
  now: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getLocalDateTimeParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return localAsUtc - date.getTime();
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = getTimeZoneOffsetMs(new Date(localAsUtc), timeZone);
  const firstUtc = localAsUtc - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(firstUtc), timeZone);
  return new Date(localAsUtc - secondOffset);
}

function formatHourLabel(targetAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(targetAt);
}

function formatSnapshotLabel(targetAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(targetAt);
}

function formatRangeDate(targetAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(targetAt);
}

function getSnapshotBucketDate(
  kind: TransitSnapshotKind,
  targetAt: Date,
  timeZone: string,
): Date {
  if (kind === "hour") {
    const parts = getLocalDateTimeParts(targetAt, timeZone);
    return zonedTimeToUtc(parts.year, parts.month, parts.day, parts.hour, 0, 0, timeZone);
  }

  if (kind === "day") {
    const parts = getLocalDateParts(targetAt, timeZone);
    return zonedTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);
  }

  if (kind === "panorama") {
    const parts = getLocalDateParts(targetAt, timeZone);
    const localDateUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    localDateUtc.setUTCDate(localDateUtc.getUTCDate() - ((localDateUtc.getUTCDay() + 6) % 7));
    return zonedTimeToUtc(
      localDateUtc.getUTCFullYear(),
      localDateUtc.getUTCMonth() + 1,
      localDateUtc.getUTCDate(),
      0,
      0,
      0,
      timeZone,
    );
  }

  return targetAt;
}

function getTransitSnapshotCacheKey(
  kind: TransitSnapshotKind,
  bucketAt: Date,
  timeZone: string,
): string {
  return `transits.v2|${timeZone}|${kind}|${bucketAt.toISOString()}`;
}

function getNextSevenDaysRange(
  clientNow: Date,
  timeZone: string,
): { startsAt: Date; endsAt: Date; label: string } {
  const parts = getLocalDateParts(clientNow, timeZone);
  const startsAt = zonedTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);
  const endExclusive = zonedTimeToUtc(parts.year, parts.month, parts.day + 7, 0, 0, 0, timeZone);
  const endsAt = new Date(endExclusive.getTime() - 1);
  return {
    startsAt,
    endsAt,
    label: `${formatRangeDate(startsAt, timeZone)} - ${formatRangeDate(endsAt, timeZone)}`,
  };
}

const MONTHS_ES_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatWeekRangeEs(monday: Date, sunday: Date): string {
  const dM = monday.getUTCDate();
  const dS = sunday.getUTCDate();
  const mM = MONTHS_ES_SHORT[monday.getUTCMonth()];
  const mS = MONTHS_ES_SHORT[sunday.getUTCMonth()];
  const yM = monday.getUTCFullYear();
  const yS = sunday.getUTCFullYear();

  if (yM !== yS) {
    return `${dM} ${mM} ${yM} — ${dS} ${mS} ${yS}`;
  }
  if (mM !== mS) {
    return `${dM} ${mM} — ${dS} ${mS} · ${yS}`;
  }
  return `${dM} — ${dS} ${mS} · ${yS}`;
}

function getWeekRange(now: Date, timeZone?: string): string {
  const { year, month, day } = getLocalDateParts(now, timeZone);
  const localDateUtc = new Date(Date.UTC(year, month - 1, day));
  const monday = new Date(localDateUtc);
  monday.setUTCDate(localDateUtc.getUTCDate() - ((localDateUtc.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return formatWeekRangeEs(monday, sunday);
}
