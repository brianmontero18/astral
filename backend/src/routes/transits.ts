import type { FastifyInstance } from "fastify";
import { fetchWeeklyTransits, type WeeklyTransits } from "../transit-service.js";
import { getCachedTransits, setCachedTransits, getISOWeekKey } from "../db.js";

export async function transitRoutes(app: FastifyInstance) {
  app.get("/transits", async (_req, reply) => {
    try {
      const transits = await getTransitsCached();
      return reply.send(transits);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error(message);
      return reply.status(502).send({ error: message });
    }
  });
}

export async function getTransitsCached(): Promise<WeeklyTransits> {
  const weekKey = getISOWeekKey();
  const cached = await getCachedTransits(weekKey);
  if (cached) return cached as WeeklyTransits;

  const fresh = await fetchWeeklyTransits();
  await setCachedTransits(weekKey, fresh);
  return fresh;
}
