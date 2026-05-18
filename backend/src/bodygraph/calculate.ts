/**
 * Cálculo de Human Design bodygraph desde birth data.
 *
 * Reemplaza la necesidad de subir un PDF: dado date + time + timezone
 * offset, calculamos el bodygraph entero de forma determinística usando
 * Swiss Ephemeris (mismas fórmulas que usan MyHumanDesign, Genetic
 * Matrix, Jovian Archive — es astronomía + tabla I-Ching, no magia).
 *
 * Validado contra 2 PDFs reales (Agos 1988-12-28 06:13 UTC y Brian
 * 1989-02-18 12:00 UTC): 26/26 gates correctos en ambos casos.
 *
 * Offset Design: 88° exactos. Confirmado empíricamente contra el formato
 * de Genetic Matrix. El canon de Ra Uru Hu publica 88°20' pero el output
 * real de Genetic Matrix usa 88° (la diferencia importa para la línea
 * de algunos planetas rápidos como la Luna).
 */
import SwissEph from "swisseph-wasm";
import type { UserProfile } from "../agent-service.js";
import { HD_CHANNELS } from "../hd-channels.js";
import { degreeToGate, GATE_TO_CENTER } from "../hd-gates.js";
import { deriveImpliedFields } from "../extraction-service.js";
import { lookupFixingState } from "../hd-fixings.js";
import { lookupIncarnationCross } from "../hd-crosses.js";
import { computeVariableLabels } from "../hd-variable-labels.js";
import {
  lookupProfileName,
  lookupPositiveTheme,
  lookupTypeQualifier,
  calcAgeYears,
  toneToOrientation,
} from "../hd-meta.js";
import type { HdVariable } from "../agent-service.js";

const HD_DESIGN_OFFSET_DEGREES = 88;

export interface BirthData {
  /** ISO yyyy-mm-dd. Local date at birth place. */
  date: string;
  /** Local time HH:mm 24h. */
  time: string;
  /** UTC offset in hours, e.g. -3 for Argentina, 5.5 for India. */
  timezoneOffsetHours: number;
  /** Optional display label — not used in astronomy. */
  placeLabel?: string;
  /** Optional geographic coordinates — reserved for future timezone DB lookups. */
  coordinates?: { lat: number; lon: number };
  /** Optional name to put in profile.name. Otherwise empty string. */
  name?: string;
}

/** Build an ISO 8601 string with explicit offset from local date+time+tz. */
function buildLocalIso(date: string, time: string, tzHours: number): string {
  const abs = Math.abs(tzHours);
  const hh = String(Math.floor(abs)).padStart(2, "0");
  const mm = String(Math.round((abs - Math.floor(abs)) * 60)).padStart(2, "0");
  const sign = tzHours >= 0 ? "+" : "-";
  return `${date}T${time}:00${sign}${hh}:${mm}`;
}

/** Convert a Julian Day (UT) to an ISO 8601 string in UTC. */
function julianDayToIsoUtc(jd: number): string {
  // JD 2440587.5 = 1970-01-01T00:00:00Z (Unix epoch).
  const ms = (jd - 2440587.5) * 86400000;
  return new Date(ms).toISOString();
}

/**
 * Build an `HdVariable` from a planet's activation. The canonical assignment
 * per SharpAstrology.HumanDesign DataModels/HumanDesignChart.cs `_Variables()`
 * is: Digestion=Design.Sun, Awareness=Personality.Sun,
 *     Environment=Design.NorthNode, Perspective=Personality.NorthNode.
 *
 * The activation must come from `computeAllGates` and must have color/tone/
 * base populated (otherwise undefined, which throws).
 */
function variableFromGate(gate: ComputedGate | undefined, where: string): HdVariable {
  if (!gate) throw new Error(`variableFromGate: missing activation for ${where}`);
  return {
    orientation: toneToOrientation(gate.tone),
    color: gate.color,
    tone: gate.tone,
    base: gate.base,
  };
}

type Side = "personality" | "design";

interface ComputedGate {
  number: number;
  line: number;
  color: number;
  tone: number;
  base: number;
  planet: string;
  isPersonality: boolean;
  isRetrograde: boolean;
  fixingState: "exalted" | "detriment" | null;
}

interface Swe {
  initSwissEph(): Promise<void>;
  julday(y: number, m: number, d: number, hourDecimal: number): number;
  calc_ut(jd: number, planet: number, flag: number): number[];
  SE_SUN: number;
  SE_MOON: number;
  SE_MERCURY: number;
  SE_VENUS: number;
  SE_MARS: number;
  SE_JUPITER: number;
  SE_SATURN: number;
  SE_URANUS: number;
  SE_NEPTUNE: number;
  SE_PLUTO: number;
  SE_TRUE_NODE: number;
  SEFLG_SWIEPH: number;
  SEFLG_SPEED: number;
}

const HD_BODIES = [
  "Sun", "Earth", "North Node", "South Node", "Moon",
  "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
  "Uranus", "Neptune", "Pluto",
] as const;

function normLon(lon: number): number {
  return ((lon % 360) + 360) % 360;
}

function birthToUtcJulianDay(swe: Swe, birth: BirthData): number {
  const [y, m, d] = birth.date.split("-").map(Number);
  const [hh, mm] = birth.time.split(":").map(Number);
  const localHourDec = hh + mm / 60;
  // Convert local → UTC: subtract the offset (positive offset = east of UTC).
  const utcHourDec = localHourDec - birth.timezoneOffsetHours;
  return swe.julday(y, m, d, utcHourDec);
}

async function findDesignJd(swe: Swe, personalityJd: number): Promise<number> {
  const sunBirth = swe.calc_ut(personalityJd, swe.SE_SUN, swe.SEFLG_SWIEPH);
  const birthSunLon = normLon(sunBirth[0]);
  const target = normLon(birthSunLon - HD_DESIGN_OFFSET_DEGREES);

  let jd = personalityJd - 88.5;
  for (let i = 0; i < 30; i++) {
    const r = swe.calc_ut(jd, swe.SE_SUN, swe.SEFLG_SWIEPH | swe.SEFLG_SPEED);
    const lon = normLon(r[0]);
    const speed = r[3];
    let diff = lon - target;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) < 1e-7) break;
    if (speed === 0) break;
    jd -= diff / speed;
  }
  return jd;
}

function computeAllGates(swe: Swe, personalityJd: number, designJd: number): ComputedGate[] {
  const ids: Record<string, number | null> = {
    Sun: swe.SE_SUN, Moon: swe.SE_MOON, Mercury: swe.SE_MERCURY,
    Venus: swe.SE_VENUS, Mars: swe.SE_MARS, Jupiter: swe.SE_JUPITER,
    Saturn: swe.SE_SATURN, Uranus: swe.SE_URANUS, Neptune: swe.SE_NEPTUNE,
    Pluto: swe.SE_PLUTO, "North Node": swe.SE_TRUE_NODE,
    Earth: null,
    "South Node": null,
  };

  // SEFLG_SPEED expone la velocidad eclíptica (índice 3 del result). Necesaria
  // para detectar retrogradación (velocity < 0 = movimiento aparente retrógrado).
  const flag = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;

  const out: ComputedGate[] = [];
  for (const side of ["design", "personality"] as Side[]) {
    const jd = side === "design" ? designJd : personalityJd;
    for (const body of HD_BODIES) {
      let lon: number;
      let isRetrograde: boolean;
      if (body === "Earth") {
        // Earth = Sun + 180°. Heliocéntricamente nunca "retrograda".
        const r = swe.calc_ut(jd, swe.SE_SUN, flag);
        lon = normLon(r[0] + 180);
        isRetrograde = false;
      } else if (body === "South Node") {
        // Antipodal del North Node. Comparte estado retro.
        const r = swe.calc_ut(jd, swe.SE_TRUE_NODE, flag);
        lon = normLon(r[0] + 180);
        isRetrograde = r[3] < 0;
      } else {
        const r = swe.calc_ut(jd, ids[body]!, flag);
        lon = normLon(r[0]);
        isRetrograde = r[3] < 0;
      }
      const { gate, line, color, tone, base } = degreeToGate(lon);
      out.push({
        number: gate,
        line,
        color,
        tone,
        base,
        planet: body,
        isPersonality: side === "personality",
        isRetrograde,
        fixingState: lookupFixingState(body, gate, line),
      });
    }
  }
  return out;
}

// ─── Derive channels and centers from gates ──────────────────────────────────

function deriveStructure(gates: ComputedGate[]) {
  const gateSet = new Set(gates.map((g) => g.number));
  const channelIds: string[] = [];
  const definedCenters = new Set<string>();

  for (const pair of Object.keys(HD_CHANNELS)) {
    const [g1, g2] = pair.split("-").map(Number);
    if (gateSet.has(g1) && gateSet.has(g2)) {
      channelIds.push(pair);
      definedCenters.add(GATE_TO_CENTER[g1]);
      definedCenters.add(GATE_TO_CENTER[g2]);
    }
  }

  // Adjacency graph between defined centers, via channels.
  const adj = new Map<string, Set<string>>();
  for (const c of definedCenters) adj.set(c, new Set());
  for (const pair of channelIds) {
    const [g1, g2] = pair.split("-").map(Number);
    const c1 = GATE_TO_CENTER[g1];
    const c2 = GATE_TO_CENTER[g2];
    if (c1 !== c2) {
      adj.get(c1)!.add(c2);
      adj.get(c2)!.add(c1);
    }
  }

  // Connected components.
  const visited = new Set<string>();
  const components: Array<Set<string>> = [];
  for (const c of definedCenters) {
    if (visited.has(c)) continue;
    const comp = new Set<string>();
    const stack = [c];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      comp.add(cur);
      for (const n of adj.get(cur) ?? []) stack.push(n);
    }
    components.push(comp);
  }

  return {
    channelIds,
    definedCenters: [...definedCenters],
    components,
  };
}

const MOTOR_CENTERS = new Set(["Sacral", "SolarPlexus", "Heart", "Root"]);
const ALL_CENTERS = [
  "Head", "Ajna", "Throat", "G", "Heart",
  "Spleen", "Sacral", "SolarPlexus", "Root",
] as const;

function deriveType(definedCenters: string[], components: Array<Set<string>>): string {
  if (definedCenters.length === 0) return "Reflector";
  const hasSacral = definedCenters.includes("Sacral");
  const hasMotorToThroat = components.some((comp) => {
    if (!comp.has("Throat")) return false;
    for (const c of comp) {
      if (MOTOR_CENTERS.has(c)) return true;
    }
    return false;
  });
  if (hasSacral && hasMotorToThroat) return "Manifesting Generator";
  if (hasSacral) return "Generator";
  if (hasMotorToThroat) return "Manifestor";
  return "Projector";
}

// Spanish canonical type names (consistent with HD_TYPE_MAP in extraction-service).
const TYPE_ES: Record<string, string> = {
  Reflector: "Reflector",
  Generator: "Generador",
  "Manifesting Generator": "Generador Manifestante",
  Manifestor: "Manifestador",
  Projector: "Proyector",
};

function deriveAuthority(
  type: string,
  definedCenters: string[],
  components: Array<Set<string>>,
): string {
  if (type === "Reflector") return "Lunar";

  // Order matters: jerarquía HD canónica.
  if (definedCenters.includes("SolarPlexus")) return "Emocional (Plexo Solar)";
  if (definedCenters.includes("Sacral")) return "Sacral";
  if (definedCenters.includes("Spleen")) return "Esplénica";
  if (definedCenters.includes("Heart")) return "Ego/Corazón";

  // Projector without inner motor:
  if (definedCenters.includes("G")) {
    // Self-Projected requires G connected to Throat in the same component.
    for (const comp of components) {
      if (comp.has("G") && comp.has("Throat")) return "Auto-proyectada";
    }
  }
  return "Mental/Ambiente";
}

const DEFINITION_NAMES: Record<number, string> = {
  0: "Sin definición",
  1: "Definición simple",
  2: "Definición dividida",
  3: "Definición triple dividida",
  4: "Definición cuádruple dividida",
};

function deriveProfile(gates: ComputedGate[]): string {
  const sunP = gates.find((g) => g.planet === "Sun" && g.isPersonality);
  const sunD = gates.find((g) => g.planet === "Sun" && !g.isPersonality);
  if (!sunP || !sunD) return "";
  return `${sunP.line}/${sunD.line}`;
}

let cachedSwe: Swe | null = null;
async function getSwe(): Promise<Swe> {
  if (cachedSwe) return cachedSwe;
  const swe = new SwissEph() as unknown as Swe;
  await swe.initSwissEph();
  cachedSwe = swe;
  return swe;
}

export async function calculateBodygraph(birth: BirthData): Promise<UserProfile> {
  const swe = await getSwe();
  const personalityJd = birthToUtcJulianDay(swe, birth);
  const designJd = await findDesignJd(swe, personalityJd);
  const gates = computeAllGates(swe, personalityJd, designJd);
  const { channelIds, definedCenters, components } = deriveStructure(gates);

  const typeEn = deriveType(definedCenters, components);
  const type = TYPE_ES[typeEn] ?? typeEn;
  const authority = deriveAuthority(typeEn, definedCenters, components);
  const definition = DEFINITION_NAMES[components.length] ?? `${components.length} grupos`;
  const profile = deriveProfile(gates);
  const profileName = lookupProfileName(profile);
  const typeQualifier = lookupTypeQualifier(authority);
  const positiveTheme = lookupPositiveTheme(type);
  const personalitySunGate = gates.find((g) => g.planet === "Sun" && g.isPersonality)?.number ?? 0;
  const incarnationCross = lookupIncarnationCross(personalitySunGate, profile);

  const undefinedCenters = ALL_CENTERS.filter((c) => !definedCenters.includes(c));

  const channels = channelIds.map((id) => ({
    id,
    name: HD_CHANNELS[id] ?? "",
    circuit: "",
  }));

  const dateLocalIso = buildLocalIso(birth.date, birth.time, birth.timezoneOffsetHours);
  const dateUtcIso = new Date(dateLocalIso).toISOString();
  const designDateIso = julianDayToIsoUtc(designJd);
  const ageYears = calcAgeYears(dateUtcIso);

  // Variables canonical (per SharpAstrology HumanDesignChart._Variables).
  const findGate = (planet: string, isPersonality: boolean) =>
    gates.find((g) => g.planet === planet && g.isPersonality === isPersonality);
  const variables = {
    digestion:   variableFromGate(findGate("Sun", false),         "Design.Sun"),
    awareness:   variableFromGate(findGate("Sun", true),          "Personality.Sun"),
    environment: variableFromGate(findGate("North Node", false),  "Design.NorthNode"),
    perspective: variableFromGate(findGate("North Node", true),   "Personality.NorthNode"),
  };
  const variableLabels = computeVariableLabels(variables);

  const result: UserProfile = {
    name: birth.name ?? "",
    birthData: {
      dateLocalIso,
      dateUtcIso,
      placeLabel: birth.placeLabel ?? "",
      coordinates: birth.coordinates,
      timezoneOffsetHours: birth.timezoneOffsetHours,
      ageYears,
    },
    humanDesign: {
      type,
      typeQualifier,
      strategy: "",
      authority,
      profile,
      profileName,
      definition,
      incarnationCross,
      themes: { positive: positiveTheme, notSelf: "" },
      notSelfTheme: "",
      variable: "",
      digestion: "",
      environment: "",
      strongestSense: "",
      design: { date: designDateIso },
      variables,
      variableLabels,
      channels,
      activatedGates: gates,
      definedCenters,
      undefinedCenters,
    },
  };

  const enriched = deriveImpliedFields(result);
  // Sync themes.notSelf with the legacy notSelfTheme that deriveImpliedFields populates.
  if (enriched.humanDesign.themes) {
    enriched.humanDesign.themes.notSelf = enriched.humanDesign.notSelfTheme;
  }
  return enriched;
}
