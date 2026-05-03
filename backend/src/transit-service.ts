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

  // Detect full channels activated by transiting planets
  const activeGates = new Set(planets.map(p => p.hdGate));
  const activatedChannels: string[] = [];

  for (const [pair, channelName] of Object.entries(HD_CHANNELS)) {
    const [g1, g2] = pair.split("-").map(Number);
    if (activeGates.has(g1) && activeGates.has(g2)) {
      activatedChannels.push(channelName);
    }
  }

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
