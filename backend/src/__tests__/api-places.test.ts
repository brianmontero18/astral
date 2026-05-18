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
  it("is public — works without a session (needed during onboarding pre-bootstrap)", async () => {
    stubFetch(ESQUEL_PAYLOAD);
    const res = await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=esquel",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results).toHaveLength(1);
  });

  it("returns empty results when q is shorter than 2 chars", async () => {
    const fetchMock = stubFetch(ESQUEL_PAYLOAD);
    const res = await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=e",
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ results: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns mapped GeoNames results for a happy-path query", async () => {
    stubFetch(ESQUEL_PAYLOAD);

    const res = await app.inject({
      method: "GET",
      url: "/api/places/autocomplete?q=esquel",
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
    const fetchMock = stubFetch(ESQUEL_PAYLOAD);

    await app.inject({ method: "GET", url: "/api/places/autocomplete?q=esquel" });
    await app.inject({ method: "GET", url: "/api/places/autocomplete?q=esquel" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates GeoNames status error (e.g. hourly limit)", async () => {
    stubFetch({
      status: { message: "hourly limit of credits exceeded", value: 19 },
      geonames: [],
      totalResultsCount: 0,
    });

    const res = await app.inject({ method: "GET", url: "/api/places/autocomplete?q=esquel" });

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toBe("places_unavailable");
  });

  it("returns 500 when GEONAMES_USERNAME is missing", async () => {
    const prev = process.env.GEONAMES_USERNAME;
    delete process.env.GEONAMES_USERNAME;

    const res = await app.inject({ method: "GET", url: "/api/places/autocomplete?q=esquel" });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toBe("places_unavailable");

    process.env.GEONAMES_USERNAME = prev;
  });

  it("clamps limit to [1, 20]", async () => {
    const fetchMock = stubFetch(ESQUEL_PAYLOAD);

    await app.inject({ method: "GET", url: "/api/places/autocomplete?q=esquel&limit=999" });

    const calledUrl = (fetchMock.mock.calls[0]?.[0] as string) ?? "";
    expect(calledUrl).toContain("maxRows=20");
  });
});
