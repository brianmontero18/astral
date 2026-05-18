/**
 * Places autocomplete API — Integration tests
 *
 * Mockea fetch para no pegar a GeoNames real en CI. Valida el contrato:
 * auth, parámetros, cache, mapeo de errores upstream.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

const {
  createLinkedTestUser,
  createTestApp,
  sessionHeaders,
} = await import("./helpers.js");
const { __clearPlacesCacheForTesting } = await import("../places/geonames.js");

let app: FastifyInstance;

beforeAll(async () => {
  process.env.GEONAMES_USERNAME = "test-user";
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  __clearPlacesCacheForTesting();
  vi.restoreAllMocks();
});

function stubFetch(body: object, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

const ESQUEL_PAYLOAD = {
  totalResultsCount: 1,
  geonames: [
    {
      geonameId: 3855974,
      name: "Esquel",
      adminName1: "Chubut",
      countryName: "Argentina",
      countryCode: "AR",
      lat: "-42.9135",
      lng: "-71.31947",
      population: 28486,
    },
  ],
};

describe("GET /api/places/autocomplete", () => {
  it("returns authentication_required without a validated session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=esquel",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns empty results when q is shorter than 2 chars", async () => {
    const sessionSubject = "st-places-short-q";
    await createLinkedTestUser(app, sessionSubject);
    const fetchMock = stubFetch(ESQUEL_PAYLOAD);

    const res = await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=e",
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ results: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns mapped GeoNames results for a happy-path query", async () => {
    const sessionSubject = "st-places-happy";
    await createLinkedTestUser(app, sessionSubject);
    stubFetch(ESQUEL_PAYLOAD);

    const res = await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=esquel",
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.results).toHaveLength(1);
    expect(data.results[0]).toEqual({
      geonameId: 3855974,
      name: "Esquel",
      admin1: "Chubut",
      country: "Argentina",
      countryCode: "AR",
      lat: -42.9135,
      lon: -71.31947,
      population: 28486,
    });
  });

  it("caches identical queries (one fetch for two calls)", async () => {
    const sessionSubject = "st-places-cache";
    await createLinkedTestUser(app, sessionSubject);
    const fetchMock = stubFetch(ESQUEL_PAYLOAD);

    await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=esquel",
      headers: sessionHeaders(sessionSubject),
    });
    await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=esquel",
      headers: sessionHeaders(sessionSubject),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates GeoNames status error (e.g. hourly limit)", async () => {
    const sessionSubject = "st-places-rate-limit";
    await createLinkedTestUser(app, sessionSubject);
    stubFetch({
      status: { message: "hourly limit of credits exceeded", value: 19 },
      geonames: [],
      totalResultsCount: 0,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=esquel",
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toBe("places_unavailable");
  });

  it("returns 500 when GEONAMES_USERNAME is missing", async () => {
    const sessionSubject = "st-places-no-username";
    await createLinkedTestUser(app, sessionSubject);
    const prev = process.env.GEONAMES_USERNAME;
    delete process.env.GEONAMES_USERNAME;

    const res = await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=esquel",
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toBe("places_unavailable");

    process.env.GEONAMES_USERNAME = prev;
  });

  it("clamps limit to [1, 20]", async () => {
    const sessionSubject = "st-places-clamp-limit";
    await createLinkedTestUser(app, sessionSubject);
    const fetchMock = stubFetch(ESQUEL_PAYLOAD);

    await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=esquel&limit=999",
      headers: sessionHeaders(sessionSubject),
    });

    const calledUrl = (fetchMock.mock.calls[0]?.[0] as string) ?? "";
    expect(calledUrl).toContain("maxRows=20");
  });
});
