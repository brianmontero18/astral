/**
 * HD Tools — capabilities deterministas para el chat agent.
 *
 * Expone la tabla canónica de Diseño Humano como tools que el LLM consulta
 * antes de afirmar relaciones puerta-canal o puerta-centro. Diseño anti-
 * alucinación: el LLM nunca debe afirmar HD desde su prior probabilístico;
 * siempre consulta la tabla.
 *
 * Cada tool envuelve un helper puro que ya existe en `hd-channels.ts` y
 * `hd-gates.ts` — la tool no introduce lógica nueva, solo expone la capability
 * al loop del modelo via Vercel AI SDK.
 */

import { tool } from "ai";
import { z } from "zod";

import {
  findChannelByGates,
  findChannelsByGate,
  findChannelById,
  HD_CHANNELS_FULL,
  type HdChannel,
} from "../hd-channels.js";
import { GATE_TO_CENTER } from "../hd-gates.js";

const gateSchema = z
  .number()
  .int()
  .min(1)
  .max(64)
  .describe("Número de puerta HD entre 1 y 64");

const channelIdSchema = z
  .string()
  .regex(/^\d{1,2}-\d{1,2}$/)
  .describe(
    'Id canónico del canal en formato "menor-mayor" (ej "1-8", "20-34"). ' +
      "El primer número debe ser menor que el segundo.",
  );

export const findChannelByGatesTool = tool({
  description:
    "Devuelve el canal HD que une dos puertas específicas. " +
    "USAR SIEMPRE antes de afirmar que dos puertas forman un canal. " +
    "Retorna undefined si las dos puertas NO forman un canal en la tabla canónica.",
  inputSchema: z.object({
    gateA: gateSchema,
    gateB: gateSchema,
  }),
  execute: async ({ gateA, gateB }): Promise<HdChannel | null> => {
    return findChannelByGates(gateA, gateB) ?? null;
  },
});

export const findChannelsByGateTool = tool({
  description:
    "Lista TODOS los canales HD que contienen una puerta específica. " +
    "USAR SIEMPRE antes de afirmar que una puerta forma parte de un canal. " +
    "Una puerta forma exclusivamente los canales devueltos por esta tool — ningún otro. " +
    "Retorna array vacío si la puerta no participa de ningún canal (caso raro).",
  inputSchema: z.object({
    gate: gateSchema,
  }),
  execute: async ({ gate }): Promise<HdChannel[]> => {
    return findChannelsByGate(gate);
  },
});

export const findChannelByIdTool = tool({
  description:
    'Resuelve un canal HD a partir de su id canónico (ej "1-8", "20-34"). ' +
    "Devuelve nombre, puertas y circuito del canal. Retorna null si el id no existe.",
  inputSchema: z.object({
    id: channelIdSchema,
  }),
  execute: async ({ id }): Promise<HdChannel | null> => {
    return findChannelById(id) ?? null;
  },
});

export const getCenterForGateTool = tool({
  description:
    "Devuelve a qué centro HD pertenece una puerta específica. " +
    "Los centros válidos son: G, Throat, Sacral, SolarPlexus, Root, Heart, Head, Ajna, Spleen. " +
    "USAR antes de afirmar que una puerta está en un centro determinado. " +
    "Retorna null si la puerta no existe (fuera del rango 1-64).",
  inputSchema: z.object({
    gate: gateSchema,
  }),
  execute: async ({ gate }): Promise<string | null> => {
    return GATE_TO_CENTER[gate] ?? null;
  },
});

export const listAllChannelsTool = tool({
  description:
    "Devuelve la tabla canónica completa de los 36 canales HD. " +
    "Útil cuando el usuario pregunta por un canal por nombre y no por id, o cuando " +
    "se necesita razonar sobre múltiples canales a la vez. Si solo necesitás un canal " +
    "puntual, preferí findChannelByGates o findChannelById para no inflar el contexto.",
  inputSchema: z.object({}),
  execute: async (): Promise<readonly HdChannel[]> => {
    return HD_CHANNELS_FULL;
  },
});

/**
 * Conjunto de tools listo para registrar en `streamText({ tools: hdTools })`.
 * Las keys son los nombres que el modelo verá. Mantener stable — el modelo
 * los aprende del system prompt.
 */
export const hdTools = {
  findChannelByGates: findChannelByGatesTool,
  findChannelsByGate: findChannelsByGateTool,
  findChannelById: findChannelByIdTool,
  getCenterForGate: getCenterForGateTool,
  listAllChannels: listAllChannelsTool,
};

export type HdToolName = keyof typeof hdTools;
