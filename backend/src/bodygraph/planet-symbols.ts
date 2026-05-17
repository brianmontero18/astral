/**
 * Astrological glyphs for the 13 Human Design bodies (Sun, Earth, Moon,
 * North/South Node, Mercury → Pluto).
 *
 * Portado de CReizner/SharpAstrology.HumanDesign.BlazorComponents (MIT)
 * PlanetSymbol.razor — son SVG paths con coordenadas normalizadas
 * (viewBox 0..1, 0..1). Renderizamos a través de `<svg viewBox="0 0 1 1">`
 * embebido y aplicamos `stroke` desde el caller via `renderPlanetGlyph()`.
 *
 * Usamos paths vectoriales en lugar de caracteres Unicode porque el output
 * va a PDF — los caracteres dependen del font fallback del renderer y no
 * son confiables. Los paths siempre renderizan idénticos.
 */

export type PlanetName =
  | "Sun" | "Earth" | "Moon"
  | "North Node" | "South Node"
  | "Mercury" | "Venus" | "Mars"
  | "Jupiter" | "Saturn"
  | "Uranus" | "Neptune" | "Pluto";

/** Inner SVG for each planet glyph (no `<svg>` wrapper). */
const PLANET_INNER: Record<PlanetName, string> = {
  "Sun": `<circle cx="0.5" cy="0.5" r="0.44"/><circle cx="0.5" cy="0.5" r="0.05"/>`,
  "Earth":
    `<circle cx="0.5" cy="0.5" r="0.44" fill="transparent"/>` +
    `<line x1="0.5" y1="0" x2="0.5" y2="1"/>` +
    `<line x1="0" y1="0.5" x2="1" y2="0.5"/>`,
  "Moon":
    `<path d="M 0.1 0.4 A 0.2 0.2 0 1 1 0.1 0.6 A 0.4 0.4 0 1 0 0.1 0.4" fill="transparent"/>`,
  "North Node":
    `<circle cx="0.3" cy="0.85" r="0.1"/>` +
    `<circle cx="0.7" cy="0.85" r="0.1"/>` +
    `<path d="M 0.4 0.85 C -0.1 0.1  1.1 0.1  0.6 0.85"/>`,
  "South Node":
    `<circle cx="0.3" cy="0.15" r="0.1"/>` +
    `<circle cx="0.7" cy="0.15" r="0.1"/>` +
    `<path d="M 0.4 0.15 C -0.1 0.9  1.1 0.9  0.6 0.15"/>`,
  "Mercury":
    `<path d="M 0.3 0 A 0.15 0.15 0 0 0 0.7 0"/>` +
    `<circle cx="0.5" cy="0.4" r="0.2"/>` +
    `<line x1="0.5" y1="0.6" x2="0.5" y2="1.1"/>` +
    `<line x1="0.3" y1="0.8" x2="0.7" y2="0.8"/>`,
  "Venus":
    `<circle cx="0.5" cy="0.27" r="0.21"/>` +
    `<line x1="0.5" y1="0.5" x2="0.5" y2="1"/>` +
    `<line x1="0.2" y1="0.7" x2="0.8" y2="0.7"/>`,
  "Mars":
    `<circle cx="0.35" cy="0.65" r="0.3"/>` +
    `<line x1="0.5" y1="0.05" x2="1" y2="0.05"/>` +
    `<line x1="0.95" y1="0" x2="0.95" y2="0.5"/>` +
    `<line x1="0.55" y1="0.45" x2="1" y2="0"/>`,
  "Jupiter":
    `<line x1="0.6" y1="0.1" x2="0.6" y2="1"/>` +
    `<line x1="0" y1="0.7" x2="1" y2="0.7"/>` +
    `<path d="M 0 0.7 Q 0.7 0.5  0.2 0"/>`,
  "Saturn":
    `<g transform="translate(0.2,0)">` +
      `<line x1="0.2" y1="0" x2="0.2" y2="0.8"/>` +
      `<line x1="0" y1="0.2" x2="0.4" y2="0.2"/>` +
      `<path d="M 0.2 0.5 C 0.4 0.3 0.8 0.6 0.4 0.8 C 0.4 0.8 0.2 1 0.5 1"/>` +
    `</g>`,
  "Uranus":
    `<circle cx="0.5" cy="0.7" r="0.25"/>` +
    `<circle cx="0.5" cy="0.7" r="0.05"/>` +
    `<line x1="0.5" y1="0.5" x2="0.5" y2="0"/>` +
    `<line x1="0.5" y1="0" x2="0.2" y2="0.3"/>` +
    `<line x1="0.5" y1="0" x2="0.8" y2="0.3"/>`,
  "Neptune":
    `<line x1="0.5" y1="0.1" x2="0.5" y2="1"/>` +
    `<line x1="0.3" y1="0.8" x2="0.7" y2="0.8"/>` +
    `<path d="M 0.1 0 Q 0.5 1.1  0.9 0"/>`,
  "Pluto":
    `<g transform="translate(0.1,0)">` +
      `<line x1="0.2" y1="0" x2="0.2" y2="1"/>` +
      `<line x1="0.2" y1="0.95" x2="0.5" y2="0.95"/>` +
      `<path d="M 0.2 0.2 C 0.8 -0.2  0.8 1  0.2 0.6"/>` +
    `</g>`,
};

/**
 * Render a planet glyph at (x, y) with given size and stroke color.
 * The glyph lives in a nested `<svg>` so its 0..1 local coords stay
 * isolated from the outer document.
 */
export function renderPlanetGlyph(
  planet: PlanetName,
  x: number,
  y: number,
  size: number,
  strokeColor: string,
): string {
  return (
    `<svg x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" ` +
    `viewBox="0 0 1 1" fill="transparent" stroke="${strokeColor}" stroke-width="0.1" ` +
    `stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">` +
    PLANET_INNER[planet] +
    `</svg>`
  );
}

function fmt(n: number): string {
  return n.toFixed(4).replace(/\.?0+$/, "");
}

/** Canonical order — matches the Genetic Matrix panel ordering. */
export const PLANET_ORDER: PlanetName[] = [
  "Sun", "Earth",
  "North Node", "South Node",
  "Moon",
  "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn",
  "Uranus", "Neptune", "Pluto",
];
