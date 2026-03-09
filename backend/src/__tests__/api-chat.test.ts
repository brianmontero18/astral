/**
 * Chat API — Integration tests
 *
 * Tests validation, message persistence, and error handling.
 * The actual LLM call is NOT tested (non-deterministic).
 * Focus: routing logic, auth, and message history.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, createTestUser } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/chat — validation", () => {
  it("rejects request without messages", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/messages/i);
  });

  it("rejects request with empty messages array", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId, messages: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId: "nonexistent-fake-id",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toMatch(/not found/i);
  });

  it("rejects request without userId or profile", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { messages: [{ role: "user", content: "hello" }] },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/userId|profile/i);
  });
});

describe("POST /api/chat/stream — validation", () => {
  it("rejects request without messages", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: { userId },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: {
        userId: "nonexistent-fake-id",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/users/:userId/messages — chat history", () => {
  it("returns empty history for new user", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "GET",
      url: `/api/users/${userId}/messages`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.messages).toEqual([]);
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/users/fake-id/messages",
    });

    expect(res.statusCode).toBe(404);
  });
});
