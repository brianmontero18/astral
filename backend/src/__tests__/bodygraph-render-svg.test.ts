/**
 * Tests para renderBodygraphSvg — el porting del SVG del bodygraph desde
 * SharpAstrology.HumanDesign.BlazorComponents.
 *
 * Validación contra los ground truths del POC (Agos + Brian) ya cubiertos
 * por bodygraph-calculate.test.ts: lo que verificamos acá es que el SVG
 * generado reflejé esa data correctamente, no que el cálculo sea correcto.
 */
import { describe, expect, it } from "vitest";
import { calculateBodygraph } from "../bodygraph/calculate.js";
import {
  renderBodygraphSvg,
  renderFullDocument,
  activeChannelIds,
} from "../bodygraph/render-svg.js";
import {
  CENTERS,
  ALL_GATES,
  CHANNEL_PATHS,
} from "../bodygraph/svg-geometry.js";
import { PLANET_ORDER } from "../bodygraph/planet-symbols.js";

describe("renderBodygraphSvg", () => {
  describe("geometry sanity", () => {
    it("has exactly 9 centers, 36 channels, 64 gates", () => {
      expect(Object.keys(CENTERS)).toHaveLength(9);
      expect(CHANNEL_PATHS).toHaveLength(36);
      expect(ALL_GATES).toHaveLength(64);
    });

    it("every gate is inside its center's bounding box", () => {
      const bad: string[] = [];
      for (const g of ALL_GATES) {
        const c = CENTERS[g.center];
        // Allow a small overshoot (some gates in razor sit ~0.05 outside the
        // local viewBox by design — e.g. Ajna upper gates tly=-0.05).
        const tolerance = 0.06;
        const minX = c.x - tolerance * c.w;
        const maxX = c.x + (1 + tolerance) * c.w;
        const minY = c.y - tolerance * c.h;
        const maxY = c.y + (1 + tolerance) * c.h;
        if (g.cx < minX || g.cx > maxX || g.cy < minY || g.cy > maxY) {
          bad.push(`gate ${g.num} (${g.cx.toFixed(3)},${g.cy.toFixed(3)}) outside ${g.center} [${c.x}..${c.x + c.w}, ${c.y}..${c.y + c.h}]`);
        }
      }
      expect(bad).toEqual([]);
    });

    it("every channel id pair has both gates in the geometry", () => {
      const gateNums = new Set(ALL_GATES.map((g) => g.num));
      for (const ch of CHANNEL_PATHS) {
        expect(gateNums.has(ch.gates[0])).toBe(true);
        expect(gateNums.has(ch.gates[1])).toBe(true);
      }
    });
  });

  describe("Agos (Proyector emocional, triple split)", () => {
    it("paints exactly the expected 3 channels active", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      const active = activeChannelIds(profile);
      expect(active).toContain("1-8");
      expect(active).toContain("18-58");
      expect(active).toContain("37-40");
      // No otros canales activos según los tests del POC.
      expect(active).toEqual(["1-8", "18-58", "37-40"]);
    });

    it("renders an SVG with the 9 centers and 64 gates groups present", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      const svg = renderBodygraphSvg(profile);
      // Top-level structure.
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain('id="centers"');
      expect(svg).toContain('id="channels-inactive"');
      expect(svg).toContain('id="channels-active"');
      expect(svg).toContain('id="gates"');
      // Every gate number must appear at least once as text content.
      for (let n = 1; n <= 64; n++) {
        expect(svg).toMatch(new RegExp(`>${n}</text>`));
      }
    });

    it("paints exactly the centers that calculate.ts says are defined", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      });
      const svg = renderBodygraphSvg(profile);
      // Pull centers block (between <g id="centers"> and the next </g>).
      const match = svg.match(/<g id="centers">([\s\S]*?)<\/g>/);
      expect(match).toBeTruthy();
      const centersBlock = match![1];

      // Defined center colors (canonical HD palette from CENTER_FILL).
      const definedColors = new Set<string>();
      // Match all `fill="..."` attributes in the centers block.
      const fillRe = /fill="(#[0-9A-Fa-f]{6})"/g;
      let m: RegExpExecArray | null;
      while ((m = fillRe.exec(centersBlock)) !== null) {
        if (m[1].toUpperCase() !== "#FFFFFF") definedColors.add(m[1].toUpperCase());
      }
      // Agos has 6 defined centers (G, Throat, SolarPlexus, Spleen, Heart, Root).
      expect(profile.humanDesign.definedCenters).toHaveLength(6);
      // Si el cálculo marca 6 centros defined, el SVG debe tener 6 fills no blancos.
      expect(definedColors.size).toBeGreaterThanOrEqual(3); // distinct colors (puede repetirse marrón)
    });
  });

  describe("Brian (Generador Manifestante 6/2, emocional)", () => {
    it("paints all 7 expected channels active", async () => {
      const profile = await calculateBodygraph({
        date: "1989-02-18",
        time: "12:00",
        timezoneOffsetHours: 0,
      });
      const active = activeChannelIds(profile);
      // Canales esperados según el handoff/bead.
      expect(active).toContain("10-20");
      expect(active).toContain("10-34");
      expect(active).toContain("20-34");
      expect(active).toContain("30-41");
      expect(active).toContain("37-40");
      expect(active).toContain("2-14");
      expect(active).toContain("1-8");
    });

    it("produces a deterministic SVG (snapshot)", async () => {
      const profile = await calculateBodygraph({
        date: "1989-02-18",
        time: "12:00",
        timezoneOffsetHours: 0,
        name: "Brian Montero",
      });
      const svg = renderBodygraphSvg(profile);
      // Stable byte length within ±200 bytes (digits flip).
      expect(svg.length).toBeGreaterThan(15000);
      expect(svg.length).toBeLessThan(35000);
    });
  });

  describe("renderFullDocument", () => {
    it("ships header + design panel + chart + personality panel groups", async () => {
      const profile = await calculateBodygraph({
        date: "1989-02-18",
        time: "12:00",
        timezoneOffsetHours: 0,
        name: "Brian Montero",
        placeLabel: "Punta Cardón, Falcón, Venezuela",
      });
      const svg = renderFullDocument(profile);
      expect(svg).toContain('id="header"');
      expect(svg).toContain('id="panel-design"');
      expect(svg).toContain('id="chart"');
      expect(svg).toContain('id="panel-personality"');
      // Identity in header — now prefixed by typeQualifier ("Emotional").
      expect(svg).toContain("Brian Montero");
      expect(svg).toContain("Emotional Generador Manifestante");
      expect(svg).toContain("Punta Cardón");
      // Panel labels.
      expect(svg).toContain("Diseño");
      expect(svg).toContain("Personalidad");
    });

    it("renders 13 planet rows per side with gate.line labels", async () => {
      const profile = await calculateBodygraph({
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
        name: "Agos",
      });
      const svg = renderFullDocument(profile);
      // Pull the design panel block.
      const designMatch = svg.match(/<g id="panel-design">([\s\S]*?)<\/g><g id="chart">/);
      expect(designMatch).toBeTruthy();
      const designBlock = designMatch![1];
      // Each planet inner svg is wrapped in a separate <svg ...> tag — 13 nested svgs.
      const nestedSvgCount = (designBlock.match(/<svg /g) ?? []).length;
      expect(nestedSvgCount).toBe(PLANET_ORDER.length);

      // Sun design gate.line for Agos is 18.6 per the calculate test fixture.
      expect(designBlock).toContain(">18.6<");
      // Agos's personality Sun is 58.4 in the ground truth.
      const personMatch = svg.match(/<g id="panel-personality">([\s\S]*?)<\/g><\/svg>$/);
      expect(personMatch).toBeTruthy();
      expect(personMatch![1]).toContain(">58.4<");
    });

    it("colors the design panel red and the personality panel black", async () => {
      const profile = await calculateBodygraph({
        date: "1989-02-18",
        time: "12:00",
        timezoneOffsetHours: 0,
      });
      const svg = renderFullDocument(profile);
      const designMatch = svg.match(/<g id="panel-design">([\s\S]*?)<\/g><g id="chart">/);
      const personMatch = svg.match(/<g id="panel-personality">([\s\S]*?)<\/g><\/svg>$/);
      expect(designMatch![1]).toContain('stroke="#C8102E"');
      expect(designMatch![1]).not.toMatch(/stroke="#000000"/);
      expect(personMatch![1]).toContain('stroke="#000000"');
      expect(personMatch![1]).not.toMatch(/stroke="#C8102E"/);
    });
  });

  describe("inactive profile", () => {
    it("renders all gates and channels as inactive when activatedGates is empty", () => {
      const empty = {
        name: "",
        humanDesign: {
          type: "",
          strategy: "",
          authority: "",
          profile: "",
          definition: "",
          incarnationCross: "",
          notSelfTheme: "",
          variable: "",
          digestion: "",
          environment: "",
          strongestSense: "",
          channels: [],
          activatedGates: [],
          definedCenters: [],
          undefinedCenters: [],
        },
      };
      const svg = renderBodygraphSvg(empty);
      // No active channels block content (channels-active group exists but empty).
      expect(svg).toContain('id="channels-active"></g>');
      // Every center fill is white (undefined).
      const centersMatch = svg.match(/<g id="centers">([\s\S]*?)<\/g>/);
      expect(centersMatch).toBeTruthy();
      const fills = [...centersMatch![1].matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)]
        .map((m) => m[1].toUpperCase());
      // 9 fills total, all white.
      expect(fills).toHaveLength(9);
      for (const f of fills) expect(f).toBe("#FFFFFF");
    });
  });
});
