/**
 * Integration tests for POST /api/bodygraph/pdf.
 *
 * Endpoint experimental sin auth — calcula bodygraph desde birth data y
 * devuelve PDF descargable (chart + paneles + header como PNG embebido).
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

describe("POST /api/bodygraph/pdf", () => {
  it("returns a valid PDF for Brian's birth data", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/bodygraph/pdf",
      payload: {
        date: "1989-02-18",
        time: "12:00",
        timezoneOffsetHours: 0,
        name: "Brian Montero",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain('attachment; filename="bodygraph-brian-montero.pdf"');

    const body = res.rawPayload;
    expect(body).toBeInstanceOf(Buffer);
    expect(body.length).toBeGreaterThan(10000);
    // PDF files start with the magic bytes "%PDF-".
    expect(body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  }, 30_000);

  it("defaults filename to 'bodygraph.pdf' when no name is provided", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/bodygraph/pdf",
      payload: {
        date: "1988-12-28",
        time: "06:13",
        timezoneOffsetHours: 0,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toContain('filename="bodygraph.pdf"');
  }, 30_000);

  it("rejects an invalid date", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/bodygraph/pdf",
      payload: { date: "not-a-date", time: "12:00", timezoneOffsetHours: 0 },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_date");
  });

  it("rejects a timezone offset out of range", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/bodygraph/pdf",
      payload: { date: "1989-02-18", time: "12:00", timezoneOffsetHours: 99 },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_timezone");
  });
});
