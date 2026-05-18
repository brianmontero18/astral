/**
 * Renderiza un bodygraph como SVG string a partir de un UserProfile.
 *
 * Geometría: portada de SharpAstrology.HumanDesign.BlazorComponents (MIT)
 * via `svg-geometry.ts`. El layout completo (header + paneles + chart +
 * footer) sigue el estilo de Genetic Matrix.
 *
 * APIs públicas:
 * - `renderBodygraphSvg(profile)`: SVG solo del chart (uso simple).
 * - `renderFullDocument(profile)`: SVG completo con header + paneles + chart.
 *
 * Ambos producen SVG self-contained (sin assets externos), apto para
 * embeber en HTML o convertir a PDF.
 */
import type { UserProfile } from "../agent-service.js";
import {
  CENTERS,
  ALL_GATES,
  CHANNEL_PATHS,
  INTEGRATION_KNOT,
  canonicalChannelId,
  type CenterDef,
  type CenterId,
  type ChannelDef,
  type GatePoint,
  type IntegrationSpoke,
} from "./svg-geometry.js";
import {
  PLANET_ORDER,
  renderPlanetGlyph,
  type PlanetName,
} from "./planet-symbols.js";
import { findChannelById, formatChannelIdPadded } from "../hd-channels.js";

// ─── Activation helpers ─────────────────────────────────────────────────────

type Activation = "none" | "personality" | "design" | "mixed";

interface ActivationLookup {
  gate: Map<number, Activation>;
  definedCenters: Set<string>;
}

function buildLookup(profile: UserProfile): ActivationLookup {
  const personality = new Set<number>();
  const design = new Set<number>();
  for (const g of profile.humanDesign.activatedGates) {
    if (g.isPersonality) personality.add(g.number);
    else design.add(g.number);
  }
  const gate = new Map<number, Activation>();
  for (let n = 1; n <= 64; n++) {
    const p = personality.has(n);
    const d = design.has(n);
    if (p && d) gate.set(n, "mixed");
    else if (p) gate.set(n, "personality");
    else if (d) gate.set(n, "design");
    else gate.set(n, "none");
  }
  return {
    gate,
    definedCenters: new Set(profile.humanDesign.definedCenters),
  };
}

// ─── Colors (canonical HD palette) ──────────────────────────────────────────

const COLOR_PERSONALITY = "#000000";
const COLOR_DESIGN = "#C8102E";
const COLOR_UNDEFINED_FILL = "#FFFFFF";
const COLOR_STROKE = "#222222";
const COLOR_INACTIVE = "#D8D8D8";
const COLOR_GATE_TEXT_ACTIVE = "#FFFFFF";
const COLOR_GATE_TEXT_INACTIVE = "#555555";
const COLOR_HEADER_TEXT = "#2E5E3F"; // verde Genetic Matrix
const COLOR_BODY_TEXT = "#1F1F1F";

// Fixing state markers (Genetic Matrix dialect).
const COLOR_EXALTED = "#22A33C";    // △ green — planet at exalted gate.line
const COLOR_DETRIMENT = "#E5A800";  // ▽ yellow — planet at detriment gate.line

// Tone group triangles (Variable Wheel preview rendered next to each panel).
// Genetic Matrix shows green ▲ + yellow ▽ on the Design side, INVERTED on
// the Personality side (yellow ▲ + green ▽). Logic implemented in `renderToneGroup`.
const COLOR_TONE_GREEN = "#22A33C";
const COLOR_TONE_YELLOW = "#E5A800";

const CENTER_FILL: Record<CenterId, string> = {
  Head:        "#FFD12B",
  Ajna:        "#87FE49",
  Throat:      "#824B07",
  G:           "#FFD12B",
  Heart:       "#FE352C",
  Spleen:      "#824B07",
  Sacral:      "#FE352C",
  SolarPlexus: "#824B07",
  Root:        "#824B07",
};

// ─── Number formatting (avoid floating-point noise in output) ───────────────

function f(n: number): string {
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, "");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Center rendering ───────────────────────────────────────────────────────

function renderCenter(c: CenterDef, defined: boolean): string {
  const fill = defined ? CENTER_FILL[c.id] : COLOR_UNDEFINED_FILL;
  const strokeWidth = 0.004;
  const x = c.x;
  const y = c.y;
  const w = c.w;
  const h = c.h;
  const common = `fill="${fill}" stroke="${COLOR_STROKE}" stroke-width="${strokeWidth}"`;

  switch (c.shape) {
    case "triangleUp": {
      const pts = `${f(x)},${f(y + h)} ${f(x + w)},${f(y + h)} ${f(x + w / 2)},${f(y)}`;
      return `<polygon points="${pts}" ${common}/>`;
    }
    case "triangleDown": {
      const pts = `${f(x)},${f(y)} ${f(x + w)},${f(y)} ${f(x + w / 2)},${f(y + h)}`;
      return `<polygon points="${pts}" ${common}/>`;
    }
    case "roundedRect": {
      const r = Math.min(w, h) * 0.1;
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" ry="${f(r)}" ${common}/>`;
    }
    case "diamond": {
      const pts = `${f(x + w / 2)},${f(y)} ${f(x + w)},${f(y + h / 2)} ${f(x + w / 2)},${f(y + h)} ${f(x)},${f(y + h / 2)}`;
      return `<polygon points="${pts}" ${common}/>`;
    }
    case "triangleHeart": {
      const pts = `${f(x + 0.0 * w)},${f(y + 0.8 * h)} ${f(x + 0.8 * w)},${f(y + 0.0 * h)} ${f(x + 1.0 * w)},${f(y + 1.0 * h)}`;
      return `<polygon points="${pts}" ${common}/>`;
    }
    case "triangleEmotion": {
      const pts = `${f(x + 1.0 * w)},${f(y + 0.0 * h)} ${f(x + 1.0 * w)},${f(y + 1.0 * h)} ${f(x + 0.2 * w)},${f(y + 0.5 * h)}`;
      return `<polygon points="${pts}" ${common}/>`;
    }
    case "triangleSpleen": {
      const pts = `${f(x + 0.0 * w)},${f(y + 0.0 * h)} ${f(x + 0.0 * w)},${f(y + 1.0 * h)} ${f(x + 0.8 * w)},${f(y + 0.5 * h)}`;
      return `<polygon points="${pts}" ${common}/>`;
    }
  }
}

// ─── Channel rendering ──────────────────────────────────────────────────────

const CHANNEL_STROKE_WIDTH = 0.010;

function colorForActivation(a: Activation): string {
  switch (a) {
    case "personality": return COLOR_PERSONALITY;
    case "design": return COLOR_DESIGN;
    case "mixed": return COLOR_PERSONALITY;
    case "none": return COLOR_INACTIVE;
  }
}

function strokeAttrs(activation: Activation): string {
  const color = colorForActivation(activation);
  return `stroke="${color}" stroke-width="${CHANNEL_STROKE_WIDTH}" stroke-linecap="round" fill="none"`;
}

function renderLineHalf(
  start: { x: number; y: number },
  end: { x: number; y: number },
  activation: Activation,
): string {
  const baseShape = `<line x1="${f(start.x)}" y1="${f(start.y)}" x2="${f(end.x)}" y2="${f(end.y)}"`;
  const main = `${baseShape} ${strokeAttrs(activation)}/>`;
  if (activation === "mixed") {
    const overlay = `${baseShape} stroke="${COLOR_DESIGN}" stroke-width="${CHANNEL_STROKE_WIDTH}" stroke-dasharray="0.012,0.012" stroke-linecap="round"/>`;
    return main + overlay;
  }
  return main;
}

/**
 * Render half of a quadratic bezier from `start` to `end`, controlled by `control`.
 *
 * To split a quadratic bezier `Q control end` at `t=0.5` (midpoint) into
 * two halves, we use De Casteljau's algorithm:
 *   - mid = lerp(lerp(start, control, t), lerp(control, end, t), t)
 *   - first half:  Q lerp(start, control, t)  →  mid
 *   - second half: Q lerp(control, end, t)    →  end
 *
 * `which` selects which half we want.
 */
function renderCurveHalf(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  which: "first" | "second",
  activation: Activation,
): string {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const t = 0.5;
  const p01 = { x: lerp(start.x, control.x, t), y: lerp(start.y, control.y, t) };
  const p12 = { x: lerp(control.x, end.x, t), y: lerp(control.y, end.y, t) };
  const mid = { x: lerp(p01.x, p12.x, t), y: lerp(p01.y, p12.y, t) };

  let s: { x: number; y: number };
  let c: { x: number; y: number };
  let e: { x: number; y: number };
  if (which === "first") {
    s = start; c = p01; e = mid;
  } else {
    s = mid; c = p12; e = end;
  }
  const baseShape = `<path d="M ${f(s.x)} ${f(s.y)} Q ${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}"`;
  const main = `${baseShape} ${strokeAttrs(activation)}/>`;
  if (activation === "mixed") {
    const overlay = `${baseShape} stroke="${COLOR_DESIGN}" stroke-width="${CHANNEL_STROKE_WIDTH}" stroke-dasharray="0.012,0.012" stroke-linecap="round" fill="none"/>`;
    return main + overlay;
  }
  return main;
}

function renderChannel(ch: ChannelDef, lookup: ActivationLookup): string {
  // Knot channels share a hub — their visual lives in INTEGRATION_KNOT and is
  // emitted by `chartInner` as separate spokes. Per-channel render is a no-op.
  if (ch.kind === "knot") return "";

  const [g1, g2] = ch.gates;
  const a1 = lookup.gate.get(g1) ?? "none";
  const a2 = lookup.gate.get(g2) ?? "none";

  if (ch.kind === "line") {
    const mid = { x: (ch.x1 + ch.x2) / 2, y: (ch.y1 + ch.y2) / 2 };
    return (
      renderLineHalf({ x: ch.x1, y: ch.y1 }, mid, a1) +
      renderLineHalf(mid, { x: ch.x2, y: ch.y2 }, a2)
    );
  }

  // Curve. Split a quadratic bezier in half so each half can be colored
  // independently by activation.
  const start = { x: ch.x1, y: ch.y1 };
  const control = { x: ch.cx, y: ch.cy };
  const end = { x: ch.x2, y: ch.y2 };
  return (
    renderCurveHalf(start, control, end, "first", a1) +
    renderCurveHalf(start, control, end, "second", a2)
  );
}

// ─── Integration knot (gates 10, 20, 34, 57 + shared hub) ───────────────────
//
// Each gate has ONE spoke to the hub, colored by that gate's activation.
// The 6 K4 channels emerge implicitly from combinations of the 4 spokes.
// `chartInner` splits inactive vs active spokes for layering — there's no
// single "renderKnot" helper because we never paint all 4 spokes in one
// pass: each lives in a different z-layer.

function renderIntegrationSpoke(
  spoke: IntegrationSpoke,
  hub: { x: number; y: number },
  activation: Activation,
): string {
  const start = { x: spoke.x, y: spoke.y };
  if (spoke.cx !== undefined && spoke.cy !== undefined) {
    // Quadratic curve, single segment (no need to split by half — the whole
    // spoke shares the same activation).
    const baseShape = `<path d="M ${f(start.x)} ${f(start.y)} Q ${f(spoke.cx)} ${f(spoke.cy)} ${f(hub.x)} ${f(hub.y)}"`;
    const main = `${baseShape} ${strokeAttrs(activation)}/>`;
    if (activation === "mixed") {
      const overlay = `${baseShape} stroke="${COLOR_DESIGN}" stroke-width="${CHANNEL_STROKE_WIDTH}" stroke-dasharray="0.012,0.012" stroke-linecap="round" fill="none"/>`;
      return main + overlay;
    }
    return main;
  }
  // Straight spoke.
  return renderLineHalf(start, hub, activation);
}

// ─── Gate rendering ─────────────────────────────────────────────────────────

const GATE_RADIUS = 0.016;
const GATE_FONT_SIZE = 0.017;

function renderGate(g: GatePoint, activation: Activation): string {
  const r = GATE_RADIUS;
  const stroke = COLOR_STROKE;
  const strokeWidth = 0.0025;

  let circle: string;
  let textColor: string;
  if (activation === "none") {
    circle = `<circle cx="${f(g.cx)}" cy="${f(g.cy)}" r="${f(r)}" fill="#FFFFFF" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    textColor = COLOR_GATE_TEXT_INACTIVE;
  } else if (activation === "mixed") {
    const leftPath = `M ${f(g.cx)} ${f(g.cy - r)} A ${f(r)} ${f(r)} 0 0 0 ${f(g.cx)} ${f(g.cy + r)} Z`;
    const rightPath = `M ${f(g.cx)} ${f(g.cy - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(g.cx)} ${f(g.cy + r)} Z`;
    circle =
      `<path d="${leftPath}" fill="${COLOR_DESIGN}" stroke="${stroke}" stroke-width="${strokeWidth}"/>` +
      `<path d="${rightPath}" fill="${COLOR_PERSONALITY}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    textColor = COLOR_GATE_TEXT_ACTIVE;
  } else {
    const fill = activation === "design" ? COLOR_DESIGN : COLOR_PERSONALITY;
    circle = `<circle cx="${f(g.cx)}" cy="${f(g.cy)}" r="${f(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    textColor = COLOR_GATE_TEXT_ACTIVE;
  }

  const text = `<text x="${f(g.cx)}" y="${f(g.cy)}" font-size="${f(GATE_FONT_SIZE)}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-family="Helvetica, Arial, sans-serif" font-weight="bold">${g.num}</text>`;
  return circle + text;
}

// ─── Chart inner (no <svg> wrapper) ─────────────────────────────────────────

function chartInner(lookup: ActivationLookup): string {
  const centersSvg = (Object.values(CENTERS) as CenterDef[])
    .map((c) => renderCenter(c, lookup.definedCenters.has(c.id)))
    .join("");

  const inactiveChannels = CHANNEL_PATHS
    .filter((ch) => ch.kind !== "knot")
    .filter((ch) => {
      const a1 = lookup.gate.get(ch.gates[0]) ?? "none";
      const a2 = lookup.gate.get(ch.gates[1]) ?? "none";
      return a1 === "none" && a2 === "none";
    })
    .map((ch) => renderChannel(ch, lookup))
    .join("");

  const activeChannels = CHANNEL_PATHS
    .filter((ch) => ch.kind !== "knot")
    .filter((ch) => {
      const a1 = lookup.gate.get(ch.gates[0]) ?? "none";
      const a2 = lookup.gate.get(ch.gates[1]) ?? "none";
      return a1 !== "none" || a2 !== "none";
    })
    .map((ch) => renderChannel(ch, lookup))
    .join("");

  // Integration knot — render spokes split by activation so inactive ones
  // stay underneath the active ones (same layering policy as channels).
  const inactiveSpokes = INTEGRATION_KNOT.spokes
    .filter((s) => (lookup.gate.get(s.gate) ?? "none") === "none")
    .map((s) => renderIntegrationSpoke(s, INTEGRATION_KNOT.hub, "none"))
    .join("");

  const activeSpokes = INTEGRATION_KNOT.spokes
    .filter((s) => (lookup.gate.get(s.gate) ?? "none") !== "none")
    .map((s) => {
      const a = lookup.gate.get(s.gate) ?? "none";
      return renderIntegrationSpoke(s, INTEGRATION_KNOT.hub, a);
    })
    .join("");

  const gatesSvg = ALL_GATES
    .map((g) => renderGate(g, lookup.gate.get(g.num) ?? "none"))
    .join("");

  return (
    `<g id="centers">${centersSvg}</g>` +
    `<g id="channels-inactive">${inactiveChannels}${inactiveSpokes}</g>` +
    `<g id="channels-active">${activeChannels}${activeSpokes}</g>` +
    `<g id="gates">${gatesSvg}</g>`
  );
}

// ─── Planet panel ───────────────────────────────────────────────────────────
//
// Each panel is a list of 13 rows, one per body. Layout (in the panel's
// local coords 0..panelWidth × 0..panelHeight):
//
//   [ glyph ]  ── gate.line
//
// Design panel paints all glyphs/text in red; Personality in black.

interface PanelOptions {
  /** Panel top-left in the OUTER document viewBox. */
  x: number;
  y: number;
  width: number;
  height: number;
  side: "design" | "personality";
}

function getPlanetActivation(
  profile: UserProfile,
  planet: PlanetName,
  side: "design" | "personality",
): { gate: number; line: number; fixingState: "exalted" | "detriment" | null } | null {
  const target = profile.humanDesign.activatedGates.find(
    (g) => g.planet === planet && g.isPersonality === (side === "personality"),
  );
  if (!target) return null;
  return {
    gate: target.number,
    line: target.line,
    fixingState: target.fixingState ?? null,
  };
}

/**
 * Tiny equilateral triangle marker for fixing state (Exalted ▲ / Detriment ▽).
 * `pointDown` flips the triangle for the detriment variant.
 */
function renderFixingMarker(
  cx: number,
  cy: number,
  size: number,
  color: string,
  pointDown: boolean,
): string {
  const h = size; // total height
  const w = size; // total width (equilateral-ish)
  const halfW = w / 2;
  const top = cy - h / 2;
  const bot = cy + h / 2;
  const pts = pointDown
    ? `${f(cx - halfW)},${f(top)} ${f(cx + halfW)},${f(top)} ${f(cx)},${f(bot)}`
    : `${f(cx - halfW)},${f(bot)} ${f(cx + halfW)},${f(bot)} ${f(cx)},${f(top)}`;
  return `<polygon points="${pts}" fill="${color}"/>`;
}

/**
 * Triangle with a number inside — used by `renderToneGroup` to display the
 * color/tone values of a Variable. Genetic Matrix dialect: OUTLINE-only with
 * rounded corners, label in the same color (no white-on-fill).
 */
function renderNumberedTriangle(
  cx: number,
  cy: number,
  size: number,
  color: string,
  pointDown: boolean,
  label: string,
): string {
  const halfW = size / 2;
  const halfH = size / 2;
  const top = cy - halfH;
  const bot = cy + halfH;
  const pts = pointDown
    ? `${f(cx - halfW)},${f(top)} ${f(cx + halfW)},${f(top)} ${f(cx)},${f(bot)}`
    : `${f(cx - halfW)},${f(bot)} ${f(cx + halfW)},${f(bot)} ${f(cx)},${f(top)}`;
  // Number sits roughly at the geometric centroid (offset 1/6 toward the base).
  const labelY = pointDown ? cy - halfH * 0.18 : cy + halfH * 0.18;
  return (
    `<polygon points="${pts}" fill="none" stroke="${color}" stroke-width="${f(size * 0.13)}" stroke-linejoin="round"/>` +
    `<text x="${f(cx)}" y="${f(labelY)}" font-size="${f(size * 0.55)}" text-anchor="middle" ` +
    `dominant-baseline="central" fill="${color}" font-family="Helvetica, Arial, sans-serif" ` +
    `font-weight="bold">${escapeXml(label)}</text>`
  );
}

/**
 * Stylized orientation arrow + L/R circle, drawn as a single assembly à la
 * Genetic Matrix.
 *
 * The assembly is anchored by its HORIZONTAL CENTER (`cx`) so left- and
 * right-pointing variants share the exact same bounding box [cx-W/2, cx+W/2]
 * and align vertically in a column.
 *
 * Layout (totalWidth = W):
 *   - Head: triangular arrow with rounded corners. Occupies 36% of W on the
 *     `direction` side. Height ≈ 62% of W.
 *   - Stem: thick rectangle linking head and circle. Occupies 20% of W.
 *   - Letter circle: outline-only, radius ≈ 22% of W (= 44% diameter).
 *   - 36% + 20% + 44% = 100% — head, stem and circle exactly fill W.
 */
function renderOrientationArrowWithLetter(opts: {
  cx: number;
  cy: number;
  totalWidth: number;
  color: string;
  direction: "left" | "right";
  letter: "L" | "R";
}): string {
  const W = opts.totalWidth;
  const halfW = W / 2;
  const headW = W * 0.36;
  const headH = W * 0.62;
  const stemW = W * 0.20;
  const stemH = W * 0.22;
  const circleR = W * 0.22;
  const cornerR = headH * 0.18;
  const sw = W * 0.04;

  const headTopY = opts.cy - headH / 2;
  const headBotY = opts.cy + headH / 2;
  const stemTopY = opts.cy - stemH / 2;

  // Compute element X coordinates with a sign that flips by direction.
  // For LEFT: head at left end, circle at right end.
  // For RIGHT: circle at left end, head at right end.
  const isLeft = opts.direction === "left";
  const leftEdge = opts.cx - halfW;
  const rightEdge = opts.cx + halfW;

  let tipX: number;
  let headBaseX: number;
  let stemStartX: number;
  let circleCx: number;

  if (isLeft) {
    tipX = leftEdge;
    headBaseX = tipX + headW;
    stemStartX = headBaseX;
    circleCx = rightEdge - circleR;
  } else {
    circleCx = leftEdge + circleR;
    stemStartX = leftEdge + 2 * circleR;
    headBaseX = stemStartX + stemW;
    tipX = headBaseX + headW;
  }

  // Rounded triangle head. Quadratic curves at the 3 corners. `isLeft` flips
  // the horizontal direction of the curves.
  const sign = isLeft ? 1 : -1;
  const headPath = `<path d="${[
    `M ${f(tipX + sign * cornerR * 0.4)} ${f(opts.cy - cornerR * 0.2)}`,
    `Q ${f(tipX)} ${f(opts.cy)} ${f(tipX + sign * cornerR * 0.4)} ${f(opts.cy + cornerR * 0.2)}`,
    `L ${f(headBaseX - sign * cornerR)} ${f(headBotY - cornerR)}`,
    `Q ${f(headBaseX)} ${f(headBotY)} ${f(headBaseX)} ${f(headBotY - cornerR)}`,
    `L ${f(headBaseX)} ${f(headTopY + cornerR)}`,
    `Q ${f(headBaseX)} ${f(headTopY)} ${f(headBaseX - sign * cornerR)} ${f(headTopY + cornerR)}`,
    `Z`,
  ].join(" ")}" fill="${opts.color}" stroke="${opts.color}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`;

  // Stem: rectangle from headBase to the circle's near edge (slight overlap).
  const stemX = isLeft ? stemStartX - sw * 0.5 : stemStartX;
  const stemRectW = stemW + sw * 0.5;
  const stemRect = `<rect x="${f(stemX)}" y="${f(stemTopY)}" width="${f(stemRectW)}" height="${f(stemH)}" fill="${opts.color}" stroke="${opts.color}" stroke-width="${f(sw * 0.5)}"/>`;

  // Letter circle: outline-only with white fill so the letter reads on a clean disc.
  const circleStrokeW = circleR * 0.22;
  const letterCircle =
    `<circle cx="${f(circleCx)}" cy="${f(opts.cy)}" r="${f(circleR)}" ` +
    `fill="white" stroke="${opts.color}" stroke-width="${f(circleStrokeW)}"/>` +
    `<text x="${f(circleCx)}" y="${f(opts.cy)}" font-size="${f(circleR * 1.25)}" ` +
    `text-anchor="middle" dominant-baseline="central" fill="${opts.color}" ` +
    `font-family="Helvetica, Arial, sans-serif" font-weight="bold">${opts.letter}</text>`;

  return headPath + stemRect + letterCircle;
}

interface ToneGroupOptions {
  /** Variable to read color/tone/orientation from. */
  variable: { orientation: "left" | "right"; color: number; tone: number };
  /** Left edge of the group in viewport coordinates. */
  x: number;
  /** Vertical center of the group in viewport coordinates. */
  cy: number;
  /** Total width allotted to the group. */
  width: number;
  /** Per-side color logic: design uses ▲green+▽yellow, personality inverts. */
  side: "design" | "personality";
}

/**
 * Renders the Variable summary block shown by Genetic Matrix between each
 * planet panel and the chart:
 *   - Orientation arrow (◁ / ▷) reflecting the Variable's left/right orientation.
 *   - Letter circle (L or R) matching the orientation, drawn just after the arrow.
 *   - 2 numbered triangles for color + tone.
 *
 * Encoding (Genetic Matrix dialect, validated against Foundation Charts of
 * Agos + Brian):
 *   - GREEN triangle (#22A33C) always encodes `tone` (1..6).
 *   - YELLOW triangle (#E5A800) always encodes `color` (1..6).
 *   - Design side renders GREEN as ▲ + YELLOW as ▽.
 *   - Personality side INVERTS: YELLOW as ▲ + GREEN as ▽.
 *
 * Orientation comes from `toneToOrientation(tone)` in hd-meta (tone ≤ 3 → left).
 */
function renderToneGroup(opts: ToneGroupOptions): string {
  // Genetic Matrix layout: arrow assembly stacked ABOVE the two triangles.
  //
  //   ┌─────────────────────┐
  //   │  [arrow + L circle] │  ← top row, spans full width
  //   │     [▲]    [▽]      │  ← bottom row, 2 triangles side by side
  //   └─────────────────────┘
  const rowGap = opts.width * 0.05;
  const arrowCy = opts.cy - opts.width * 0.30; // upper row vertical center
  const triCy = opts.cy + opts.width * 0.30;   // lower row vertical center

  // Arrow + L circle assembly: spans most of the group width, centered.
  const assemblyWidth = opts.width * 0.85;
  const assemblyCx = opts.x + opts.width / 2;

  // Two triangles side by side, sharing the full width of the row.
  const triSize = opts.width * 0.40;
  const xUp = opts.x + opts.width * 0.30;
  const xDown = opts.x + opts.width * 0.70;
  void rowGap; // keep for future spacing tweaks

  // Per-side mapping. Universal rule: green = tone, yellow = color. Which one
  // sits on top (▲) flips by side.
  const upIsGreen = opts.side === "design";
  const upColor = upIsGreen ? COLOR_TONE_GREEN : COLOR_TONE_YELLOW;
  const downColor = upIsGreen ? COLOR_TONE_YELLOW : COLOR_TONE_GREEN;
  const upValue = upIsGreen ? opts.variable.tone : opts.variable.color;
  const downValue = upIsGreen ? opts.variable.color : opts.variable.tone;
  const sideColor = opts.side === "design" ? COLOR_DESIGN : COLOR_PERSONALITY;

  const arrowLeft = opts.variable.orientation === "left";
  const arrowAssembly = renderOrientationArrowWithLetter({
    cx: assemblyCx,
    cy: arrowCy,
    totalWidth: assemblyWidth,
    color: sideColor,
    direction: arrowLeft ? "left" : "right",
    letter: arrowLeft ? "L" : "R",
  });

  return (
    arrowAssembly +
    renderNumberedTriangle(xUp, triCy, triSize, upColor, false, String(upValue)) +
    renderNumberedTriangle(xDown, triCy, triSize, downColor, true, String(downValue))
  );
}

function renderPlanetPanel(profile: UserProfile, opts: PanelOptions): string {
  const color = opts.side === "design" ? COLOR_DESIGN : COLOR_PERSONALITY;
  const rowH = opts.height / PLANET_ORDER.length;
  const padX = opts.width * 0.06;
  const glyphSize = Math.min(rowH * 0.7, opts.width * 0.18);
  const fontSize = rowH * 0.42;

  const headerText = opts.side === "design" ? "Diseño" : "Personalidad";

  let svg = "";
  // Panel header text (above the rows). Placed outside the rows area, so
  // we draw it at y = opts.y - rowH*0.4 (just above the panel).
  svg += `<text x="${f(opts.x + opts.width / 2)}" y="${f(opts.y - 0.02)}" ` +
    `font-size="${f(rowH * 0.45)}" text-anchor="middle" fill="${color}" ` +
    `font-family="Helvetica, Arial, sans-serif" font-weight="bold">${escapeXml(headerText)}</text>`;

  const markerSize = rowH * 0.28;

  for (let i = 0; i < PLANET_ORDER.length; i++) {
    const planet = PLANET_ORDER[i];
    const rowTop = opts.y + i * rowH;
    const rowCenterY = rowTop + rowH / 2;
    // Glyph at left.
    const glyphX = opts.x + padX;
    const glyphY = rowCenterY - glyphSize / 2;
    svg += renderPlanetGlyph(planet, glyphX, glyphY, glyphSize, color);
    // Fixing state marker (△ Exalted / ▽ Detriment) between glyph and label.
    const act = getPlanetActivation(profile, planet, opts.side);
    if (act?.fixingState) {
      const markerCx = glyphX + glyphSize + opts.width * 0.04;
      const pointDown = act.fixingState === "detriment";
      const markerColor = act.fixingState === "exalted" ? COLOR_EXALTED : COLOR_DETRIMENT;
      svg += renderFixingMarker(markerCx, rowCenterY, markerSize, markerColor, pointDown);
    }
    // Gate.line text at right.
    const label = act ? `${act.gate}.${act.line}` : "—";
    const textX = opts.x + padX + glyphSize + opts.width * 0.08;
    svg +=
      `<text x="${f(textX)}" y="${f(rowCenterY)}" ` +
      `font-size="${f(fontSize)}" dominant-baseline="central" fill="${color}" ` +
      `font-family="Helvetica, Arial, sans-serif" font-weight="bold">${escapeXml(label)}</text>`;
  }
  return svg;
}

// ─── Header ─────────────────────────────────────────────────────────────────
//
// Top strip showing identity + the headline HD properties.

interface HeaderOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MONTH_SHORT_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Format a birth ISO ("1988-12-28T03:13:00-03:00") as "28 dic 1988 03:13". */
function formatBirthIsoForHeader(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  if (!datePart || !timePart) return iso;
  const [y, m, d] = datePart.split("-").map(Number);
  const hhmm = timePart.substring(0, 5);
  return `${d} ${MONTH_SHORT_ES[m - 1]} ${y} ${hhmm}`;
}

function renderHeader(profile: UserProfile, opts: HeaderOptions): string {
  const hd = profile.humanDesign;
  const birth = profile.birthData;
  const padX = 0.02;
  const left = opts.x + padX;
  const right = opts.x + opts.width - padX;
  const titleSize = opts.height * 0.18;
  const lineSize = opts.height * 0.085;

  let svg = "";
  // Title (name + type prefixed by qualifier when present).
  const typeDisplay = hd.typeQualifier
    ? `${hd.typeQualifier} ${hd.type}`
    : hd.type;
  const titleText = `${profile.name || "Bodygraph"}${typeDisplay ? ` — ${typeDisplay}` : ""}`;
  svg +=
    `<text x="${f(left)}" y="${f(opts.y + titleSize)}" ` +
    `font-size="${f(titleSize)}" fill="${COLOR_HEADER_TEXT}" ` +
    `font-family="Helvetica, Arial, sans-serif" font-weight="bold">${escapeXml(titleText)}</text>`;

  // Field rows. We render two columns of label/value pairs.
  const fields: Array<{ label: string; value: string }> = [
    { label: "Perfil", value: hd.profileName ? `${hd.profile} — ${hd.profileName}` : hd.profile },
    { label: "Autoridad", value: hd.authority },
    { label: "Definición", value: hd.definition },
    { label: "Estrategia", value: hd.strategy },
    { label: "Temas", value: hd.themes ? `${hd.themes.positive} / ${hd.themes.notSelf}` : hd.notSelfTheme },
    { label: "Cruz de Encarnación", value: hd.incarnationCross || "—" },
  ];

  if (birth) {
    if (birth.placeLabel) {
      fields.unshift({ label: "Lugar", value: birth.placeLabel });
    }
    fields.unshift({
      label: "Nacimiento (UTC)",
      value: formatBirthIsoForHeader(birth.dateUtcIso),
    });
    fields.unshift({
      label: "Nacimiento (local)",
      value: formatBirthIsoForHeader(birth.dateLocalIso),
    });
  }

  // Two columns, side-by-side. Each row about `lineSize * 1.4` tall.
  const colGap = (right - left) * 0.5;
  // Gap entre el título (nombre + tipo) y la primera fila de datos. Aumentado
  // de 1.3 → 2.2 lineSize para que el título respire.
  const startY = opts.y + titleSize + lineSize * 2.2;
  const rowH = lineSize * 1.45;
  for (let i = 0; i < fields.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = left + col * colGap;
    const y = startY + row * rowH;
    const text = `${fields[i].label}: ${fields[i].value || "—"}`;
    svg +=
      `<text x="${f(x)}" y="${f(y)}" font-size="${f(lineSize)}" fill="${COLOR_BODY_TEXT}" ` +
      `font-family="Helvetica, Arial, sans-serif">${escapeXml(text)}</text>`;
  }

  return svg;
}

// ─── Footer (Design + Personality + Channels blocks) ────────────────────────
//
// Tres columnas debajo del chart con los 13 labels del Variable Wheel + lista
// de canales activos (con names en inglés, en formato "GGgg - Name" matching
// Genetic Matrix).

interface FooterOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Format an ISO date for the "Fecha del Diseño" row (short ES, matches header style). */
function formatDesignDateEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTH_SHORT_ES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hh}:${mm}`;
}

function renderFooter(profile: UserProfile, opts: FooterOptions): string {
  const hd = profile.humanDesign;
  const labels = hd.variableLabels;
  if (!labels) return "";

  const colGap = opts.width * 0.02;
  const colW = (opts.width - 2 * colGap) / 3;
  // Font sizes matched to renderHeader (titleSize = header.h*0.18 ≈ 0.054,
  // lineSize = header.h*0.085 ≈ 0.0255). We use fixed values so they're not
  // sensitive to footer.height changes.
  const titleSize = 0.040;
  const lineSize = 0.0255;
  const lineH = lineSize * 1.45;

  const renderBlock = (
    title: string,
    rows: Array<{ label: string; value: string; separator?: string }>,
    colIndex: number,
  ): string => {
    const x = opts.x + colIndex * (colW + colGap);
    let chunk = "";
    chunk +=
      `<text x="${f(x)}" y="${f(opts.y + titleSize)}" font-size="${f(titleSize)}" ` +
      `fill="${COLOR_HEADER_TEXT}" font-family="Helvetica, Arial, sans-serif" font-weight="bold">${escapeXml(title)}</text>`;
    // Gap entre título de bloque (Diseño / Personalidad / Canales) y la
    // primera fila de datos. Aumentado de 0.6 → 1.4 lineH para que el título
    // verde no quede pegado a la primera línea.
    const startY = opts.y + titleSize + lineH * 1.4;
    for (let i = 0; i < rows.length; i++) {
      const y = startY + i * lineH;
      const sep = rows[i].separator ?? ": ";
      const text = `${rows[i].label}${sep}${rows[i].value || "—"}`;
      chunk +=
        `<text x="${f(x)}" y="${f(y)}" font-size="${f(lineSize)}" ` +
        `fill="${COLOR_BODY_TEXT}" font-family="Helvetica, Arial, sans-serif">${escapeXml(text)}</text>`;
    }
    return chunk;
  };

  // Design block. Labels en español (consistencia con header); valores en HD
  // canon (inglés) por ahora — añadir i18n de valores cuando haya tablas
  // validadas de traducción.
  const designRows: Array<{ label: string; value: string }> = [];
  if (hd.design?.date) {
    designRows.push({ label: "Fecha del Diseño", value: formatDesignDateEs(hd.design.date) });
  }
  designRows.push(
    { label: "Cerebro", value: labels.brain },
    { label: "Determinación", value: labels.determination },
    { label: "Cognición", value: labels.cognition },
    { label: "Ambiente", value: labels.environmentDetail },
    { label: "Estilo de Ambiente", value: labels.environmentStyle },
  );

  // Personality block.
  const personalityRows: Array<{ label: string; value: string }> = [
    { label: "Personalidad", value: labels.personality },
    { label: "Motivación", value: labels.motivation },
    { label: "Sentido", value: labels.sense },
    { label: "Trayectoria", value: labels.trajectory },
    { label: "Perspectiva", value: labels.viewPerspective },
    { label: "Visión", value: labels.view },
    { label: "Motivación Transferida", value: labels.transferredMotivation },
    { label: "Visión Transferida", value: labels.transferredView },
  ];

  // Channels block. Format: "GGgg - Name" (Genetic Matrix dialect). English
  // name from hd-channels.ts `nameEn`.
  const channelRows: Array<{ label: string; value: string; separator?: string }> = hd.channels.map((ch) => {
    const meta = findChannelById(ch.id);
    const nameEn = meta?.nameEn ?? ch.name;
    return { label: formatChannelIdPadded(ch.id), value: nameEn, separator: " - " };
  });

  let svg = "";
  svg += renderBlock("Diseño", designRows, 0);
  svg += renderBlock("Personalidad", personalityRows, 1);
  svg += renderBlock("Canales", channelRows, 2);
  return svg;
}

// ─── Public API: chart-only SVG ─────────────────────────────────────────────

export interface RenderOptions {
  /** SVG width attribute. Defaults to 600 (px). */
  width?: number;
  /** SVG height attribute. Defaults to 900 (px), preserving the 1:1.5 ratio. */
  height?: number;
}

const VIEWBOX_MARGIN = 0.04;

export function renderBodygraphSvg(profile: UserProfile, opts: RenderOptions = {}): string {
  const lookup = buildLookup(profile);

  const width = opts.width ?? 600;
  const height = opts.height ?? 900;
  const vbX = -VIEWBOX_MARGIN;
  const vbY = -VIEWBOX_MARGIN;
  const vbW = 1 + 2 * VIEWBOX_MARGIN;
  const vbH = 1.5 + 2 * VIEWBOX_MARGIN;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vbX)} ${f(vbY)} ${f(vbW)} ${f(vbH)}" width="${width}" height="${height}">` +
    chartInner(lookup) +
    `</svg>`;
}

/**
 * Returns the canonical ids of channels active in the profile, intersected
 * against the geometry's known channel set. Useful for tests and debugging.
 */
export function activeChannelIds(profile: UserProfile): string[] {
  const lookup = buildLookup(profile);
  const out: string[] = [];
  for (const ch of CHANNEL_PATHS) {
    const a1 = lookup.gate.get(ch.gates[0]) ?? "none";
    const a2 = lookup.gate.get(ch.gates[1]) ?? "none";
    if (a1 !== "none" && a2 !== "none") {
      out.push(canonicalChannelId(ch.gates));
    }
  }
  return out.sort();
}

// ─── Public API: full document (header + paneles + chart) ───────────────────

export interface FullDocumentOptions {
  /** SVG width attribute. Defaults to 1000 (px). */
  width?: number;
  /** SVG height attribute. Defaults to ~1042 (px) preserving 2.4:2.5 aspect ratio. */
  height?: number;
}

/**
 * Render a complete PDF-ready document with:
 *   - Header (top): identity, type, profile, authority, definition, themes.
 *   - Design panel (left, red): 13 planet glyphs + gate.line.
 *   - Bodygraph chart (center): 9 centers, 36 channels, 64 gates.
 *   - Personality panel (right, black): 13 planet glyphs + gate.line.
 *
 * Layout viewBox: 0 0 2.4 2.5 (portrait-ish). The chart keeps its native
 * 1.0×1.5 ratio inside.
 */
export function renderFullDocument(
  profile: UserProfile,
  opts: FullDocumentOptions = {},
): string {
  const lookup = buildLookup(profile);

  // Outer viewBox. Height extended from 2.5 → 2.95 to accommodate the footer
  // (Design + Personality + Channels blocks below the chart).
  const vbX = 0;
  const vbY = 0;
  const vbW = 2.4;
  const vbH = 2.95;
  const width = opts.width ?? 1000;
  // Preserve aspect ratio.
  const height = opts.height ?? Math.round((width * vbH) / vbW);

  // Layout regions.
  const header = { x: 0.10, y: 0.05, w: 2.20, h: 0.30 };
  const chart =  { x: 0.65, y: 0.45, w: 1.00, h: 1.50 };
  // Panels shrunk slightly (0.45 → 0.40) to make room for the tone groups
  // between panels and chart (was 0.10 wide, now 0.15 — Genetic Matrix style).
  const designP = { x: 0.10, y: 0.50, w: 0.40, h: 1.40 };
  const personP = { x: 1.80, y: 0.50, w: 0.40, h: 1.40 };
  const footer =  { x: 0.10, y: 2.05, w: 2.20, h: 0.85 };

  // 1. Header (reads birth metadata from profile.birthData if present).
  const headerSvg = renderHeader(profile, {
    x: header.x, y: header.y, width: header.w, height: header.h,
  });

  // 2. Chart (translated + scaled into the chart region).
  // chartInner produces shapes in viewBox 0..1 × 0..1.5. The chart region is
  // already 1.0×1.5 so scale=1; we just translate.
  const chartGroup =
    `<g transform="translate(${f(chart.x)} ${f(chart.y)})">` +
    chartInner(lookup) +
    `</g>`;

  // 3. Design panel.
  const designPanelSvg = renderPlanetPanel(profile, {
    x: designP.x, y: designP.y, width: designP.w, height: designP.h,
    side: "design",
  });

  // 4. Personality panel.
  const personPanelSvg = renderPlanetPanel(profile, {
    x: personP.x, y: personP.y, width: personP.w, height: personP.h,
    side: "personality",
  });

  // 5. Tone groups: 2 per side (Sun/Earth and NN/SN rows) showing color + tone
  // of each Variable (digestion, environment, awareness, perspective). Only
  // drawn if the variables block is populated in the DTO.
  let toneGroupsSvg = "";
  const variables = profile.humanDesign.variables;
  if (variables) {
    // Vertically align each group between rows 0+1 (Sun/Earth) and rows 2+3
    // (NN/SN) of the planet panels. PLANET_ORDER[0..3] = Sun, Earth, NN, SN.
    const panelRowH = designP.h / PLANET_ORDER.length;
    const sunEarthCy = designP.y + panelRowH * 1.0;
    const nnSnCy = designP.y + panelRowH * 3.0;
    // Groups occupy the gap between each panel and the chart.
    const designGroupX = designP.x + designP.w + 0.005;
    const designGroupW = chart.x - designGroupX - 0.005;
    const personGroupX = chart.x + chart.w + 0.005;
    const personGroupW = personP.x - personGroupX - 0.005;

    toneGroupsSvg += renderToneGroup({
      variable: variables.digestion,
      x: designGroupX, cy: sunEarthCy, width: designGroupW, side: "design",
    });
    toneGroupsSvg += renderToneGroup({
      variable: variables.environment,
      x: designGroupX, cy: nnSnCy, width: designGroupW, side: "design",
    });
    toneGroupsSvg += renderToneGroup({
      variable: variables.awareness,
      x: personGroupX, cy: sunEarthCy, width: personGroupW, side: "personality",
    });
    toneGroupsSvg += renderToneGroup({
      variable: variables.perspective,
      x: personGroupX, cy: nnSnCy, width: personGroupW, side: "personality",
    });
  }

  // 6. Footer: Design + Personality + Channels blocks.
  const footerSvg = renderFooter(profile, {
    x: footer.x, y: footer.y, width: footer.w, height: footer.h,
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${width}" height="${height}">` +
    `<rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#FFFFFF"/>` +
    `<g id="header">${headerSvg}</g>` +
    `<g id="panel-design">${designPanelSvg}</g>` +
    `<g id="chart">${chartGroup}</g>` +
    `<g id="panel-personality">${personPanelSvg}</g>` +
    `<g id="tone-groups">${toneGroupsSvg}</g>` +
    `<g id="footer">${footerSvg}</g>` +
    `</svg>`
  );
}
