/**
 * Chat API — Integration tests
 *
 * Tests validation, message persistence, and error handling.
 * The actual LLM call is NOT tested (non-deterministic).
 * Focus: routing logic, auth, and message history.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, createTestUser, seedUserMessages } from "./helpers.js";

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

  it("returns used and limit in response", async () => {
    const userId = await createTestUser(app);
    const res = await app.inject({
      method: "GET",
      url: `/api/users/${userId}/messages`,
    });

    const body = JSON.parse(res.body);
    expect(body.used).toBe(0);
    expect(body.limit).toBe(15);
  });

  it("returns correct used count after seeding messages", async () => {
    const userId = await createTestUser(app);
    await seedUserMessages(app, userId, 5);
    const res = await app.inject({
      method: "GET",
      url: `/api/users/${userId}/messages`,
    });

    const body = JSON.parse(res.body);
    expect(body.used).toBe(5);
    expect(body.limit).toBe(15);
    expect(body.messages).toHaveLength(10); // 5 user + 5 assistant
  });
});

describe("Freemium message limit", () => {
  it("returns 403 on POST /api/chat when limit reached", async () => {
    const userId = await createTestUser(app);
    await seedUserMessages(app, userId, 15);

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId,
        messages: [{ role: "user", content: "one more please" }],
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("message_limit_reached");
    expect(body.used).toBe(15);
    expect(body.limit).toBe(15);
  });

  it("returns 403 on POST /api/chat/stream when limit reached", async () => {
    const userId = await createTestUser(app);
    await seedUserMessages(app, userId, 15);

    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: {
        userId,
        messages: [{ role: "user", content: "one more please" }],
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("message_limit_reached");
  });

  it("allows chat when under the limit", async () => {
    const userId = await createTestUser(app);
    await seedUserMessages(app, userId, 14);

    // Should NOT return 403 — the request may fail for other reasons
    // (no OpenAI key in tests) but the limit check should pass
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId,
        messages: [{ role: "user", content: "still free" }],
      },
    });

    expect(res.statusCode).not.toBe(403);
  });

  it("does not enforce limit when userId is not provided (legacy mode)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        profile: {
          humanDesign: {
            type: "Generator",
            strategy: "Respond",
            authority: "Sacral",
            profile: "1/3",
            definition: "Single",
            incarnationCross: "Test",
            channels: [],
            activatedGates: [],
            definedCenters: [],
            undefinedCenters: [],
          },
        },
        messages: [{ role: "user", content: "hello" }],
      },
    });

    // Should not be 403 — no userId means no limit check
    expect(res.statusCode).not.toBe(403);
  });
});
