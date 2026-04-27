/**
 * Admin LLM Usage — Integration tests
 *
 * Covers GET /api/admin/users/:id/llm-usage authorization, error paths,
 * and aggregation correctness on the response payload.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

const {
  createLinkedTestUser,
  createTestApp,
  sessionHeaders,
} = await import("./helpers.js");
const { insertLlmCall } = await import("../db.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

async function seedLlmCall(
  userId: string,
  overrides: Partial<{
    route: "chat" | "chat_stream" | "report" | "extraction";
    model: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    latencyMs: number;
  }> = {},
) {
  await insertLlmCall({
    userId,
    route: overrides.route ?? "chat",
    model: overrides.model ?? "gpt-4o-mini",
    tokensIn: overrides.tokensIn ?? 100,
    tokensOut: overrides.tokensOut ?? 50,
    costUsd: overrides.costUsd ?? 0.000045,
    latencyMs: overrides.latencyMs ?? 800,
    promptHash: "hash0123abcdef00",
  });
}

describe("GET /api/admin/users/:id/llm-usage — auth", () => {
  it("returns 401 when the request is unauthenticated", async () => {
    const userId = await createLinkedTestUser(app, "llmusage-anon-owner");

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${userId}/llm-usage`,
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when the requester is not an admin", async () => {
    const ownerId = await createLinkedTestUser(app, "llmusage-non-admin-owner");
    await createLinkedTestUser(app, "llmusage-non-admin-other");

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${ownerId}/llm-usage`,
      headers: sessionHeaders("llmusage-non-admin-other"),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "admin_required" });
  });

  it("returns 404 when the target user does not exist", async () => {
    await createLinkedTestUser(app, "llmusage-admin", "Admin", undefined, { role: "admin" });

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/non-existent-uuid/llm-usage`,
      headers: sessionHeaders("llmusage-admin"),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/admin/users/:id/llm-usage — payload", () => {
  it("returns zeroed totals and empty breakdowns when the user has no calls", async () => {
    const targetId = await createLinkedTestUser(app, "llmusage-empty-target");
    await createLinkedTestUser(app, "llmusage-empty-admin", "Admin", undefined, { role: "admin" });

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${targetId}/llm-usage`,
      headers: sessionHeaders("llmusage-empty-admin"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual(
      expect.objectContaining({
        days: 7,
        totalCallCount: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCostUsd: 0,
        byRoute: [],
        byModel: [],
      }),
    );
  });

  it("aggregates calls across routes and models", async () => {
    const targetId = await createLinkedTestUser(app, "llmusage-agg-target");
    await createLinkedTestUser(app, "llmusage-agg-admin", "Admin", undefined, { role: "admin" });

    await seedLlmCall(targetId, { route: "chat", tokensIn: 100, tokensOut: 50, costUsd: 0.000045 });
    await seedLlmCall(targetId, { route: "chat_stream", tokensIn: 200, tokensOut: 100, costUsd: 0.00009 });
    await seedLlmCall(targetId, { route: "chat", tokensIn: 50, tokensOut: 25, costUsd: 0.0000225 });

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${targetId}/llm-usage?days=7`,
      headers: sessionHeaders("llmusage-agg-admin"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.totalCallCount).toBe(3);
    expect(body.totalTokensIn).toBe(350);
    expect(body.totalTokensOut).toBe(175);
    expect(body.totalCostUsd).toBeCloseTo(0.0001575, 8);
    expect(body.byRoute).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ route: "chat", callCount: 2 }),
        expect.objectContaining({ route: "chat_stream", callCount: 1 }),
      ]),
    );
    expect(body.byModel).toEqual([
      expect.objectContaining({ model: "gpt-4o-mini", callCount: 3 }),
    ]);
  });

  it("clamps invalid days values to the default of 7", async () => {
    const targetId = await createLinkedTestUser(app, "llmusage-days-target");
    await createLinkedTestUser(app, "llmusage-days-admin", "Admin", undefined, { role: "admin" });

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${targetId}/llm-usage?days=abc`,
      headers: sessionHeaders("llmusage-days-admin"),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).days).toBe(7);
  });
});
