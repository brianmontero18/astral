/**
 * Bodygraph SVG layout (Human Design) — aerodynamic layout with rounded centers
 * and arc-style channels.
 *
 * - Centers have rounded corners on their shapes (via Q-curve segments in the
 *   center path) so the bodygraph reads as a single organic figure instead of
 *   a stack of rectangles.
 * - Channels are drawn as cubic Bézier arcs that bulge outward, mimicking the
 *   classic Rave Mandala layout where multiple parallel channels (Throat ↔
 *   Spleen / SolarPlexus, Heart ↔ Spleen, etc.) sweep around the body.
 *
 * Center ids match backend canonical names (see backend/src/hd-gates.ts):
 * Head, Ajna, Throat, G, Heart, Spleen, Sacral, SolarPlexus, Root.
 *
 * ViewBox is 280 x 480 to leave room for outer arcs.
 */

export const BODYGRAPH_VIEWBOX = { width: 280, height: 480 };

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
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

function roundedSquarePath(
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number,
): string {
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const x1 = cx + width / 2;
  const y1 = cy + height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M ${x0 + r} ${y0}`,
    `L ${x1 - r} ${y0}`,
    `Q ${x1} ${y0} ${x1} ${y0 + r}`,
    `L ${x1} ${y1 - r}`,
    `Q ${x1} ${y1} ${x1 - r} ${y1}`,
    `L ${x0 + r} ${y1}`,
    `Q ${x0} ${y1} ${x0} ${y1 - r}`,
    `L ${x0} ${y0 + r}`,
    `Q ${x0} ${y0} ${x0 + r} ${y0}`,
    "Z",
  ].join(" ");
}

function roundedTrianglePath(
  cx: number,
  cy: number,
  width: number,
  height: number,
  direction: "down" | "up" | "left" | "right",
  radius = 6,
): string {
  const hw = width / 2;
  const hh = height / 2;
  let p1: [number, number];
  let p2: [number, number];
  let p3: [number, number];
  switch (direction) {
    case "down":
      p1 = [cx - hw, cy - hh];
      p2 = [cx + hw, cy - hh];
      p3 = [cx, cy + hh];
      break;
    case "up":
      p1 = [cx, cy - hh];
      p2 = [cx + hw, cy + hh];
      p3 = [cx - hw, cy + hh];
      break;
    case "left":
      p1 = [cx - hw, cy];
      p2 = [cx + hw, cy - hh];
      p3 = [cx + hw, cy + hh];
      break;
    case "right":
      p1 = [cx + hw, cy];
      p2 = [cx - hw, cy - hh];
      p3 = [cx - hw, cy + hh];
      break;
  }
  return roundCornersOfPolygon([p1, p2, p3], radius);
}

function roundedDiamondPath(
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius = 6,
): string {
  const hw = width / 2;
  const hh = height / 2;
  const top: [number, number] = [cx, cy - hh];
  const right: [number, number] = [cx + hw, cy];
  const bottom: [number, number] = [cx, cy + hh];
  const left: [number, number] = [cx - hw, cy];
  return roundCornersOfPolygon([top, right, bottom, left], radius);
}

function roundCornersOfPolygon(points: Array<[number, number]>, radius: number): string {
  const segments: string[] = [];
  const len = points.length;
  for (let i = 0; i < len; i += 1) {
    const prev = points[(i - 1 + len) % len];
    const current = points[i];
    const next = points[(i + 1) % len];
    const v1x = prev[0] - current[0];
    const v1y = prev[1] - current[1];
    const v2x = next[0] - current[0];
    const v2y = next[1] - current[1];
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    const r = Math.min(radius, len1 / 2, len2 / 2);
    const start: [number, number] = [
      current[0] + (v1x / len1) * r,
      current[1] + (v1y / len1) * r,
    ];
    const end: [number, number] = [
      current[0] + (v2x / len2) * r,
      current[1] + (v2y / len2) * r,
    ];
    if (i === 0) {
      segments.push(`M ${start[0]} ${start[1]}`);
    } else {
      segments.push(`L ${start[0]} ${start[1]}`);
    }
    segments.push(`Q ${current[0]} ${current[1]} ${end[0]} ${end[1]}`);
  }
  segments.push("Z");
  return segments.join(" ");
}

// ─── Center positions ─────────────────────────────────────────────────────────

const HEAD = { cx: 140, cy: 44, width: 96, height: 60 };
const AJNA = { cx: 140, cy: 116, width: 92, height: 56 };
const THROAT = { cx: 140, cy: 196, width: 114, height: 74 };
const G = { cx: 140, cy: 286, width: 86, height: 86 };
const HEART = { cx: 210, cy: 286, width: 60, height: 56 };
const SPLEEN = { cx: 52, cy: 372, width: 76, height: 76 };
const SACRAL = { cx: 140, cy: 372, width: 114, height: 70 };
const SOLAR = { cx: 228, cy: 372, width: 76, height: 76 };
const ROOT = { cx: 140, cy: 452, width: 138, height: 62 };

const CENTER_RADIUS = 10;
const TRIANGLE_RADIUS = 8;
const DIAMOND_RADIUS = 8;

export const BODYGRAPH_CENTERS: BodygraphCenterShape[] = [
  {
    id: "Head",
    displayName: "Cabeza",
    shape: "triangleUp",
    ...HEAD,
    path: roundedTrianglePath(HEAD.cx, HEAD.cy, HEAD.width, HEAD.height, "up", TRIANGLE_RADIUS),
  },
  {
    id: "Ajna",
    displayName: "Ajna",
    shape: "triangleDown",
    ...AJNA,
    path: roundedTrianglePath(AJNA.cx, AJNA.cy, AJNA.width, AJNA.height, "down", TRIANGLE_RADIUS),
  },
  {
    id: "Throat",
    displayName: "Garganta",
    shape: "square",
    ...THROAT,
    path: roundedSquarePath(THROAT.cx, THROAT.cy, THROAT.width, THROAT.height, CENTER_RADIUS),
  },
  {
    id: "G",
    displayName: "Centro G",
    shape: "diamond",
    ...G,
    path: roundedDiamondPath(G.cx, G.cy, G.width, G.height, DIAMOND_RADIUS),
  },
  {
    id: "Heart",
    displayName: "Corazón",
    shape: "triangleLeft",
    ...HEART,
    path: roundedTrianglePath(HEART.cx, HEART.cy, HEART.width, HEART.height, "left", TRIANGLE_RADIUS),
  },
  {
    id: "Spleen",
    displayName: "Bazo",
    shape: "triangleRight",
    ...SPLEEN,
    path: roundedTrianglePath(SPLEEN.cx, SPLEEN.cy, SPLEEN.width, SPLEEN.height, "right", TRIANGLE_RADIUS),
  },
  {
    id: "Sacral",
    displayName: "Sacral",
    shape: "square",
    ...SACRAL,
    path: roundedSquarePath(SACRAL.cx, SACRAL.cy, SACRAL.width, SACRAL.height, CENTER_RADIUS),
  },
  {
    id: "SolarPlexus",
    displayName: "Plexo Solar",
    shape: "triangleLeft",
    ...SOLAR,
    path: roundedTrianglePath(SOLAR.cx, SOLAR.cy, SOLAR.width, SOLAR.height, "left", TRIANGLE_RADIUS),
  },
  {
    id: "Root",
    displayName: "Raíz",
    shape: "square",
    ...ROOT,
    path: roundedSquarePath(ROOT.cx, ROOT.cy, ROOT.width, ROOT.height, CENTER_RADIUS),
  },
];

export const BODYGRAPH_CENTER_BY_ID: Record<BodygraphCenterId, BodygraphCenterShape> = Object.fromEntries(
  BODYGRAPH_CENTERS.map((center) => [center.id, center]),
) as Record<BodygraphCenterId, BodygraphCenterShape>;

// ─── Gate positions (64 gates) ────────────────────────────────────────────────

// Head — 3 gates on the base (bottom edge) of the apex-up triangle
const HEAD_GATES: Array<[number, number, number]> = [
  [64, HEAD.cx - 22, HEAD.cy + HEAD.height / 2 - 8],
  [61, HEAD.cx, HEAD.cy + HEAD.height / 2 - 8],
  [63, HEAD.cx + 22, HEAD.cy + HEAD.height / 2 - 8],
];

// Ajna — 6 gates: 47/24/4 top (base), 17/11/43 bottom (apex)
const AJNA_GATES: Array<[number, number, number]> = [
  [47, AJNA.cx - 24, AJNA.cy - AJNA.height / 2 + 10],
  [24, AJNA.cx, AJNA.cy - AJNA.height / 2 + 10],
  [4, AJNA.cx + 24, AJNA.cy - AJNA.height / 2 + 10],
  [17, AJNA.cx - 14, AJNA.cy + AJNA.height / 2 - 10],
  [11, AJNA.cx, AJNA.cy + AJNA.height / 2 - 10],
  [43, AJNA.cx + 14, AJNA.cy + AJNA.height / 2 - 10],
];

// Throat — 11 gates around the perimeter
const THROAT_GATES: Array<[number, number, number]> = [
  [62, THROAT.cx - 36, THROAT.cy - THROAT.height / 2 + 12],
  [23, THROAT.cx, THROAT.cy - THROAT.height / 2 + 12],
  [56, THROAT.cx + 36, THROAT.cy - THROAT.height / 2 + 12],
  [16, THROAT.cx - THROAT.width / 2 + 14, THROAT.cy - 6],
  [35, THROAT.cx + THROAT.width / 2 - 14, THROAT.cy - 6],
  [20, THROAT.cx - THROAT.width / 2 + 14, THROAT.cy + 10],
  [12, THROAT.cx + THROAT.width / 2 - 14, THROAT.cy + 10],
  [31, THROAT.cx - 28, THROAT.cy + THROAT.height / 2 - 12],
  [8, THROAT.cx - 9, THROAT.cy + THROAT.height / 2 - 12],
  [33, THROAT.cx + 9, THROAT.cy + THROAT.height / 2 - 12],
  [45, THROAT.cx + 28, THROAT.cy + THROAT.height / 2 - 12],
];

// G — 8 gates inside the diamond (radial)
const G_GATES: Array<[number, number, number]> = [
  [1, G.cx, G.cy - 28],
  [7, G.cx - 20, G.cy - 12],
  [13, G.cx + 20, G.cy - 12],
  [10, G.cx - 28, G.cy + 6],
  [25, G.cx + 28, G.cy + 6],
  [15, G.cx - 14, G.cy + 22],
  [46, G.cx + 14, G.cy + 22],
  [2, G.cx, G.cy + 32],
];

// Heart — 4 gates inside the apex-left triangle
const HEART_GATES: Array<[number, number, number]> = [
  [21, HEART.cx + 8, HEART.cy - 16],
  [51, HEART.cx - 10, HEART.cy],
  [26, HEART.cx + 16, HEART.cy - 2],
  [40, HEART.cx + 16, HEART.cy + 14],
];

// Spleen — 7 gates inside the apex-right triangle
const SPLEEN_GATES: Array<[number, number, number]> = [
  [48, SPLEEN.cx - 24, SPLEEN.cy - 22],
  [57, SPLEEN.cx - 10, SPLEEN.cy - 18],
  [44, SPLEEN.cx - 24, SPLEEN.cy - 8],
  [50, SPLEEN.cx - 10, SPLEEN.cy - 4],
  [32, SPLEEN.cx - 24, SPLEEN.cy + 6],
  [28, SPLEEN.cx - 10, SPLEEN.cy + 10],
  [18, SPLEEN.cx - 24, SPLEEN.cy + 22],
];

// Sacral — 9 gates in 3x3 grid
const SACRAL_GATES: Array<[number, number, number]> = [
  [34, SACRAL.cx - 38, SACRAL.cy - 20],
  [5, SACRAL.cx, SACRAL.cy - 20],
  [14, SACRAL.cx + 38, SACRAL.cy - 20],
  [29, SACRAL.cx - 38, SACRAL.cy],
  [59, SACRAL.cx, SACRAL.cy],
  [9, SACRAL.cx + 38, SACRAL.cy],
  [3, SACRAL.cx - 38, SACRAL.cy + 20],
  [42, SACRAL.cx, SACRAL.cy + 20],
  [27, SACRAL.cx + 38, SACRAL.cy + 20],
];

// Solar Plexus — 7 gates inside the apex-left triangle
const SOLAR_GATES: Array<[number, number, number]> = [
  [36, SOLAR.cx + 24, SOLAR.cy - 22],
  [22, SOLAR.cx + 10, SOLAR.cy - 18],
  [37, SOLAR.cx + 24, SOLAR.cy - 8],
  [6, SOLAR.cx + 10, SOLAR.cy - 4],
  [49, SOLAR.cx + 24, SOLAR.cy + 6],
  [55, SOLAR.cx + 10, SOLAR.cy + 10],
  [30, SOLAR.cx + 24, SOLAR.cy + 22],
];

// Root — 9 gates in 3x3 grid
const ROOT_GATES: Array<[number, number, number]> = [
  [53, ROOT.cx - 46, ROOT.cy - 18],
  [60, ROOT.cx, ROOT.cy - 18],
  [52, ROOT.cx + 46, ROOT.cy - 18],
  [54, ROOT.cx - 46, ROOT.cy],
  [19, ROOT.cx, ROOT.cy],
  [39, ROOT.cx + 46, ROOT.cy],
  [38, ROOT.cx - 46, ROOT.cy + 18],
  [58, ROOT.cx, ROOT.cy + 18],
  [41, ROOT.cx + 46, ROOT.cy + 18],
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
  /**
   * Signed bulge amount applied as a cubic-bezier offset perpendicular to the
   * gate-to-gate segment. 0 = straight line. Positive bulges to one side,
   * negative to the other. Higher absolute values produce wider outer arcs.
   * Parallel channels use slightly different amounts so they don't overlap.
   */
  arc?: number;
}

const CHANNEL_DEFINITIONS: ChannelDefinition[] = [
  // Individual
  { channelId: "1-8", gates: [1, 8], centers: ["G", "Throat"] },
  { channelId: "2-14", gates: [2, 14], centers: ["G", "Sacral"] },
  { channelId: "3-60", gates: [3, 60], centers: ["Sacral", "Root"] },
  { channelId: "12-22", gates: [12, 22], centers: ["Throat", "SolarPlexus"], arc: 0.45 },
  { channelId: "23-43", gates: [23, 43], centers: ["Throat", "Ajna"] },
  { channelId: "24-61", gates: [24, 61], centers: ["Ajna", "Head"] },
  { channelId: "28-38", gates: [28, 38], centers: ["Spleen", "Root"], arc: -0.35 },
  { channelId: "39-55", gates: [39, 55], centers: ["Root", "SolarPlexus"], arc: 0.55 },
  // Colectivo
  { channelId: "4-63", gates: [4, 63], centers: ["Ajna", "Head"] },
  { channelId: "5-15", gates: [5, 15], centers: ["Sacral", "G"] },
  { channelId: "7-31", gates: [7, 31], centers: ["G", "Throat"] },
  { channelId: "9-52", gates: [9, 52], centers: ["Sacral", "Root"] },
  { channelId: "11-56", gates: [11, 56], centers: ["Ajna", "Throat"] },
  { channelId: "13-33", gates: [13, 33], centers: ["G", "Throat"] },
  { channelId: "16-48", gates: [16, 48], centers: ["Throat", "Spleen"], arc: -0.7 },
  { channelId: "17-62", gates: [17, 62], centers: ["Ajna", "Throat"] },
  { channelId: "29-46", gates: [29, 46], centers: ["Sacral", "G"] },
  { channelId: "30-41", gates: [30, 41], centers: ["SolarPlexus", "Root"], arc: 0.45 },
  { channelId: "35-36", gates: [35, 36], centers: ["Throat", "SolarPlexus"], arc: 0.7 },
  { channelId: "42-53", gates: [42, 53], centers: ["Sacral", "Root"] },
  { channelId: "47-64", gates: [47, 64], centers: ["Ajna", "Head"] },
  // Tribal
  { channelId: "6-59", gates: [6, 59], centers: ["SolarPlexus", "Sacral"] },
  { channelId: "18-58", gates: [18, 58], centers: ["Spleen", "Root"], arc: -0.5 },
  { channelId: "19-49", gates: [19, 49], centers: ["Root", "SolarPlexus"], arc: 0.6 },
  { channelId: "21-45", gates: [21, 45], centers: ["Heart", "Throat"], arc: -0.45 },
  { channelId: "25-51", gates: [25, 51], centers: ["G", "Heart"] },
  { channelId: "26-44", gates: [26, 44], centers: ["Heart", "Spleen"], arc: -0.75 },
  { channelId: "27-50", gates: [27, 50], centers: ["Sacral", "Spleen"] },
  { channelId: "32-54", gates: [32, 54], centers: ["Spleen", "Root"], arc: -0.4 },
  { channelId: "37-40", gates: [37, 40], centers: ["SolarPlexus", "Heart"], arc: 0.35 },
  // Integración
  { channelId: "10-20", gates: [10, 20], centers: ["G", "Throat"] },
  { channelId: "10-34", gates: [10, 34], centers: ["G", "Sacral"] },
  { channelId: "10-57", gates: [10, 57], centers: ["G", "Spleen"], arc: -0.55 },
  { channelId: "20-34", gates: [20, 34], centers: ["Throat", "Sacral"] },
  { channelId: "20-57", gates: [20, 57], centers: ["Throat", "Spleen"], arc: -0.55 },
  { channelId: "34-57", gates: [34, 57], centers: ["Sacral", "Spleen"], arc: -0.25 },
];

function buildChannelPath(
  fromGate: BodygraphGatePoint,
  toGate: BodygraphGatePoint,
  arc: number | undefined,
): string {
  if (!arc) {
    return `M ${fromGate.x} ${fromGate.y} L ${toGate.x} ${toGate.y}`;
  }
  // Cubic Bézier with both control points offset perpendicular to the segment,
  // producing a smooth outer arc that bulges to one side.
  const dx = toGate.x - fromGate.x;
  const dy = toGate.y - fromGate.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return `M ${fromGate.x} ${fromGate.y} L ${toGate.x} ${toGate.y}`;
  }
  const nx = -dy / length;
  const ny = dx / length;
  const offset = length * arc;
  // Position the control points one third of the way along the segment, then
  // push them perpendicular by `offset`. This gives a balanced arc that does
  // not pinch near the endpoints.
  const cp1x = fromGate.x + dx / 3 + nx * offset;
  const cp1y = fromGate.y + dy / 3 + ny * offset;
  const cp2x = fromGate.x + (dx * 2) / 3 + nx * offset;
  const cp2y = fromGate.y + (dy * 2) / 3 + ny * offset;
  return `M ${fromGate.x} ${fromGate.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toGate.x} ${toGate.y}`;
}

export const BODYGRAPH_CHANNELS: BodygraphChannelPath[] = CHANNEL_DEFINITIONS.map((def) => {
  const from = BODYGRAPH_GATE_BY_NUMBER[def.gates[0]];
  const to = BODYGRAPH_GATE_BY_NUMBER[def.gates[1]];
  return {
    channelId: def.channelId,
    gates: def.gates,
    fromCenter: def.centers[0],
    toCenter: def.centers[1],
    d: buildChannelPath(from, to, def.arc),
  };
});

export function findChannelPath(channelId: string): BodygraphChannelPath | undefined {
  return BODYGRAPH_CHANNELS.find((channel) => channel.channelId === channelId);
}
