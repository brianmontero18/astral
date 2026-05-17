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

const HD_DESIGN_OFFSET_DEGREES = 88;

export interface BirthData {
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Local time HH:mm 24h. */
  time: string;
  /** UTC offset in hours, e.g. -3 for Argentina, 5.5 for India. */
  timezoneOffsetHours: number;
  /** Optional display only — not used in calculation. */
  placeLabel?: string;
  /** Optional name to put in profile.name. Otherwise empty string. */
  name?: string;
}

type Side = "personality" | "design";

interface ComputedGate {
  number: number;
  line: number;
  planet: string;
  isPersonality: boolean;
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

  const out: ComputedGate[] = [];
  for (const side of ["design", "personality"] as Side[]) {
    const jd = side === "design" ? designJd : personalityJd;
    for (const body of HD_BODIES) {
      let lon: number;
      if (body === "Earth") {
        const r = swe.calc_ut(jd, swe.SE_SUN, swe.SEFLG_SWIEPH);
        lon = normLon(r[0] + 180);
      } else if (body === "South Node") {
        const r = swe.calc_ut(jd, swe.SE_TRUE_NODE, swe.SEFLG_SWIEPH);
        lon = normLon(r[0] + 180);
      } else {
        const r = swe.calc_ut(jd, ids[body]!, swe.SEFLG_SWIEPH);
        lon = normLon(r[0]);
      }
      const { gate, line } = degreeToGate(lon);
      out.push({
        number: gate,
        line,
        planet: body,
        isPersonality: side === "personality",
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

  const undefinedCenters = ALL_CENTERS.filter((c) => !definedCenters.includes(c));

  const channels = channelIds.map((id) => ({
    id,
    name: HD_CHANNELS[id] ?? "",
    circuit: "",
  }));

  const result: UserProfile = {
    name: birth.name ?? "",
    humanDesign: {
      type,
      strategy: "",
      authority,
      profile,
      definition,
      incarnationCross: "",
      notSelfTheme: "",
      variable: "",
      digestion: "",
      environment: "",
      strongestSense: "",
      channels,
      activatedGates: gates,
      definedCenters,
      undefinedCenters,
    },
  };

  return deriveImpliedFields(result);
}
