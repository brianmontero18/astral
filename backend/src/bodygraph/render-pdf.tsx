/**
 * Renderiza un bodygraph como PDF buffer a partir de un UserProfile.
 *
 * Approach: SVG → PNG → PDF.
 *
 * Por qué: ya tenemos `renderFullDocument(profile)` en render-svg.ts que produce
 * el SVG completo (header + paneles + chart). Embeber ese SVG como PNG en una
 * página A4 vía @react-pdf/renderer es mucho más simple que portar 600 líneas
 * de drawing logic a primitivos JSX. Tradeoff: el chart va rasterizado en el
 * PDF, no vectorial. A 2400px de ancho la calidad es nítida en A4 (≈300 DPI).
 *
 * Capa: RENDER PDF (2b). Importa render-svg.ts (capa 2a) como dependencia de
 * presentación — render-pdf NO recalcula NADA de HD, solo re-empaqueta. Esta
 * decisión deroga la línea "render-pdf.tsx NO importa render-svg.ts" del bead
 * astral-ur2 original, que estaba atada al approach de full-port; el nuevo
 * approach (SVG embedded) hace que esa importación sea explícitamente correcta.
 *
 * API pública:
 *   renderBodygraphPdf(profile) → Promise<Buffer>
 */
import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import sharp from "sharp";
import type { UserProfile } from "../agent-service.js";
import { renderFullDocument } from "./render-svg.js";

/**
 * Width (in pixels) at which the SVG is rasterized to PNG. A4 portrait has
 * a printable area of ~595pt wide. 2400px ≈ 290 DPI which is print-grade.
 */
const PNG_RENDER_WIDTH = 2400;

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  chart: {
    width: "100%",
    objectFit: "contain",
  },
});

async function svgToPngBuffer(svg: string): Promise<Buffer> {
  // `density` controls the rendering DPI when sharp parses the SVG. Higher
  // density = sharper rasterization. The output is then constrained to
  // PNG_RENDER_WIDTH so the dimensions are predictable regardless of the
  // SVG's intrinsic size.
  return sharp(Buffer.from(svg), { density: 300 })
    .resize({ width: PNG_RENDER_WIDTH })
    .png()
    .toBuffer();
}

interface DocumentProps {
  pngBase64: string;
  title: string;
}

function BodygraphPdfDocument({ pngBase64, title }: DocumentProps): React.ReactElement {
  return (
    <Document title={title}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <Image src={`data:image/png;base64,${pngBase64}`} style={styles.chart} />
      </Page>
    </Document>
  );
}

export async function renderBodygraphPdf(profile: UserProfile): Promise<Buffer> {
  const svg = renderFullDocument(profile, { width: PNG_RENDER_WIDTH });
  const png = await svgToPngBuffer(svg);
  const title = profile.name ? `Bodygraph — ${profile.name}` : "Bodygraph";
  return renderToBuffer(
    <BodygraphPdfDocument pngBase64={png.toString("base64")} title={title} />,
  );
}
