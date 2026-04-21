import type { FastifyInstance } from "fastify";
import { fetchWeeklyTransits, type WeeklyTransits, analyzeTransitImpact, type TransitImpact } from "../transit-service.js";
import { getCachedTransits, setCachedTransits, getISOWeekKey, getUser } from "../db.js";
import { type AuthenticatedRequest } from "../auth/session.js";
import { resolveRequestCurrentUser } from "../auth/current-user.js";

export async function transitRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { userId?: string; timeZone?: string; clientNow?: string } }>("/transits", async (req, reply) => {
    try {
      const transits = await getTransitsCached(req.query.timeZone, req.query.clientNow);

      let impact: TransitImpact | undefined;
      const currentUser = await resolveRequestCurrentUser(
        req as AuthenticatedRequest,
        reply,
      );

      if (reply.sent) {
        return;
      }

      if (currentUser.kind === "linked") {
        const user = await getUser(currentUser.user.id);
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

export async function getTransitsCached(timeZone?: string, clientNow?: string): Promise<WeeklyTransits> {
  const now = parseClientNow(clientNow);
  const weekKey = getWeekKey(timeZone, now);
  const cacheKey = timeZone ? `${timeZone}|${weekKey}` : weekKey;
  const cached = await getCachedTransits(cacheKey);
  if (cached) return cached as WeeklyTransits;

  const fresh = await fetchWeeklyTransits(now, timeZone);
  await setCachedTransits(cacheKey, fresh);
  return fresh;
}

function parseClientNow(clientNow?: string): Date {
  if (!clientNow) return new Date();
  const n = Number(clientNow);
  if (!Number.isFinite(n)) return new Date();
  return new Date(n);
}

function getWeekKey(timeZone: string | undefined, now: Date): string {
  if (!timeZone) return getISOWeekKey(now);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const year = Number(lookup.year);
    const month = Number(lookup.month);
    const day = Number(lookup.day);
    if (!year || !month || !day) return getISOWeekKey(now);
    const localDateUtc = new Date(Date.UTC(year, month - 1, day));
    return getISOWeekKey(localDateUtc);
  } catch {
    return getISOWeekKey(now);
  }
}
