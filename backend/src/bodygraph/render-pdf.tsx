/**
 * Renderiza el bodygraph como PDF buffer a partir de un UserProfile.
 *
 * Approach: SVG → PDF vector puro (sin rasterización), vía pdfkit +
 * svg-to-pdfkit. El SVG del bodygraph viaja como operadores PDF nativos
 * (paths, circles, polygons, text), preservando calidad vector a cualquier
 * zoom y manteniendo el texto seleccionable.
 *
 * Antes (deprecated): SVG → PNG con sharp (4800px, ~580 DPI) → embedded
 * Image en @react-pdf/renderer. El PDF resultante era ~1MB y se veía
 * pixelado al zoom porque el texto se rasterizaba como bitmap.
 *
 * Ahora: ~100KB, vector puro, texto del header/footer seleccionable y
 * con kerning correcto vía fonts TTF embebidas (Inter Regular).
 *
 * Capa: RENDER PDF (2b). Importa render-svg.ts (capa 2a) — no recalcula
 * NADA de HD, solo re-empaqueta como PDF.
 *
 * API pública:
 *   renderBodygraphPdf(profile) → Promise<Buffer>
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import type { UserProfile } from "../agent-service.js";
import { renderFullDocument } from "./render-svg.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.resolve(__dirname, "../../assets/fonts");

// A4 portrait dimensions in PDF points (1pt = 1/72 inch). 595 × 842pt.
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 24;
const USABLE_WIDTH = A4_WIDTH - 2 * MARGIN;

export async function renderBodygraphPdf(profile: UserProfile): Promise<Buffer> {
  const svg = renderFullDocument(profile, { width: 1000 });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: profile.name ? `Bodygraph — ${profile.name}` : "Bodygraph",
        Producer: "Astral · Foundation Chart",
      },
    });

    // Embeber las fonts TTF en el PDF. Mapeamos los font-family del SVG
    // (Helvetica/Arial/sans-serif por defecto) a Inter para que el texto del
    // header/footer salga con kerning consistente y embedded.
    doc.registerFont("Inter", path.join(fontsDir, "Inter-Regular.ttf"));
    doc.registerFont("Cormorant", path.join(fontsDir, "CormorantGaramond-Bold.ttf"));

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      SVGtoPDF(doc, svg, MARGIN, MARGIN, {
        width: USABLE_WIDTH,
        preserveAspectRatio: "xMidYMin meet",
        // El SVG usa font-family="Helvetica, Arial, sans-serif". Lo mapeamos
        // a Inter (embedded). svg-to-pdfkit pide retornar el nombre de la
        // font registrada en pdfkit.
        fontCallback: () => "Inter",
      });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Re-export usable A4 region for tests / callers that want to validate layout.
export const A4_BODYGRAPH_LAYOUT = {
  pageWidth: A4_WIDTH,
  pageHeight: A4_HEIGHT,
  margin: MARGIN,
  usableWidth: USABLE_WIDTH,
} as const;
