/**
 * Places autocomplete endpoint.
 *
 * Backend proxy a GeoNames con auth requerida y cache 24h. El frontend nunca
 * pega directo a GeoNames porque (1) el username es secreto y (2) queremos
 * controlar cache, rate-limit y telemetría server-side.
 */
import type { FastifyInstance } from "fastify";
import { type AuthenticatedRequest } from "../auth/session.js";
import {
  resolveRequestCurrentUser,
  sendCurrentUserError,
} from "../auth/current-user.js";
import {
  autocompletePlaces,
  PlacesProviderError,
} from "../places/geonames.js";

interface AutocompleteQuery {
  q?: string;
  limit?: string;
  lang?: string;
}

export async function placesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: AutocompleteQuery }>(
    "/places/autocomplete",
    async (req, reply) => {
      const currentUser = await resolveRequestCurrentUser(
        req as AuthenticatedRequest,
        reply,
      );
      if (reply.sent) return;
      if (currentUser.kind !== "linked") {
        return sendCurrentUserError(reply, currentUser);
      }

      const q = (req.query.q ?? "").trim();
      if (q.length < 2) {
        return reply.status(200).send({ results: [] });
      }

      const limitRaw = Number(req.query.limit ?? "8");
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(Math.trunc(limitRaw), 1), 20)
        : 8;
      const lang = req.query.lang ?? "es";

      try {
        const results = await autocompletePlaces(q, { limit, lang });
        return reply.status(200).send({ results });
      } catch (err) {
        if (err instanceof PlacesProviderError) {
          app.log.warn({ err: err.message }, "places autocomplete provider error");
          return reply.status(err.status).send({
            error: "places_unavailable",
            message: err.message,
          });
        }
        app.log.error({ err }, "places autocomplete failed");
        return reply.status(500).send({
          error: "places_unavailable",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );
}
