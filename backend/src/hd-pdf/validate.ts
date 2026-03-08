import type { UserProfile } from "../agent-service.js";
import { HD_CHANNELS } from "../hd-channels.js";
import { GATE_TO_CENTER } from "../hd-gates.js";

const ALL_CENTERS = [
  "Head",
  "Ajna",
  "Throat",
  "G",
  "Heart",
  "Spleen",
  "Sacral",
  "SolarPlexus",
  "Root",
] as const;

type ActivatedGate = UserProfile["humanDesign"]["activatedGates"][number];

type DerivedHdInfo = {
  channelIds: string[];
  definedCenters: string[];
  undefinedCenters: string[];
};

function assertIntegerInRange(
  value: number,
  min: number,
  max: number,
  label: string,
  provider: string,
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `${provider} PDF: invalid ${label} ${value} (expected ${min}-${max})`,
    );
  }
}

function validatePlanetCounts(
  gates: ActivatedGate[],
  expectedPlanets: readonly string[],
  provider: string,
): void {
  const personality = gates.filter(g => g.isPersonality);
  const design = gates.filter(g => !g.isPersonality);

  if (personality.length !== 13 || design.length !== 13) {
    throw new Error(
      `${provider} PDF: expected 13 personality + 13 design gates, got ${personality.length} + ${design.length}`,
    );
  }

  const countByPlanet = (subset: ActivatedGate[]) => {
    const counts = new Map<string, number>();
    for (const gate of subset) {
      if (!expectedPlanets.includes(gate.planet)) {
        throw new Error(`${provider} PDF: invalid planet ${gate.planet}`);
      }
      counts.set(gate.planet, (counts.get(gate.planet) ?? 0) + 1);
    }
    return counts;
  };

  const personalityCounts = countByPlanet(personality);
  const designCounts = countByPlanet(design);

  for (const planet of expectedPlanets) {
    const personalityCount = personalityCounts.get(planet) ?? 0;
    const designCount = designCounts.get(planet) ?? 0;
    if (personalityCount !== 1 || designCount !== 1) {
      throw new Error(
        `${provider} PDF: expected exactly one ${planet} gate on each side`,
      );
    }
  }
}

export function deriveChannelsAndCenters(gates: ActivatedGate[], provider: string): DerivedHdInfo {
  const gateSet = new Set(gates.map(g => g.number));
  const channelIds: string[] = [];
  const definedCenterSet = new Set<string>();

  for (const [pair] of Object.entries(HD_CHANNELS)) {
    const [g1Raw, g2Raw] = pair.split("-");
    const g1 = Number(g1Raw);
    const g2 = Number(g2Raw);
    if (!Number.isInteger(g1) || !Number.isInteger(g2)) {
      throw new Error(`${provider} PDF: invalid channel id ${pair}`);
    }

    if (gateSet.has(g1) && gateSet.has(g2)) {
      channelIds.push(pair);
      const c1 = GATE_TO_CENTER[g1];
      const c2 = GATE_TO_CENTER[g2];
      if (!c1 || !c2) {
        throw new Error(`${provider} PDF: channel centers missing for ${pair}`);
      }
      definedCenterSet.add(c1);
      definedCenterSet.add(c2);
    }
  }

  const definedCenters = Array.from(definedCenterSet);
  const undefinedCenters = ALL_CENTERS.filter(c => !definedCenterSet.has(c));

  if (definedCenters.length + undefinedCenters.length !== ALL_CENTERS.length) {
    throw new Error(`${provider} PDF: center consistency check failed`);
  }

  return { channelIds, definedCenters, undefinedCenters };
}

export function validateActivatedGates(
  gates: ActivatedGate[],
  expectedPlanets: readonly string[],
  provider: string,
): void {
  if (gates.length !== 26) {
    throw new Error(`${provider} PDF: expected 26 gate.line values, got ${gates.length}`);
  }

  for (const gate of gates) {
    assertIntegerInRange(gate.number, 1, 64, "gate", provider);
    assertIntegerInRange(gate.line, 1, 6, "line", provider);
    if (!GATE_TO_CENTER[gate.number]) {
      throw new Error(`${provider} PDF: gate ${gate.number} missing center mapping`);
    }
  }

  validatePlanetCounts(gates, expectedPlanets, provider);
  deriveChannelsAndCenters(gates, provider);
}
