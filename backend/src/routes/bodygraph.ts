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
import type { FastifyInstance } from "fastify";
import { calculateBodygraph, type BirthData } from "../bodygraph/calculate.js";

interface RequestBody {
  date?: unknown;
  time?: unknown;
  timezoneOffsetHours?: unknown;
  placeLabel?: unknown;
  name?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export async function bodygraphRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RequestBody }>("/bodygraph/preview", async (req, reply) => {
    const body = req.body ?? {};

    if (typeof body.date !== "string" || !DATE_RE.test(body.date)) {
      return reply.status(400).send({ error: "invalid_date", message: "date must be YYYY-MM-DD" });
    }
    if (typeof body.time !== "string" || !TIME_RE.test(body.time)) {
      return reply.status(400).send({ error: "invalid_time", message: "time must be HH:mm" });
    }
    if (typeof body.timezoneOffsetHours !== "number" || Number.isNaN(body.timezoneOffsetHours)) {
      return reply.status(400).send({ error: "invalid_timezone", message: "timezoneOffsetHours must be a number" });
    }
    if (body.timezoneOffsetHours < -12 || body.timezoneOffsetHours > 14) {
      return reply.status(400).send({ error: "invalid_timezone", message: "timezoneOffsetHours out of range" });
    }

    const birth: BirthData = {
      date: body.date,
      time: body.time,
      timezoneOffsetHours: body.timezoneOffsetHours,
      placeLabel: typeof body.placeLabel === "string" ? body.placeLabel : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
    };

    try {
      const profile = await calculateBodygraph(birth);
      return reply.status(200).send({ profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "bodygraph preview failed");
      return reply.status(500).send({ error: "calculation_failed", message });
    }
  });
}
