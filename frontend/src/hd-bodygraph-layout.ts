/**
 * Bodygraph SVG layout (Human Design) — full layout with 64 gates and 36 channels.
 *
 * Each gate has a fixed position inside its center. Channels are drawn as
 * straight lines that connect the two gate positions of the channel, so the
 * graph looks anatomically correct: Head→Ajna gates land near the inner edges,
 * the long external arcs (Spleen ↔ SolarPlexus, Heart ↔ Spleen, etc.) emerge
 * naturally because their gates sit on the outer sides of each center.
 *
 * Center ids match backend canonical names (see backend/src/hd-gates.ts):
 * Head, Ajna, Throat, G, Heart, Spleen, Sacral, SolarPlexus, Root.
 *
 * ViewBox is 240 x 420 to leave room for labels and the outer channel arcs.
 */

export const BODYGRAPH_VIEWBOX = { width: 240, height: 420 };

export type BodygraphCenterId =
  | "Head"
  | "Ajna"
  | "Throat"
  | "G"
  | "Heart"
  | "Spleen"
  | "Sacral"
  | "SolarPlexus"
  | "Root";

export interface BodygraphCenterShape {
  id: BodygraphCenterId;
  displayName: string;
  shape: "triangleDown" | "triangleUp" | "triangleLeft" | "triangleRight" | "square" | "diamond";
  cx: number;
  cy: number;
  width: number;
  height: number;
  path: string;
}

export interface BodygraphGatePoint {
  gate: number;
  center: BodygraphCenterId;
  x: number;
  y: number;
}

export interface BodygraphChannelPath {
  channelId: string;
  gates: [number, number];
  fromCenter: BodygraphCenterId;
  toCenter: BodygraphCenterId;
  d: string;
  curve?: number;
}

function trianglePath(
  cx: number,
  cy: number,
  width: number,
  height: number,
  direction: "down" | "up" | "left" | "right",
): string {
  const hw = width / 2;
  const hh = height / 2;
  switch (direction) {
    case "down":
      return `M ${cx - hw} ${cy - hh} L ${cx + hw} ${cy - hh} L ${cx} ${cy + hh} Z`;
    case "up":
      return `M ${cx} ${cy - hh} L ${cx + hw} ${cy + hh} L ${cx - hw} ${cy + hh} Z`;
    case "left":
      return `M ${cx - hw} ${cy} L ${cx + hw} ${cy - hh} L ${cx + hw} ${cy + hh} Z`;
    case "right":
      return `M ${cx + hw} ${cy} L ${cx - hw} ${cy - hh} L ${cx - hw} ${cy + hh} Z`;
  }
}

function squarePath(cx: number, cy: number, width: number, height: number): string {
  const hw = width / 2;
  const hh = height / 2;
  return `M ${cx - hw} ${cy - hh} L ${cx + hw} ${cy - hh} L ${cx + hw} ${cy + hh} L ${cx - hw} ${cy + hh} Z`;
}

function diamondPath(cx: number, cy: number, width: number, height: number): string {
  const hw = width / 2;
  const hh = height / 2;
  return `M ${cx} ${cy - hh} L ${cx + hw} ${cy} L ${cx} ${cy + hh} L ${cx - hw} ${cy} Z`;
}

// ─── Center positions ─────────────────────────────────────────────────────────

const HEAD = { cx: 120, cy: 36, width: 80, height: 48 };
const AJNA = { cx: 120, cy: 100, width: 80, height: 44 };
const THROAT = { cx: 120, cy: 160, width: 96, height: 56 };
const G = { cx: 120, cy: 232, width: 70, height: 70 };
const HEART = { cx: 184, cy: 232, width: 50, height: 46 };
const SPLEEN = { cx: 44, cy: 304, width: 60, height: 56 };
const SACRAL = { cx: 120, cy: 304, width: 96, height: 52 };
const SOLAR = { cx: 196, cy: 304, width: 60, height: 56 };
const ROOT = { cx: 120, cy: 376, width: 120, height: 50 };

export const BODYGRAPH_CENTERS: BodygraphCenterShape[] = [
  {
    id: "Head",
    displayName: "Cabeza",
    shape: "triangleUp",
    ...HEAD,
    path: trianglePath(HEAD.cx, HEAD.cy, HEAD.width, HEAD.height, "up"),
  },
  {
    id: "Ajna",
    displayName: "Ajna",
    shape: "triangleDown",
    ...AJNA,
    path: trianglePath(AJNA.cx, AJNA.cy, AJNA.width, AJNA.height, "down"),
  },
  {
    id: "Throat",
    displayName: "Garganta",
    shape: "square",
    ...THROAT,
    path: squarePath(THROAT.cx, THROAT.cy, THROAT.width, THROAT.height),
  },
  {
    id: "G",
    displayName: "Centro G",
    shape: "diamond",
    ...G,
    path: diamondPath(G.cx, G.cy, G.width, G.height),
  },
  {
    id: "Heart",
    displayName: "Corazón",
    shape: "triangleLeft",
    ...HEART,
    path: trianglePath(HEART.cx, HEART.cy, HEART.width, HEART.height, "left"),
  },
  {
    id: "Spleen",
    displayName: "Bazo",
    shape: "triangleRight",
    ...SPLEEN,
    path: trianglePath(SPLEEN.cx, SPLEEN.cy, SPLEEN.width, SPLEEN.height, "right"),
  },
  {
    id: "Sacral",
    displayName: "Sacral",
    shape: "square",
    ...SACRAL,
    path: squarePath(SACRAL.cx, SACRAL.cy, SACRAL.width, SACRAL.height),
  },
  {
    id: "SolarPlexus",
    displayName: "Plexo Solar",
    shape: "triangleLeft",
    ...SOLAR,
    path: trianglePath(SOLAR.cx, SOLAR.cy, SOLAR.width, SOLAR.height, "left"),
  },
  {
    id: "Root",
    displayName: "Raíz",
    shape: "square",
    ...ROOT,
    path: squarePath(ROOT.cx, ROOT.cy, ROOT.width, ROOT.height),
  },
];

export const BODYGRAPH_CENTER_BY_ID: Record<BodygraphCenterId, BodygraphCenterShape> = Object.fromEntries(
  BODYGRAPH_CENTERS.map((center) => [center.id, center]),
) as Record<BodygraphCenterId, BodygraphCenterShape>;

// ─── Gate positions (64 gates) ────────────────────────────────────────────────

// Head: 3 gates on the bottom edge (base of the apex-up triangle)
const HEAD_GATES: Array<[number, number, number]> = [
  [64, HEAD.cx - 18, HEAD.cy + HEAD.height / 2 - 6],
  [61, HEAD.cx, HEAD.cy + HEAD.height / 2 - 6],
  [63, HEAD.cx + 18, HEAD.cy + HEAD.height / 2 - 6],
];

// Ajna: 6 gates — 3 top (47, 24, 4), 3 bottom (17, 11, 43)
const AJNA_GATES: Array<[number, number, number]> = [
  [47, AJNA.cx - 22, AJNA.cy - AJNA.height / 2 + 8],
  [24, AJNA.cx, AJNA.cy - AJNA.height / 2 + 8],
  [4, AJNA.cx + 22, AJNA.cy - AJNA.height / 2 + 8],
  [17, AJNA.cx - 12, AJNA.cy + AJNA.height / 2 - 8],
  [11, AJNA.cx, AJNA.cy + AJNA.height / 2 - 8],
  [43, AJNA.cx + 12, AJNA.cy + AJNA.height / 2 - 8],
];

// Throat: 11 gates — top (62, 23, 56), left (16, 20, 31), right (35, 12, 45),
// bottom (8, 33). Place along the inner edges.
const THROAT_GATES: Array<[number, number, number]> = [
  [62, THROAT.cx - 28, THROAT.cy - THROAT.height / 2 + 8],
  [23, THROAT.cx, THROAT.cy - THROAT.height / 2 + 8],
  [56, THROAT.cx + 28, THROAT.cy - THROAT.height / 2 + 8],
  [16, THROAT.cx - THROAT.width / 2 + 10, THROAT.cy - 6],
  [35, THROAT.cx + THROAT.width / 2 - 10, THROAT.cy - 6],
  [20, THROAT.cx - THROAT.width / 2 + 10, THROAT.cy + 6],
  [12, THROAT.cx + THROAT.width / 2 - 10, THROAT.cy + 6],
  [31, THROAT.cx - 22, THROAT.cy + THROAT.height / 2 - 8],
  [8, THROAT.cx - 8, THROAT.cy + THROAT.height / 2 - 8],
  [33, THROAT.cx + 8, THROAT.cy + THROAT.height / 2 - 8],
  [45, THROAT.cx + 22, THROAT.cy + THROAT.height / 2 - 8],
];

// G: 8 gates inside the diamond
const G_GATES: Array<[number, number, number]> = [
  [1, G.cx, G.cy - 22],
  [7, G.cx - 16, G.cy - 10],
  [13, G.cx + 16, G.cy - 10],
  [10, G.cx - 22, G.cy + 4],
  [25, G.cx + 22, G.cy + 4],
  [15, G.cx - 12, G.cy + 16],
  [46, G.cx + 12, G.cy + 16],
  [2, G.cx, G.cy + 26],
];

// Heart: 4 gates inside the apex-left triangle. Triangle points left so gates
// hang along the inner area near the apex.
const HEART_GATES: Array<[number, number, number]> = [
  [21, HEART.cx + 6, HEART.cy - 12],
  [40, HEART.cx + 14, HEART.cy + 12],
  [26, HEART.cx + 14, HEART.cy - 2],
  [51, HEART.cx - 8, HEART.cy],
];

// Spleen: 7 gates inside the apex-right triangle
const SPLEEN_GATES: Array<[number, number, number]> = [
  [48, SPLEEN.cx - 18, SPLEEN.cy - 16],
  [57, SPLEEN.cx - 6, SPLEEN.cy - 14],
  [44, SPLEEN.cx - 18, SPLEEN.cy - 4],
  [50, SPLEEN.cx - 6, SPLEEN.cy - 4],
  [32, SPLEEN.cx - 18, SPLEEN.cy + 8],
  [28, SPLEEN.cx - 6, SPLEEN.cy + 8],
  [18, SPLEEN.cx - 18, SPLEEN.cy + 18],
];

// Sacral: 9 gates in a 3x3 grid
const SACRAL_GATES: Array<[number, number, number]> = [
  [34, SACRAL.cx - 30, SACRAL.cy - 14],
  [5, SACRAL.cx, SACRAL.cy - 14],
  [14, SACRAL.cx + 30, SACRAL.cy - 14],
  [29, SACRAL.cx - 30, SACRAL.cy],
  [59, SACRAL.cx, SACRAL.cy],
  [9, SACRAL.cx + 30, SACRAL.cy],
  [3, SACRAL.cx - 30, SACRAL.cy + 14],
  [42, SACRAL.cx, SACRAL.cy + 14],
  [27, SACRAL.cx + 30, SACRAL.cy + 14],
];

// Solar Plexus: 7 gates inside the apex-left triangle
const SOLAR_GATES: Array<[number, number, number]> = [
  [36, SOLAR.cx + 18, SOLAR.cy - 16],
  [22, SOLAR.cx + 6, SOLAR.cy - 14],
  [37, SOLAR.cx + 18, SOLAR.cy - 4],
  [6, SOLAR.cx + 6, SOLAR.cy - 4],
  [49, SOLAR.cx + 18, SOLAR.cy + 8],
  [55, SOLAR.cx + 6, SOLAR.cy + 8],
  [30, SOLAR.cx + 18, SOLAR.cy + 18],
];

// Root: 9 gates in a 3x3 grid
const ROOT_GATES: Array<[number, number, number]> = [
  [53, ROOT.cx - 36, ROOT.cy - 14],
  [60, ROOT.cx, ROOT.cy - 14],
  [52, ROOT.cx + 36, ROOT.cy - 14],
  [54, ROOT.cx - 36, ROOT.cy],
  [19, ROOT.cx, ROOT.cy],
  [39, ROOT.cx + 36, ROOT.cy],
  [38, ROOT.cx - 36, ROOT.cy + 14],
  [58, ROOT.cx, ROOT.cy + 14],
  [41, ROOT.cx + 36, ROOT.cy + 14],
];

function gatesIn(
  centerId: BodygraphCenterId,
  list: Array<[number, number, number]>,
): BodygraphGatePoint[] {
  return list.map(([gate, x, y]) => ({ gate, center: centerId, x, y }));
}

export const BODYGRAPH_GATES: BodygraphGatePoint[] = [
  ...gatesIn("Head", HEAD_GATES),
  ...gatesIn("Ajna", AJNA_GATES),
  ...gatesIn("Throat", THROAT_GATES),
  ...gatesIn("G", G_GATES),
  ...gatesIn("Heart", HEART_GATES),
  ...gatesIn("Spleen", SPLEEN_GATES),
  ...gatesIn("Sacral", SACRAL_GATES),
  ...gatesIn("SolarPlexus", SOLAR_GATES),
  ...gatesIn("Root", ROOT_GATES),
];

export const BODYGRAPH_GATE_BY_NUMBER: Record<number, BodygraphGatePoint> = Object.fromEntries(
  BODYGRAPH_GATES.map((gate) => [gate.gate, gate]),
);

// ─── Channels (36) ────────────────────────────────────────────────────────────

interface ChannelDefinition {
  channelId: string;
  gates: [number, number];
  centers: [BodygraphCenterId, BodygraphCenterId];
  curve?: number;
}

const CHANNEL_DEFINITIONS: ChannelDefinition[] = [
  // Individual
  { channelId: "1-8", gates: [1, 8], centers: ["G", "Throat"] },
  { channelId: "2-14", gates: [2, 14], centers: ["G", "Sacral"] },
  { channelId: "3-60", gates: [3, 60], centers: ["Sacral", "Root"] },
  { channelId: "12-22", gates: [12, 22], centers: ["Throat", "SolarPlexus"] },
  { channelId: "23-43", gates: [23, 43], centers: ["Throat", "Ajna"] },
  { channelId: "24-61", gates: [24, 61], centers: ["Ajna", "Head"] },
  { channelId: "28-38", gates: [28, 38], centers: ["Spleen", "Root"] },
  { channelId: "39-55", gates: [39, 55], centers: ["Root", "SolarPlexus"], curve: 0.4 },
  // Colectivo
  { channelId: "4-63", gates: [4, 63], centers: ["Ajna", "Head"] },
  { channelId: "5-15", gates: [5, 15], centers: ["Sacral", "G"] },
  { channelId: "7-31", gates: [7, 31], centers: ["G", "Throat"] },
  { channelId: "9-52", gates: [9, 52], centers: ["Sacral", "Root"] },
  { channelId: "11-56", gates: [11, 56], centers: ["Ajna", "Throat"] },
  { channelId: "13-33", gates: [13, 33], centers: ["G", "Throat"] },
  { channelId: "16-48", gates: [16, 48], centers: ["Throat", "Spleen"], curve: -0.6 },
  { channelId: "17-62", gates: [17, 62], centers: ["Ajna", "Throat"] },
  { channelId: "29-46", gates: [29, 46], centers: ["Sacral", "G"] },
  { channelId: "30-41", gates: [30, 41], centers: ["SolarPlexus", "Root"], curve: 0.4 },
  { channelId: "35-36", gates: [35, 36], centers: ["Throat", "SolarPlexus"], curve: 0.6 },
  { channelId: "42-53", gates: [42, 53], centers: ["Sacral", "Root"] },
  { channelId: "47-64", gates: [47, 64], centers: ["Ajna", "Head"] },
  // Tribal
  { channelId: "6-59", gates: [6, 59], centers: ["SolarPlexus", "Sacral"] },
  { channelId: "18-58", gates: [18, 58], centers: ["Spleen", "Root"] },
  { channelId: "19-49", gates: [19, 49], centers: ["Root", "SolarPlexus"], curve: 0.4 },
  { channelId: "21-45", gates: [21, 45], centers: ["Heart", "Throat"], curve: -0.5 },
  { channelId: "25-51", gates: [25, 51], centers: ["G", "Heart"] },
  { channelId: "26-44", gates: [26, 44], centers: ["Heart", "Spleen"], curve: -0.7 },
  { channelId: "27-50", gates: [27, 50], centers: ["Sacral", "Spleen"] },
  { channelId: "32-54", gates: [32, 54], centers: ["Spleen", "Root"] },
  { channelId: "37-40", gates: [37, 40], centers: ["SolarPlexus", "Heart"] },
  // Integración
  { channelId: "10-20", gates: [10, 20], centers: ["G", "Throat"] },
  { channelId: "10-34", gates: [10, 34], centers: ["G", "Sacral"] },
  { channelId: "10-57", gates: [10, 57], centers: ["G", "Spleen"], curve: -0.4 },
  { channelId: "20-34", gates: [20, 34], centers: ["Throat", "Sacral"] },
  { channelId: "20-57", gates: [20, 57], centers: ["Throat", "Spleen"], curve: -0.5 },
  { channelId: "34-57", gates: [34, 57], centers: ["Sacral", "Spleen"] },
];

function buildChannelPath(
  fromGate: BodygraphGatePoint,
  toGate: BodygraphGatePoint,
  curve: number | undefined,
): string {
  if (!curve) {
    return `M ${fromGate.x} ${fromGate.y} L ${toGate.x} ${toGate.y}`;
  }
  // Use a quadratic Bézier whose control point is offset perpendicular to the
  // segment to produce a smooth outer arc.
  const mx = (fromGate.x + toGate.x) / 2;
  const my = (fromGate.y + toGate.y) / 2;
  const dx = toGate.x - fromGate.x;
  const dy = toGate.y - fromGate.y;
  const length = Math.hypot(dx, dy);
  const nx = -dy / length;
  const ny = dx / length;
  const offset = length * curve;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  return `M ${fromGate.x} ${fromGate.y} Q ${cx} ${cy} ${toGate.x} ${toGate.y}`;
}

export const BODYGRAPH_CHANNELS: BodygraphChannelPath[] = CHANNEL_DEFINITIONS.map((def) => {
  const from = BODYGRAPH_GATE_BY_NUMBER[def.gates[0]];
  const to = BODYGRAPH_GATE_BY_NUMBER[def.gates[1]];
  return {
    channelId: def.channelId,
    gates: def.gates,
    fromCenter: def.centers[0],
    toCenter: def.centers[1],
    d: buildChannelPath(from, to, def.curve),
    curve: def.curve,
  };
});

export function findChannelPath(channelId: string): BodygraphChannelPath | undefined {
  return BODYGRAPH_CHANNELS.find((channel) => channel.channelId === channelId);
}
