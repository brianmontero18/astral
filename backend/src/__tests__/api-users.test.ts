/**
 * Users API — Integration tests
 *
 * Tests the full HTTP flow: request → route → DB → response.
 * Uses Fastify inject() with in-memory SQLite. No running server needed.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/users", () => {
  it("creates a user with name and profile", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Brian", profile: { type: "Generador" } },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(10); // UUID
  });

  it("rejects request without name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { profile: { type: "Generador" } },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/name/i);
  });

  it("rejects request without profile", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Solo nombre" },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/users/:id", () => {
  it("returns user data with parsed profile", async () => {
    // Create first
    const createRes = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Lectura", profile: { type: "Proyector", authority: "Splenic" } },
    });
    const { id } = JSON.parse(createRes.body);

    // Read
    const res = await app.inject({ method: "GET", url: `/api/users/${id}` });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Lectura");
    expect(body.profile).toEqual({ type: "Proyector", authority: "Splenic" });
    expect(body.created_at).toBeDefined();
    expect(body.updated_at).toBeDefined();
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/nonexistent-id" });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toMatch(/not found/i);
  });
});

describe("PUT /api/users/:id", () => {
  it("updates user name and profile", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Original", profile: { type: "Generador" } },
    });
    const { id } = JSON.parse(createRes.body);

    const updateRes = await app.inject({
      method: "PUT",
      url: `/api/users/${id}`,
      payload: { name: "Actualizado", profile: { type: "Generador Manifestante" } },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(JSON.parse(updateRes.body).ok).toBe(true);

    // Verify the update persisted
    const getRes = await app.inject({ method: "GET", url: `/api/users/${id}` });
    const body = JSON.parse(getRes.body);
    expect(body.name).toBe("Actualizado");
    expect(body.profile.type).toBe("Generador Manifestante");
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/users/fake-id",
      payload: { name: "X", profile: {} },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/users/:id", () => {
  it("deletes an existing user", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "ToDelete", profile: { type: "Reflector" } },
    });
    const { id } = JSON.parse(createRes.body);

    const deleteRes = await app.inject({ method: "DELETE", url: `/api/users/${id}` });
    expect(deleteRes.statusCode).toBe(200);
    expect(JSON.parse(deleteRes.body).ok).toBe(true);

    // Verify user is gone
    const getRes = await app.inject({ method: "GET", url: `/api/users/${id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/users/fake-id" });
    expect(res.statusCode).toBe(404);
  });
});

describe("special characters in user data", () => {
  it("handles names with accents and ñ", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "José María Ñoño", profile: { type: "Generador" } },
    });
    const { id } = JSON.parse(createRes.body);

    const getRes = await app.inject({ method: "GET", url: `/api/users/${id}` });
    expect(JSON.parse(getRes.body).name).toBe("José María Ñoño");
  });

  it("handles complex profile objects", async () => {
    const profile = {
      humanDesign: {
        type: "Generador Manifestante",
        channels: ["Canal de Inspiración", "Canal del Pulso"],
        activatedGates: [{ number: 1 }, { number: 8 }],
        definedCenters: ["G", "Throat"],
      },
    };

    const createRes = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Complex", profile },
    });
    const { id } = JSON.parse(createRes.body);

    const getRes = await app.inject({ method: "GET", url: `/api/users/${id}` });
    const body = JSON.parse(getRes.body);
    expect(body.profile.humanDesign.channels).toHaveLength(2);
    expect(body.profile.humanDesign.activatedGates[0].number).toBe(1);
  });
});
