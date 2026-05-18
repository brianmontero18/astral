/**
 * GeoNames places autocomplete client.
 *
 * Por qué GeoNames y no Mapbox/Google: es el estándar de facto en apps de
 * Human Design y astrología (Kerykeion, Astrologer-API, Zodiac Engine).
 * Cobertura LATAM excelente con featureClass=P + cities5000 (incluye Esquel,
 * Punta Cardón). Free tier de 20k credits/día por username = $0 a escala de
 * Astral. ToS permite cachear lat/lon sin restricción (CC-BY, solo atribución
 * en footer). El timezone IANA histórica se resuelve offline con geo-tz +
 * luxon (geonames timezoneJSON da el actual, no el histórico).
 *
 * Cache: LRU in-memory con TTL. Reduce hits a GeoNames y costo en el rate
 * limit por hora (1k/h). Para producción serverless multi-instance habría que
 * mover a Redis, pero para single-instance (Fly.io / fastify simple) alcanza.
 */

const GEONAMES_BASE = "https://secure.geonames.org/searchJSON";

export interface PlaceResult {
  /** GeoNames ID, único, sirve como key estable. */
  geonameId: number;
  /** Nombre canónico del lugar (ej "Esquel"). */
  name: string;
  /** División administrativa primaria (ej "Chubut"). */
  admin1: string;
  /** País display (ej "Argentina"). */
  country: string;
  /** ISO alpha-2 (ej "AR"). */
  countryCode: string;
  lat: number;
  lon: number;
  /** Población para diagnóstico/ordenamiento downstream. */
  population: number;
}

interface GeoNamesRawResult {
  geonameId: number;
  name: string;
  adminName1?: string;
  countryName: string;
  countryCode: string;
  lat: string;
  lng: string;
  population?: number;
}

interface GeoNamesResponse {
  totalResultsCount: number;
  geonames: GeoNamesRawResult[];
  /** GeoNames devuelve un objeto `status` cuando hay error (e.g. invalid username, rate limit). */
  status?: { message: string; value: number };
}

const CACHE_MAX_ENTRIES = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  results: PlaceResult[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(query: string, limit: number, lang: string): string {
  return `${lang}::${limit}::${query.trim().toLowerCase()}`;
}

function pruneIfNeeded(): void {
  if (cache.size <= CACHE_MAX_ENTRIES) return;
  // Map preserva insertion order. Borrar el primero (más viejo) hasta volver al límite.
  const overflow = cache.size - CACHE_MAX_ENTRIES;
  const keys = cache.keys();
  for (let i = 0; i < overflow; i++) {
    const next = keys.next();
    if (next.done) break;
    cache.delete(next.value);
  }
}

export function __clearPlacesCacheForTesting(): void {
  cache.clear();
}

export class PlacesProviderError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "PlacesProviderError";
  }
}

/**
 * Autocomplete de lugares. Devuelve hasta `limit` resultados rankeados por
 * relevancia (GeoNames internal scoring). Cache 24h.
 */
export async function autocompletePlaces(
  query: string,
  options: { limit?: number; lang?: string; username?: string; fetchImpl?: typeof fetch } = {},
): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const limit = options.limit ?? 8;
  const lang = options.lang ?? "es";
  const username = options.username ?? process.env.GEONAMES_USERNAME;
  if (!username) {
    throw new PlacesProviderError("GEONAMES_USERNAME no configurado", 500);
  }

  const key = cacheKey(trimmed, limit, lang);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    // Refrescar orden LRU: re-insertar al final.
    cache.delete(key);
    cache.set(key, cached);
    return cached.results;
  }

  const url = new URL(GEONAMES_BASE);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("maxRows", String(limit));
  url.searchParams.set("featureClass", "P");
  url.searchParams.set("cities", "cities5000");
  url.searchParams.set("orderby", "relevance");
  url.searchParams.set("lang", lang);
  url.searchParams.set("username", username);

  const doFetch = options.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(url.toString(), { method: "GET" });
  } catch (err) {
    throw new PlacesProviderError(
      `GeoNames fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }

  if (!res.ok) {
    throw new PlacesProviderError(`GeoNames HTTP ${res.status}`, 502);
  }

  let body: GeoNamesResponse;
  try {
    body = (await res.json()) as GeoNamesResponse;
  } catch (err) {
    throw new PlacesProviderError(
      `GeoNames invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }

  if (body.status) {
    // codes: 10=invalid username, 18=daily limit, 19=hourly limit, 20=weekly limit.
    throw new PlacesProviderError(
      `GeoNames error (${body.status.value}): ${body.status.message}`,
      body.status.value === 10 ? 500 : 503,
    );
  }

  const results: PlaceResult[] = (body.geonames ?? []).map((r) => ({
    geonameId: r.geonameId,
    name: r.name,
    admin1: r.adminName1 ?? "",
    country: r.countryName,
    countryCode: r.countryCode,
    lat: Number(r.lat),
    lon: Number(r.lng),
    population: r.population ?? 0,
  }));

  cache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
  pruneIfNeeded();

  return results;
}
