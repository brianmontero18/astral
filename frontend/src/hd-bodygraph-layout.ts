/**
 * Bodygraph SVG layout (Human Design).
 *
 * Canonical center positions and channel paths used by <BodygraphLive>.
 * Center ids match backend canonical names (see backend/src/hd-gates.ts):
 * Head, Ajna, Throat, G, Heart, Spleen, Sacral, SolarPlexus, Root.
 *
 * Coordinates are in a 100x180 viewBox to leave room for shape outlines.
 */

export const BODYGRAPH_VIEWBOX = { width: 100, height: 180 };

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
  shortLabel: string;
  shape: "triangleDown" | "triangleUp" | "triangleLeft" | "triangleRight" | "square" | "diamond";
  cx: number;
  cy: number;
  width: number;
  height: number;
  path: string;
  labelOffsetY?: number;
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

const HEAD = { cx: 50, cy: 14, width: 26, height: 20 };
const AJNA = { cx: 50, cy: 36, width: 26, height: 20 };
const THROAT = { cx: 50, cy: 60, width: 30, height: 18 };
const G = { cx: 50, cy: 86, width: 26, height: 26 };
const HEART = { cx: 76, cy: 88, width: 20, height: 18 };
const SPLEEN = { cx: 22, cy: 116, width: 22, height: 20 };
const SACRAL = { cx: 50, cy: 116, width: 30, height: 22 };
const SOLAR = { cx: 78, cy: 116, width: 22, height: 20 };
const ROOT = { cx: 50, cy: 152, width: 36, height: 22 };

export const BODYGRAPH_CENTERS: BodygraphCenterShape[] = [
  {
    id: "Head",
    displayName: "Cabeza",
    shortLabel: "Cb",
    shape: "triangleDown",
    ...HEAD,
    path: trianglePath(HEAD.cx, HEAD.cy, HEAD.width, HEAD.height, "down"),
    labelOffsetY: -3,
  },
  {
    id: "Ajna",
    displayName: "Ajna",
    shortLabel: "Aj",
    shape: "triangleUp",
    ...AJNA,
    path: trianglePath(AJNA.cx, AJNA.cy, AJNA.width, AJNA.height, "up"),
    labelOffsetY: 3,
  },
  {
    id: "Throat",
    displayName: "Garganta",
    shortLabel: "Gr",
    shape: "square",
    ...THROAT,
    path: squarePath(THROAT.cx, THROAT.cy, THROAT.width, THROAT.height),
  },
  {
    id: "G",
    displayName: "Centro G",
    shortLabel: "G",
    shape: "diamond",
    ...G,
    path: diamondPath(G.cx, G.cy, G.width, G.height),
  },
  {
    id: "Heart",
    displayName: "Corazón",
    shortLabel: "Co",
    shape: "triangleLeft",
    ...HEART,
    path: trianglePath(HEART.cx, HEART.cy, HEART.width, HEART.height, "left"),
  },
  {
    id: "Spleen",
    displayName: "Bazo",
    shortLabel: "Bz",
    shape: "triangleRight",
    ...SPLEEN,
    path: trianglePath(SPLEEN.cx, SPLEEN.cy, SPLEEN.width, SPLEEN.height, "right"),
  },
  {
    id: "Sacral",
    displayName: "Sacral",
    shortLabel: "Sc",
    shape: "square",
    ...SACRAL,
    path: squarePath(SACRAL.cx, SACRAL.cy, SACRAL.width, SACRAL.height),
  },
  {
    id: "SolarPlexus",
    displayName: "Plexo Solar",
    shortLabel: "PS",
    shape: "triangleLeft",
    ...SOLAR,
    path: trianglePath(SOLAR.cx, SOLAR.cy, SOLAR.width, SOLAR.height, "left"),
  },
  {
    id: "Root",
    displayName: "Raíz",
    shortLabel: "Rz",
    shape: "square",
    ...ROOT,
    path: squarePath(ROOT.cx, ROOT.cy, ROOT.width, ROOT.height),
  },
];

export const BODYGRAPH_CENTER_BY_ID: Record<BodygraphCenterId, BodygraphCenterShape> = Object.fromEntries(
  BODYGRAPH_CENTERS.map((center) => [center.id, center]),
) as Record<BodygraphCenterId, BodygraphCenterShape>;

/**
 * Channel paths: simple straight lines between the two centers each channel
 * connects. Not anatomically perfect (HD bodygraph has gate anchor points
 * on the center edges), but sufficient as an indicator of activation
 * at miniature and full sizes.
 */
export interface BodygraphChannelPath {
  channelId: string;
  gates: [number, number];
  fromCenter: BodygraphCenterId;
  toCenter: BodygraphCenterId;
  d: string;
}

interface ChannelDefinition {
  channelId: string;
  gates: [number, number];
  centers: [BodygraphCenterId, BodygraphCenterId];
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
  { channelId: "39-55", gates: [39, 55], centers: ["Root", "SolarPlexus"] },
  // Colectivo
  { channelId: "4-63", gates: [4, 63], centers: ["Ajna", "Head"] },
  { channelId: "5-15", gates: [5, 15], centers: ["Sacral", "G"] },
  { channelId: "7-31", gates: [7, 31], centers: ["G", "Throat"] },
  { channelId: "9-52", gates: [9, 52], centers: ["Sacral", "Root"] },
  { channelId: "11-56", gates: [11, 56], centers: ["Ajna", "Throat"] },
  { channelId: "13-33", gates: [13, 33], centers: ["G", "Throat"] },
  { channelId: "16-48", gates: [16, 48], centers: ["Throat", "Spleen"] },
  { channelId: "17-62", gates: [17, 62], centers: ["Ajna", "Throat"] },
  { channelId: "29-46", gates: [29, 46], centers: ["Sacral", "G"] },
  { channelId: "30-41", gates: [30, 41], centers: ["SolarPlexus", "Root"] },
  { channelId: "35-36", gates: [35, 36], centers: ["Throat", "SolarPlexus"] },
  { channelId: "42-53", gates: [42, 53], centers: ["Sacral", "Root"] },
  { channelId: "47-64", gates: [47, 64], centers: ["Ajna", "Head"] },
  // Tribal
  { channelId: "6-59", gates: [6, 59], centers: ["SolarPlexus", "Sacral"] },
  { channelId: "18-58", gates: [18, 58], centers: ["Spleen", "Root"] },
  { channelId: "19-49", gates: [19, 49], centers: ["Root", "SolarPlexus"] },
  { channelId: "21-45", gates: [21, 45], centers: ["Heart", "Throat"] },
  { channelId: "25-51", gates: [25, 51], centers: ["G", "Heart"] },
  { channelId: "26-44", gates: [26, 44], centers: ["Heart", "Spleen"] },
  { channelId: "27-50", gates: [27, 50], centers: ["Sacral", "Spleen"] },
  { channelId: "32-54", gates: [32, 54], centers: ["Spleen", "Root"] },
  { channelId: "37-40", gates: [37, 40], centers: ["SolarPlexus", "Heart"] },
  // Integración
  { channelId: "10-20", gates: [10, 20], centers: ["G", "Throat"] },
  { channelId: "10-34", gates: [10, 34], centers: ["G", "Sacral"] },
  { channelId: "10-57", gates: [10, 57], centers: ["G", "Spleen"] },
  { channelId: "20-34", gates: [20, 34], centers: ["Throat", "Sacral"] },
  { channelId: "20-57", gates: [20, 57], centers: ["Throat", "Spleen"] },
  { channelId: "34-57", gates: [34, 57], centers: ["Sacral", "Spleen"] },
];

export const BODYGRAPH_CHANNELS: BodygraphChannelPath[] = CHANNEL_DEFINITIONS.map(
  (definition) => {
    const from = BODYGRAPH_CENTER_BY_ID[definition.centers[0]];
    const to = BODYGRAPH_CENTER_BY_ID[definition.centers[1]];
    return {
      channelId: definition.channelId,
      gates: definition.gates,
      fromCenter: definition.centers[0],
      toCenter: definition.centers[1],
      d: `M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`,
    };
  },
);

export function findChannelPath(channelId: string): BodygraphChannelPath | undefined {
  return BODYGRAPH_CHANNELS.find((channel) => channel.channelId === channelId);
}
