/**
 * POC endpoint: calcular bodygraph desde birth data.
 *
 * Sin autenticación a propósito — es un endpoint experimental para
 * probar la UX del flow nuevo antes de integrarlo al onboarding real.
 * Cuando pasemos a integración real, el flow va a ser:
 *   POST /me/bodygraph/from-birth
 * con el mismo body shape pero requiriendo session válida y persistiendo
 * el resultado en users.profile + (idealmente) un asset sintético.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { calculateBodygraph, type BirthData } from "../bodygraph/calculate.js";
import { renderBodygraphPdf } from "../bodygraph/render-pdf.js";
import { renderBodygraphSvg, renderFullDocument } from "../bodygraph/render-svg.js";

interface RequestBody {
  date?: unknown;
  time?: unknown;
  timezoneOffsetHours?: unknown;
  placeLabel?: unknown;
  name?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

type ParseResult =
  | { ok: true; birth: BirthData }
  | { ok: false; status: number; error: string; message: string };

function parseBirthBody(body: RequestBody): ParseResult {
  if (typeof body.date !== "string" || !DATE_RE.test(body.date)) {
    return { ok: false, status: 400, error: "invalid_date", message: "date must be YYYY-MM-DD" };
  }
  if (typeof body.time !== "string" || !TIME_RE.test(body.time)) {
    return { ok: false, status: 400, error: "invalid_time", message: "time must be HH:mm" };
  }
  if (typeof body.timezoneOffsetHours !== "number" || Number.isNaN(body.timezoneOffsetHours)) {
    return { ok: false, status: 400, error: "invalid_timezone", message: "timezoneOffsetHours must be a number" };
  }
  if (body.timezoneOffsetHours < -12 || body.timezoneOffsetHours > 14) {
    return { ok: false, status: 400, error: "invalid_timezone", message: "timezoneOffsetHours out of range" };
  }
  return {
    ok: true,
    birth: {
      date: body.date,
      time: body.time,
      timezoneOffsetHours: body.timezoneOffsetHours,
      placeLabel: typeof body.placeLabel === "string" ? body.placeLabel : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
    },
  };
}

function slugifyFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sendValidationError(reply: FastifyReply, status: number, error: string, message: string) {
  return reply.status(status).send({ error, message });
}

export async function bodygraphRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RequestBody }>("/bodygraph/preview", async (req, reply) => {
    const parsed = parseBirthBody(req.body ?? {});
    if (!parsed.ok) return sendValidationError(reply, parsed.status, parsed.error, parsed.message);

    try {
      const profile = await calculateBodygraph(parsed.birth);
      return reply.status(200).send({ profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "bodygraph preview failed");
      return reply.status(500).send({ error: "calculation_failed", message });
    }
  });

  // Iteración visual: pegás los birth params en la URL y abrís el SVG en el
  // navegador. Útil para iterar el render sin pasar por el endpoint PDF
  // (que rasteriza a PNG → más lento y sin zoom infinito).
  app.get<{ Querystring: Record<string, string | undefined> }>("/bodygraph/preview-svg", async (req, reply) => {
    const q = req.query ?? {};
    const tzRaw = q.timezoneOffsetHours ?? q.tz;
    const body: RequestBody = {
      date: q.date,
      time: q.time,
      timezoneOffsetHours: tzRaw !== undefined ? Number(tzRaw) : undefined,
      placeLabel: q.placeLabel,
      name: q.name,
    };
    const parsed = parseBirthBody(body);
    if (!parsed.ok) return sendValidationError(reply, parsed.status, parsed.error, parsed.message);

    try {
      const profile = await calculateBodygraph(parsed.birth);
      const widthRaw = q.width !== undefined ? Number(q.width) : undefined;
      const width = widthRaw && !Number.isNaN(widthRaw) ? widthRaw : 1400;
      // mode=chart → solo el bodygraph (centers + channels + gates), sin
      // header/footer/panels. Útil para embeber el chart en una UI HTML
      // responsive donde el texto va por fuera. Default: full document.
      const isChartOnly = q.mode === "chart";
      const svg = isChartOnly
        ? renderBodygraphSvg(profile, { width })
        : renderFullDocument(profile, { width });
      return reply
        .header("Content-Type", "image/svg+xml; charset=utf-8")
        .header("Cache-Control", "no-store")
        .status(200)
        .send(svg);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "bodygraph svg preview failed");
      return reply.status(500).send({ error: "svg_render_failed", message });
    }
  });

  app.post<{ Body: RequestBody }>("/bodygraph/pdf", async (req, reply) => {
    const parsed = parseBirthBody(req.body ?? {});
    if (!parsed.ok) return sendValidationError(reply, parsed.status, parsed.error, parsed.message);

    try {
      const profile = await calculateBodygraph(parsed.birth);
      const buffer = await renderBodygraphPdf(profile);
      const slug = profile.name ? slugifyFilename(profile.name) : "";
      const filename = slug ? `bodygraph-${slug}.pdf` : "bodygraph.pdf";
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .status(200)
        .send(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "bodygraph pdf failed");
      return reply.status(500).send({ error: "pdf_render_failed", message });
    }
  });
}
