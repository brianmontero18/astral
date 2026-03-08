import type { FastifyInstance } from "fastify";
import { fetchWeeklyTransits, type WeeklyTransits, analyzeTransitImpact, type TransitImpact } from "../transit-service.js";
import { getCachedTransits, setCachedTransits, getISOWeekKey, getUser } from "../db.js";

export async function transitRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { userId?: string } }>("/transits", async (req, reply) => {
    try {
      const transits = await getTransitsCached();

      // Si viene userId, calcular impacto personalizado
      let impact: TransitImpact | undefined;
      if (req.query.userId) {
        const user = await getUser(req.query.userId);
        if (user) {
          const profile = user.profile as { humanDesign?: { activatedGates?: Array<{ number: number }>; definedCenters?: string[] } };
          impact = analyzeTransitImpact(transits, {
            activatedGates: profile.humanDesign?.activatedGates ?? [],
            definedCenters: profile.humanDesign?.definedCenters ?? [],
          });
        }
      }

      return reply.send({ ...transits, ...(impact && { impact }) });
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
