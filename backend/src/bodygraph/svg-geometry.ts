/**
 * Geometría del bodygraph: posiciones, formas y paths de los canales.
 *
 * Portado de CReizner/SharpAstrology.HumanDesign.BlazorComponents (MIT)
 * HumanDesignGraph.razor. Mantiene el mismo sistema de coordenadas
 * normalizado (viewBox 0..1 wide × 0..1.5 tall) — escalá afuera si querés
 * otras dimensiones.
 *
 * Las coordenadas de gates están en "local del centro" (top-left + size en
 * un viewBox 0..1, excepto Head/Ajna que tienen viewBox 0..0.75 de alto).
 * `gatePoint(num)` las transforma a globales.
 *
 * Nota arquitectural: este módulo lista los 64 gate numbers y los 36
 * channel ids en sus tablas internas (necesario para asociar coordenadas).
 * Esos ids deben matchear `hd-gates.ts` y `hd-channels.ts` (capa de canon
 * HD). Si HD agrega/quita algún canal, hay que actualizar ambos lados.
 */
import { GATE_TO_CENTER } from "../hd-gates.js";

// ─── Centers ────────────────────────────────────────────────────────────────

export type CenterId =
  | "Head" | "Ajna" | "Throat" | "G"
  | "Heart" | "SolarPlexus" | "Spleen"
  | "Sacral" | "Root";

export type CenterShape =
  | "triangleUp"        // Head: punta arriba, base abajo
  | "triangleDown"      // Ajna: base arriba, punta abajo
  | "roundedRect"       // Throat, Sacral, Root
  | "diamond"           // G
  | "triangleHeart"     // (0,0.8) (0.8,0) (1,1) — apunta hacia abajo-derecha
  | "triangleEmotion"   // (1,0) (1,1) (0.2,0.5) — apunta a la izquierda
  | "triangleSpleen";   // (0,0) (0,1) (0.8,0.5) — apunta a la derecha

export interface CenterDef {
  id: CenterId;
  /** Top-left x in the outer viewBox (0..1 horizontal). */
  x: number;
  /** Top-left y in the outer viewBox (0..1.5 vertical). */
  y: number;
  /** Width in outer viewBox units. */
  w: number;
  /** Height in outer viewBox units. */
  h: number;
  /**
   * Local viewBox height the center uses internally for gate placement.
   * For Head/Ajna this is 0.75 (their razor sub-svg is 0..1 wide × 0..0.75 tall).
   * For the rest it's 1.0.
   */
  localH: number;
  shape: CenterShape;
}

export const CENTERS: Record<CenterId, CenterDef> = {
  Head:        { id: "Head",        x: 0.40, y: 0.000, w: 0.20, h: 0.15, localH: 0.75, shape: "triangleUp" },
  Ajna:        { id: "Ajna",        x: 0.40, y: 0.200, w: 0.20, h: 0.15, localH: 0.75, shape: "triangleDown" },
  Throat:      { id: "Throat",      x: 0.40, y: 0.425, w: 0.20, h: 0.20, localH: 1.00, shape: "roundedRect" },
  G:           { id: "G",           x: 0.40, y: 0.710, w: 0.20, h: 0.20, localH: 1.00, shape: "diamond" },
  Heart:       { id: "Heart",       x: 0.62, y: 0.820, w: 0.15, h: 0.15, localH: 1.00, shape: "triangleHeart" },
  SolarPlexus: { id: "SolarPlexus", x: 0.75, y: 0.900, w: 0.25, h: 0.25, localH: 1.00, shape: "triangleEmotion" },
  Spleen:      { id: "Spleen",      x: 0.00, y: 0.900, w: 0.25, h: 0.25, localH: 1.00, shape: "triangleSpleen" },
  Sacral:      { id: "Sacral",      x: 0.40, y: 1.000, w: 0.20, h: 0.20, localH: 1.00, shape: "roundedRect" },
  Root:        { id: "Root",        x: 0.40, y: 1.310, w: 0.20, h: 0.20, localH: 1.00, shape: "roundedRect" },
};

// ─── Gates ──────────────────────────────────────────────────────────────────
// Position (top-left + size) of each gate's local sub-svg inside its center's
// local viewBox. Source: HumanDesignGraph.razor (raw transcription).

interface GateLocal {
  tlx: number;
  tly: number;
  w: number;
  h: number;
}

const GATE_LOCAL: Record<number, GateLocal> = {
  // Head
  64: { tlx: 0.15, tly: 0.50,  w: 0.20,    h: 0.2666 },
  61: { tlx: 0.40, tly: 0.50,  w: 0.20,    h: 0.2666 },
  63: { tlx: 0.65, tly: 0.50,  w: 0.20,    h: 0.2666 },
  // Ajna
  47: { tlx: 0.15, tly: -0.05, w: 0.20,    h: 0.2666 },
  24: { tlx: 0.40, tly: -0.05, w: 0.20,    h: 0.2666 },
  4:  { tlx: 0.65, tly: -0.05, w: 0.20,    h: 0.2666 },
  43: { tlx: 0.40, tly:  0.45, w: 0.20,    h: 0.2666 },
  17: { tlx: 0.25, tly:  0.23, w: 0.20,    h: 0.2666 },
  11: { tlx: 0.55, tly:  0.23, w: 0.20,    h: 0.2666 },
  // Throat
  56: { tlx: 0.65, tly: 0.00,  w: 0.20,    h: 0.20 },
  23: { tlx: 0.40, tly: 0.00,  w: 0.20,    h: 0.20 },
  62: { tlx: 0.15, tly: 0.00,  w: 0.20,    h: 0.20 },
  33: { tlx: 0.65, tly: 0.80,  w: 0.20,    h: 0.20 },
  8:  { tlx: 0.40, tly: 0.80,  w: 0.20,    h: 0.20 },
  31: { tlx: 0.15, tly: 0.80,  w: 0.20,    h: 0.20 },
  16: { tlx: 0.00, tly: 0.20,  w: 0.20,    h: 0.20 },
  20: { tlx: 0.00, tly: 0.60,  w: 0.20,    h: 0.20 },
  45: { tlx: 0.80, tly: 0.60,  w: 0.20,    h: 0.20 },
  35: { tlx: 0.80, tly: 0.20,  w: 0.20,    h: 0.20 },
  12: { tlx: 0.80, tly: 0.40,  w: 0.20,    h: 0.20 },
  // G (Self)
  2:  { tlx: 0.40, tly: 0.75,  w: 0.20,    h: 0.20 },
  1:  { tlx: 0.40, tly: 0.05,  w: 0.20,    h: 0.20 },
  13: { tlx: 0.57, tly: 0.22,  w: 0.20,    h: 0.20 },
  46: { tlx: 0.57, tly: 0.58,  w: 0.20,    h: 0.20 },
  25: { tlx: 0.75, tly: 0.40,  w: 0.20,    h: 0.20 },
  7:  { tlx: 0.22, tly: 0.22,  w: 0.20,    h: 0.20 },
  15: { tlx: 0.22, tly: 0.58,  w: 0.20,    h: 0.20 },
  10: { tlx: 0.05, tly: 0.40,  w: 0.20,    h: 0.20 },
  // Heart
  26: { tlx: 0.15, tly: 0.59,  w: 0.2666,  h: 0.2666 },
  51: { tlx: 0.37, tly: 0.37,  w: 0.2666,  h: 0.2666 },
  21: { tlx: 0.58, tly: 0.15,  w: 0.2666,  h: 0.2666 },
  40: { tlx: 0.70, tly: 0.70,  w: 0.2666,  h: 0.2666 },
  // Solar Plexus (Emotion)
  30: { tlx: 0.80, tly: 0.74,  w: 0.16,    h: 0.16 },
  55: { tlx: 0.63, tly: 0.63,  w: 0.16,    h: 0.16 },
  49: { tlx: 0.45, tly: 0.52,  w: 0.16,    h: 0.16 },
  6:  { tlx: 0.29, tly: 0.415, w: 0.16,    h: 0.16 },
  37: { tlx: 0.45, tly: 0.32,  w: 0.16,    h: 0.16 },
  22: { tlx: 0.63, tly: 0.21,  w: 0.16,    h: 0.16 },
  36: { tlx: 0.80, tly: 0.10,  w: 0.16,    h: 0.16 },
  // Spleen
  18: { tlx: 0.05, tly: 0.75,  w: 0.16,    h: 0.16 },
  48: { tlx: 0.05, tly: 0.10,  w: 0.16,    h: 0.16 },
  28: { tlx: 0.20, tly: 0.65,  w: 0.16,    h: 0.16 },
  57: { tlx: 0.20, tly: 0.20,  w: 0.16,    h: 0.16 },
  32: { tlx: 0.37, tly: 0.55,  w: 0.16,    h: 0.16 },
  44: { tlx: 0.37, tly: 0.30,  w: 0.16,    h: 0.16 },
  50: { tlx: 0.53, tly: 0.41,  w: 0.16,    h: 0.16 },
  // Sacral
  29: { tlx: 0.65, tly: 0.00,  w: 0.20,    h: 0.20 },
  14: { tlx: 0.40, tly: 0.00,  w: 0.20,    h: 0.20 },
  5:  { tlx: 0.15, tly: 0.00,  w: 0.20,    h: 0.20 },
  9:  { tlx: 0.65, tly: 0.80,  w: 0.20,    h: 0.20 },
  3:  { tlx: 0.40, tly: 0.80,  w: 0.20,    h: 0.20 },
  42: { tlx: 0.15, tly: 0.80,  w: 0.20,    h: 0.20 },
  34: { tlx: 0.00, tly: 0.20,  w: 0.20,    h: 0.20 },
  27: { tlx: 0.00, tly: 0.60,  w: 0.20,    h: 0.20 },
  59: { tlx: 0.80, tly: 0.60,  w: 0.20,    h: 0.20 },
  // Root
  19: { tlx: 0.80, tly: 0.20,  w: 0.20,    h: 0.20 },
  39: { tlx: 0.80, tly: 0.45,  w: 0.20,    h: 0.20 },
  41: { tlx: 0.80, tly: 0.70,  w: 0.20,    h: 0.20 },
  52: { tlx: 0.65, tly: 0.00,  w: 0.20,    h: 0.20 },
  60: { tlx: 0.40, tly: 0.00,  w: 0.20,    h: 0.20 },
  53: { tlx: 0.15, tly: 0.00,  w: 0.20,    h: 0.20 },
  54: { tlx: 0.00, tly: 0.20,  w: 0.20,    h: 0.20 },
  38: { tlx: 0.00, tly: 0.45,  w: 0.20,    h: 0.20 },
  58: { tlx: 0.00, tly: 0.70,  w: 0.20,    h: 0.20 },
};

export interface GatePoint {
  num: number;
  center: CenterId;
  cx: number;
  cy: number;
}

export function gatePoint(num: number): GatePoint {
  const local = GATE_LOCAL[num];
  if (!local) throw new Error(`Unknown gate ${num}`);
  const centerName = GATE_TO_CENTER[num] as CenterId;
  const c = CENTERS[centerName];
  const localCx = local.tlx + local.w / 2;
  const localCy = local.tly + local.h / 2;
  return {
    num,
    center: centerName,
    cx: c.x + localCx * c.w,
    cy: c.y + (localCy / c.localH) * c.h,
  };
}

/** All 64 gates with computed global centers. Order matches GATE_LOCAL keys. */
export const ALL_GATES: GatePoint[] = Object.keys(GATE_LOCAL)
  .map((k) => Number(k))
  .sort((a, b) => a - b)
  .map((n) => gatePoint(n));

// ─── Channels ───────────────────────────────────────────────────────────────
// Three kinds of channel geometry:
//  - line  : straight segment from (x1,y1) to (x2,y2). Rendered in two halves
//            (one per gate) so each half can be coloured by its gate's activation.
//  - curve : quadratic bezier (x1,y1) → (cx,cy) → (x2,y2). Same two-halves split.
//  - knot  : member of the Integration K4 (gates 10/20/34/57). No path here —
//            the visual is the union of 4 spokes from INTEGRATION_KNOT (see below).
//            Listed in CHANNEL_PATHS only so `activeChannelIds` finds it.

interface BaseChannel {
  id: string;
  gates: [number, number];
}

interface PathChannelBase extends BaseChannel {
  /** Endpoint near gate1. */
  x1: number;
  y1: number;
  /** Endpoint near gate2. */
  x2: number;
  y2: number;
}

export interface LineChannel extends PathChannelBase {
  kind: "line";
}

/** Quadratic bezier curve: gate1 → (cx,cy) control point → gate2. */
export interface CurveChannel extends PathChannelBase {
  kind: "curve";
  cx: number;
  cy: number;
}

/**
 * Belongs to a shared knot (e.g. the Integration K4 over gates 10-20-34-57).
 * The visual is rendered as `gate→hub` spokes, not as a per-channel path.
 * See `INTEGRATION_KNOT` below.
 */
export interface KnotChannel extends BaseChannel {
  kind: "knot";
  knot: "integration";
}

export type ChannelDef = LineChannel | CurveChannel | KnotChannel;

export const CHANNEL_PATHS: ChannelDef[] = [
  // Integration knot — K4 over gates 10, 20, 34, 57. Rendered as a shared
  // hub + 4 spokes (see INTEGRATION_KNOT below), not as 6 separate paths,
  // matching the Genetic Matrix layout. The 6 entries here are bookkeeping
  // for activation lookup; their visual is the union of the 4 spokes.
  { id: "10-20", gates: [10, 20], kind: "knot", knot: "integration" },
  { id: "10-34", gates: [10, 34], kind: "knot", knot: "integration" },
  { id: "10-57", gates: [10, 57], kind: "knot", knot: "integration" },
  { id: "20-34", gates: [20, 34], kind: "knot", knot: "integration" },
  { id: "20-57", gates: [20, 57], kind: "knot", knot: "integration" },
  { id: "34-57", gates: [34, 57], kind: "knot", knot: "integration" },

  // Straight line channels (rest of the chart).
  { id: "26-44", gates: [26, 44], kind: "line", x1: 0.66, y1: 0.925, x2: 0.12, y2: 0.99 },
  { id: "42-53", gates: [42, 53], kind: "line", x1: 0.45, y1: 1.20,  x2: 0.45, y2: 1.30 },
  { id: "3-60",  gates: [3, 60],  kind: "line", x1: 0.50, y1: 1.20,  x2: 0.50, y2: 1.30 },
  { id: "9-52",  gates: [9, 52],  kind: "line", x1: 0.55, y1: 1.20,  x2: 0.55, y2: 1.30 },
  { id: "30-41", gates: [30, 41], kind: "line", x1: 0.98, y1: 1.10,  x2: 0.58, y2: 1.47 },
  { id: "39-55", gates: [39, 55], kind: "line", x1: 0.58, y1: 1.42,  x2: 0.96, y2: 1.05 },
  { id: "19-49", gates: [19, 49], kind: "line", x1: 0.58, y1: 1.37,  x2: 0.91, y2: 1.03 },
  { id: "18-58", gates: [18, 58], kind: "line", x1: 0.025, y1: 1.10, x2: 0.41, y2: 1.46 },
  { id: "28-38", gates: [28, 38], kind: "line", x1: 0.07, y1: 1.085, x2: 0.41, y2: 1.41 },
  { id: "32-54", gates: [32, 54], kind: "line", x1: 0.11, y1: 1.05,  x2: 0.41, y2: 1.36 },
  { id: "6-59",  gates: [6, 59],  kind: "line", x1: 0.84, y1: 1.02,  x2: 0.58, y2: 1.145 },
  { id: "27-50", gates: [27, 50], kind: "line", x1: 0.41, y1: 1.14,  x2: 0.16, y2: 1.02 },
  { id: "5-15",  gates: [5, 15],  kind: "line", x1: 0.45, y1: 1.00,  x2: 0.46, y2: 0.85 },
  { id: "2-14",  gates: [2, 14],  kind: "line", x1: 0.50, y1: 0.85,  x2: 0.50, y2: 1.00 },
  { id: "29-46", gates: [29, 46], kind: "line", x1: 0.55, y1: 1.00,  x2: 0.54, y2: 0.85 },
  { id: "37-40", gates: [37, 40], kind: "line", x1: 0.88, y1: 0.995, x2: 0.74, y2: 0.94 },
  { id: "12-22", gates: [12, 22], kind: "line", x1: 0.59, y1: 0.52,  x2: 0.925, y2: 0.96 },
  { id: "35-36", gates: [35, 36], kind: "line", x1: 0.59, y1: 0.48,  x2: 0.965, y2: 0.94 },
  { id: "21-45", gates: [21, 45], kind: "line", x1: 0.73, y1: 0.86,  x2: 0.58, y2: 0.55 },
  { id: "25-51", gates: [25, 51], kind: "line", x1: 0.58, y1: 0.80,  x2: 0.69, y2: 0.89 },
  { id: "16-48", gates: [16, 48], kind: "line", x1: 0.42, y1: 0.48,  x2: 0.03, y2: 0.94 },
  { id: "7-31",  gates: [7, 31],  kind: "line", x1: 0.46, y1: 0.76,  x2: 0.45, y2: 0.60 },
  { id: "1-8",   gates: [1, 8],   kind: "line", x1: 0.50, y1: 0.73,  x2: 0.50, y2: 0.60 },
  { id: "13-33", gates: [13, 33], kind: "line", x1: 0.54, y1: 0.75,  x2: 0.55, y2: 0.60 },
  { id: "17-62", gates: [17, 62], kind: "line", x1: 0.465, y1: 0.27, x2: 0.45, y2: 0.45 },
  { id: "23-43", gates: [23, 43], kind: "line", x1: 0.50, y1: 0.45,  x2: 0.50, y2: 0.32 },
  { id: "11-56", gates: [11, 56], kind: "line", x1: 0.535, y1: 0.27, x2: 0.55, y2: 0.45 },
  { id: "47-64", gates: [47, 64], kind: "line", x1: 0.45, y1: 0.22,  x2: 0.45, y2: 0.12 },
  { id: "24-61", gates: [24, 61], kind: "line", x1: 0.50, y1: 0.22,  x2: 0.50, y2: 0.12 },
  { id: "4-63",  gates: [4, 63],  kind: "line", x1: 0.55, y1: 0.22,  x2: 0.55, y2: 0.12 },
];

/** Canonical "menor-mayor" channel id (matches HD_CHANNELS keys). */
export function canonicalChannelId(gates: [number, number]): string {
  const [a, b] = gates;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}-${hi}`;
}

// ─── Integration knot (gates 10, 20, 34, 57 + shared hub) ───────────────────
//
// The Integration subcircuit forms a K4 complete graph over 4 gates. Genetic
// Matrix renders it as a single visual cluster: 1 hub point + 4 spokes (one
// from each gate). A channel's activation is reflected by coloring BOTH of
// its endpoint gates' spokes — never as a separate path. This avoids the
// "duplicated stub" artifact (a gate appearing in 3 channels would emit 3
// curves leaving the same point under the naive per-channel render).

export interface IntegrationSpoke {
  gate: number;
  /** Spoke endpoint at the gate side. Slightly offset from the gate center
   *  to leave room for the gate circle's outline. */
  x: number;
  y: number;
  /** Quadratic bezier control point (optional). Without it, the spoke is a
   *  straight line from the gate end to the hub. */
  cx?: number;
  cy?: number;
}

export interface IntegrationKnotDef {
  /** Shared hub point — all 4 spokes meet here. */
  hub: { x: number; y: number };
  spokes: IntegrationSpoke[];
}

export const INTEGRATION_KNOT: IntegrationKnotDef = {
  hub: { x: 0.32, y: 0.83 },
  spokes: [
    // Gate 10 (G center, left side) → hub. Nearly horizontal, short.
    { gate: 10, x: 0.43, y: 0.81 },
    // Gate 20 (Throat, left) → hub. Slight curve to the left.
    { gate: 20, x: 0.42, y: 0.565, cx: 0.34, cy: 0.69 },
    // Gate 34 (Sacral, top-left) → hub. Slight curve to the left.
    { gate: 34, x: 0.42, y: 1.06, cx: 0.34, cy: 0.96 },
    // Gate 57 (Spleen, upper-left) → hub. Diagonal with curve.
    { gate: 57, x: 0.10, y: 0.97, cx: 0.20, cy: 0.88 },
  ],
};
