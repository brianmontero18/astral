/**
 * Human Design Channels — fuente de verdad de los 36 canales.
 *
 * Compartido entre transit analysis, PDF validation, extraction y el system
 * prompt del chat (anti-alucinación: el LLM cita canales contra esta tabla,
 * no contra su prior probabilístico).
 *
 * Convención de id: "menor-mayor" (ej "1-8", no "8-1").
 */

export type HdCircuit = "Individual" | "Colectivo" | "Tribal";

export type HdSubCircuit =
  | "Knowing"
  | "Integration"
  | "Logic"
  | "Abstract"
  | "Ego"
  | "Defense";

export interface HdChannel {
  id: string;
  name: string;
  gates: [number, number];
  circuit: HdCircuit;
  subCircuit: HdSubCircuit;
}

export const HD_CHANNELS_FULL: ReadonlyArray<HdChannel> = [
  { id: "1-8",   name: "Canal de Inspiración",          gates: [1, 8],   circuit: "Individual", subCircuit: "Knowing" },
  { id: "2-14",  name: "Canal del Pulso",                gates: [2, 14],  circuit: "Individual", subCircuit: "Knowing" },
  { id: "3-60",  name: "Canal de la Mutación",           gates: [3, 60],  circuit: "Individual", subCircuit: "Knowing" },
  { id: "12-22", name: "Canal de la Apertura",           gates: [12, 22], circuit: "Individual", subCircuit: "Knowing" },
  { id: "23-43", name: "Canal de la Estructuración",     gates: [23, 43], circuit: "Individual", subCircuit: "Knowing" },
  { id: "24-61", name: "Canal del Conocimiento",         gates: [24, 61], circuit: "Individual", subCircuit: "Knowing" },
  { id: "25-51", name: "Canal de la Iniciación",         gates: [25, 51], circuit: "Individual", subCircuit: "Knowing" },
  { id: "28-38", name: "Canal de la Lucha",              gates: [28, 38], circuit: "Individual", subCircuit: "Knowing" },
  { id: "39-55", name: "Canal de la Emoción",            gates: [39, 55], circuit: "Individual", subCircuit: "Knowing" },

  { id: "10-20", name: "Canal del Despertar",            gates: [10, 20], circuit: "Individual", subCircuit: "Integration" },
  { id: "10-34", name: "Canal de la Exploración",        gates: [10, 34], circuit: "Individual", subCircuit: "Integration" },
  { id: "10-57", name: "Canal del Perfeccionismo",       gates: [10, 57], circuit: "Individual", subCircuit: "Integration" },
  { id: "20-34", name: "Canal de Carisma",               gates: [20, 34], circuit: "Individual", subCircuit: "Integration" },
  { id: "20-57", name: "Canal de la Mente Cerebral",     gates: [20, 57], circuit: "Individual", subCircuit: "Integration" },
  { id: "34-57", name: "Canal del Poder",                gates: [34, 57], circuit: "Individual", subCircuit: "Integration" },

  { id: "4-63",  name: "Canal de la Lógica",             gates: [4, 63],  circuit: "Colectivo",  subCircuit: "Logic" },
  { id: "5-15",  name: "Canal del Ritmo",                gates: [5, 15],  circuit: "Colectivo",  subCircuit: "Logic" },
  { id: "7-31",  name: "Canal del Alfa",                 gates: [7, 31],  circuit: "Colectivo",  subCircuit: "Logic" },
  { id: "9-52",  name: "Canal de la Concentración",      gates: [9, 52],  circuit: "Colectivo",  subCircuit: "Logic" },
  { id: "16-48", name: "Canal de la Longitud de Onda",   gates: [16, 48], circuit: "Colectivo",  subCircuit: "Logic" },
  { id: "17-62", name: "Canal de la Aceptación",         gates: [17, 62], circuit: "Colectivo",  subCircuit: "Logic" },
  { id: "18-58", name: "Canal de la Corrección",         gates: [18, 58], circuit: "Colectivo",  subCircuit: "Logic" },

  { id: "11-56", name: "Canal de la Curiosidad",         gates: [11, 56], circuit: "Colectivo",  subCircuit: "Abstract" },
  { id: "13-33", name: "Canal del Testimonio",           gates: [13, 33], circuit: "Colectivo",  subCircuit: "Abstract" },
  { id: "29-46", name: "Canal del Descubrimiento",       gates: [29, 46], circuit: "Colectivo",  subCircuit: "Abstract" },
  { id: "30-41", name: "Canal del Reconocimiento",       gates: [30, 41], circuit: "Colectivo",  subCircuit: "Abstract" },
  { id: "35-36", name: "Canal de lo Transitorio",        gates: [35, 36], circuit: "Colectivo",  subCircuit: "Abstract" },
  { id: "42-53", name: "Canal de la Madurez",            gates: [42, 53], circuit: "Colectivo",  subCircuit: "Abstract" },
  { id: "47-64", name: "Canal de la Abstracción",        gates: [47, 64], circuit: "Colectivo",  subCircuit: "Abstract" },

  { id: "19-49", name: "Canal de la Síntesis",           gates: [19, 49], circuit: "Tribal",     subCircuit: "Ego" },
  { id: "21-45", name: "Canal del Dinero",               gates: [21, 45], circuit: "Tribal",     subCircuit: "Ego" },
  { id: "26-44", name: "Canal de la Transmisión",        gates: [26, 44], circuit: "Tribal",     subCircuit: "Ego" },
  { id: "37-40", name: "Canal de la Comunidad",          gates: [37, 40], circuit: "Tribal",     subCircuit: "Ego" },

  { id: "6-59",  name: "Canal de Mating",                gates: [6, 59],  circuit: "Tribal",     subCircuit: "Defense" },
  { id: "27-50", name: "Canal de la Preservación",       gates: [27, 50], circuit: "Tribal",     subCircuit: "Defense" },
  { id: "32-54", name: "Canal de la Transformación",     gates: [32, 54], circuit: "Tribal",     subCircuit: "Defense" },
];

export const HD_CHANNELS: Record<string, string> = Object.fromEntries(
  HD_CHANNELS_FULL.map((c) => [c.id, c.name]),
);

export function findChannelsByGate(gate: number): HdChannel[] {
  return HD_CHANNELS_FULL.filter(
    (c) => c.gates[0] === gate || c.gates[1] === gate,
  );
}

export function findChannelByGates(a: number, b: number): HdChannel | undefined {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return HD_CHANNELS_FULL.find(
    (c) => c.gates[0] === lo && c.gates[1] === hi,
  );
}

export function findChannelById(id: string): HdChannel | undefined {
  return HD_CHANNELS_FULL.find((c) => c.id === id);
}

/**
 * Renders the canonical table as plain text for system-prompt injection.
 * Order matches HD_CHANNELS_FULL so the prompt cache stays warm.
 */
export function renderChannelsTable(): string {
  return HD_CHANNELS_FULL.map(
    (c) =>
      `- ${c.id}: ${c.name} (Puertas ${c.gates[0]} y ${c.gates[1]}, Circuito ${c.circuit}/${c.subCircuit})`,
  ).join("\n");
}
