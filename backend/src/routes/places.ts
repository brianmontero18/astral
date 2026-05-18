/**
 * Places autocomplete endpoint.
 *
 * Backend proxy a GeoNames con cache 24h. **Endpoint público**: no expone
 * PII (solo nombres de ciudades públicos), y el step birthData del onboarding
 * lo necesita ANTES de que el users row esté bootstrap-ado/linkeado a la
 * sesión SuperTokens — atar este endpoint a `kind: "linked"` rompería el
 * flow porque el bootstrap ocurre recién al submit del cálculo. El rate-limit
 * lo aporta GeoNames (20k credits/día por username) + nuestro LRU cache.
 *
 * El frontend nunca pega directo a GeoNames porque (1) el username es secreto
 * y (2) queremos cachear server-side y controlar telemetría.
 */
import type { FastifyInstance } from "fastify";
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
