/**
 * Integration tests for POST /api/bodygraph/preview.
 *
 * Endpoint experimental sin auth — calcula bodygraph desde birth data.
 * Cubre validación de input y un happy path verificado contra ground truth.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

const { createTestApp } = await import("./helpers.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/bodygraph/preview", () => {
  it("computes a profile for Brian's birth data (regression vs fixture)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/bodygraph/preview",
      payload: {
        date: "1989-02-18",
        time: "12:00",
        timezoneOffsetHours: 0,
        name: "Brian Montero",
      },
    });
    expect(res.statusCode).toBe(200);
    const { profile } = JSON.parse(res.body);
    expect(profile.name).toBe("Brian Montero");
    expect(profile.humanDesign.type).toBe("Generador Manifestante");
    expect(profile.humanDesign.profile).toBe("6/2");
    expect(profile.humanDesign.authority).toBe("Emocional (Plexo Solar)");
    expect(profile.humanDesign.activatedGates).toHaveLength(26);
  });

  it("rejects an invalid date", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/bodygraph/preview",
      payload: { date: "not-a-date", time: "12:00", timezoneOffsetHours: 0 },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_date");
  });

  it("rejects an invalid time", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/bodygraph/preview",
      payload: { date: "1989-02-18", time: "noon", timezoneOffsetHours: 0 },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_time");
  });

  it("rejects a timezone offset out of range", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/bodygraph/preview",
      payload: { date: "1989-02-18", time: "12:00", timezoneOffsetHours: 99 },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_timezone");
  });
});
