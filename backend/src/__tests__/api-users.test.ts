/**
 * Users API — Integration tests
 *
 * Tests the full HTTP flow: request → route → DB → response.
 * Uses Fastify inject() with in-memory SQLite. No running server needed.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

// Mock SuperTokens.getUser so signup tests can control the email returned
// by the auth provider without contacting a real SuperTokens core.
const supertokensGetUserMock = vi.fn();
vi.mock("supertokens-node", async () => {
  const actual =
    await vi.importActual<typeof import("supertokens-node")>("supertokens-node");
  return {
    ...actual,
    default: {
      ...actual.default,
      getUser: supertokensGetUserMock,
    },
  };
});

const {
  createLinkedTestUser,
  createTestApp,
  createTestUser,
  seedUserMessages,
  sessionHeaders,
} = await import("./helpers.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  supertokensGetUserMock.mockReset();
});

describe("POST /api/users", () => {
  it("creates and links the authenticated current user during bootstrap", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: sessionHeaders("st-bootstrap-user"),
      payload: { name: "Brian", profile: { type: "Generador" } },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(10); // UUID

    const { getUserIdentity } = await import("../db.js");
    await expect(getUserIdentity(body.id)).resolves.toEqual({
      provider: "supertokens",
      subject: "st-bootstrap-user",
    });
  });

  it("rejects creating a second user when the session identity is already linked", async () => {
    const initialCreateRes = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: sessionHeaders("st-duplicate-user"),
      payload: {
        name: "First Identity Owner",
        profile: {
          type: "Manifestor",
        },
      },
    });

    expect(initialCreateRes.statusCode).toBe(201);

    const duplicateRes = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: sessionHeaders("st-duplicate-user"),
      payload: {
        name: "Second Identity Owner",
        profile: {
          type: "Reflector",
        },
      },
    });

    expect(duplicateRes.statusCode).toBe(409);
    expect(JSON.parse(duplicateRes.body)).toMatchObject({
      error: "identity_already_linked",
      userId: JSON.parse(initialCreateRes.body).id,
    });
  });

  it("defaults newly linked signups to the free plan", async () => {
    await createLinkedTestUser(app, "st-admin-plan-default", "Admin Default", {
      type: "Manifestor",
    }, {
      role: "admin",
    });

    const createRes = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: sessionHeaders("st-plan-default-user"),
      payload: { name: "Plan Default", profile: { humanDesign: { type: "Generator" } } },
    });

    expect(createRes.statusCode).toBe(201);
    const { id } = JSON.parse(createRes.body) as { id: string };

    const getRes = await app.inject({
      method: "GET",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-admin-plan-default"),
    });

    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.body)).toMatchObject({
      id,
      plan: "free",
      linked: true,
    });
  });

  it("persists the email returned by SuperTokens at signup", async () => {
    supertokensGetUserMock.mockResolvedValueOnce({
      emails: ["new-signup@astral.test"],
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: sessionHeaders("st-signup-with-email"),
      payload: { name: "Brian", profile: { type: "Generador" } },
    });

    expect(res.statusCode).toBe(201);
    const { id } = JSON.parse(res.body);

    const { getUser } = await import("../db.js");
    const user = await getUser(id);
    expect(user?.email).toBe("new-signup@astral.test");
  });

  it("falls back to null email when SuperTokens lookup throws", async () => {
    supertokensGetUserMock.mockRejectedValueOnce(
      new Error("supertokens core unavailable"),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: sessionHeaders("st-signup-email-fallback"),
      payload: { name: "Brian", profile: { type: "Generador" } },
    });

    expect(res.statusCode).toBe(201);
    const { id } = JSON.parse(res.body);

    const { getUser } = await import("../db.js");
    const user = await getUser(id);
    expect(user?.email).toBeNull();
  });

  it("rejects anonymous bootstrap after rollout cleanup", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Anon", profile: { type: "Generador" } },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
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
  it("requires an admin role", async () => {
    const id = await createTestUser(app, "Lectura", {
      type: "Proyector",
      authority: "Splenic",
    });
    await createLinkedTestUser(app, "st-regular-user", "Regular User", {
      type: "Generator",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-regular-user"),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "admin_required",
    });
  });

  it("returns admin detail with auth identity, support snapshot, and HD summary", async () => {
    await createLinkedTestUser(app, "st-admin-reader", "Admin Reader", {
      type: "Manifestor",
    }, {
      role: "admin",
    });
    const id = await createLinkedTestUser(app, "st-detail-target", "Lectura", {
      humanDesign: {
        type: "Projector",
        authority: "Splenic",
        profile: "5/1",
      },
    }, {
      email: "lectura@astral.test",
    });

    await seedUserMessages(app, id, 2);

    const { createAsset, saveReport } = await import("../db.js");
    await createAsset(id, "chart-1.png", "image/png", "chart", Buffer.from("asset-1"));
    await createAsset(id, "chart-2.png", "image/png", "chart", Buffer.from("asset-2"));
    await saveReport({
      id: randomUUID(),
      userId: id,
      tier: "free",
      profileHash: "hash-free",
      content: JSON.stringify({ id: "report-free", userId: id, tier: "free", createdAt: new Date().toISOString() }),
      tokensUsed: 10,
      costUsd: 0.01,
    });
    await saveReport({
      id: randomUUID(),
      userId: id,
      tier: "premium",
      profileHash: "hash-premium",
      content: JSON.stringify({ id: "report-premium", userId: id, tier: "premium", createdAt: new Date().toISOString() }),
      tokensUsed: 20,
      costUsd: 0.02,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-admin-reader"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      id,
      name: "Lectura",
      email: "lectura@astral.test",
      plan: "free",
      status: "active",
      role: "user",
      linked: true,
      authIdentity: {
        provider: "supertokens",
        subject: "st-detail-target",
      },
      support: {
        messagesUsed: 2,
        messageLimit: 20,
        assetCount: 2,
        reportsAvailable: ["free", "premium"],
      },
      humanDesign: {
        type: "Projector",
        authority: "Splenic",
        profile: "5/1",
      },
    });
    expect(body.createdAt).toEqual(expect.any(String));
    expect(body.updatedAt).toEqual(expect.any(String));
    expect(Object.hasOwn(body, "profile")).toBe(false);
    expect(Object.hasOwn(body, "intake")).toBe(false);
  });

  it("returns a nullable top-level email when contact data is missing", async () => {
    await createLinkedTestUser(app, "st-admin-reader-no-email", "Admin Reader No Email", {
      type: "Manifestor",
    }, {
      role: "admin",
    });
    const id = await createLinkedTestUser(app, "st-detail-target-no-email", "Sin Email", {
      humanDesign: {
        type: "Generator",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-admin-reader-no-email"),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      id,
      name: "Sin Email",
      email: null,
      linked: true,
      authIdentity: {
        provider: "supertokens",
        subject: "st-detail-target-no-email",
      },
    });
  });

  it("returns 404 for nonexistent user", async () => {
    await createLinkedTestUser(app, "st-admin-missing-reader", "Admin Missing Reader", {
      type: "Manifestor",
    }, {
      role: "admin",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/users/nonexistent-id",
      headers: sessionHeaders("st-admin-missing-reader"),
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toMatch(/not found/i);
  });
});

describe("PUT /api/users/:id", () => {
  it("requires an admin role", async () => {
    const id = await createTestUser(app, "Original", { type: "Generador" });
    await createLinkedTestUser(app, "st-regular-writer", "Regular Writer", {
      type: "Generator",
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-regular-writer"),
      payload: { name: "Actualizado", profile: { type: "Generador Manifestante" } },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "admin_required",
    });
  });

  it("updates user name and profile for admins", async () => {
    await createLinkedTestUser(app, "st-admin-writer", "Admin Writer", {
      type: "Manifestor",
    }, {
      role: "admin",
    });
    const id = await createTestUser(app, "Original", { type: "Generador" });

    const updateRes = await app.inject({
      method: "PUT",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-admin-writer"),
      payload: { name: "Actualizado", profile: { type: "Generador Manifestante" } },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(JSON.parse(updateRes.body).ok).toBe(true);

    const { getUser } = await import("../db.js");
    const updatedUser = await getUser(id);
    expect(updatedUser?.name).toBe("Actualizado");
    expect(updatedUser?.profile).toMatchObject({
      type: "Generador Manifestante",
    });
  });

  it("returns 404 for nonexistent user", async () => {
    await createLinkedTestUser(app, "st-admin-missing-writer", "Admin Missing Writer", {
      type: "Manifestor",
    }, {
      role: "admin",
    });

    const res = await app.inject({
      method: "PUT",
      url: "/api/users/fake-id",
      headers: sessionHeaders("st-admin-missing-writer"),
      payload: { name: "X", profile: {} },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/users/:id", () => {
  it("requires an admin role", async () => {
    const id = await createTestUser(app, "ToDelete", { type: "Reflector" });
    await createLinkedTestUser(app, "st-regular-deleter", "Regular Deleter", {
      type: "Generator",
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-regular-deleter"),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "admin_required",
    });
  });

  it("deletes an existing user for admins", async () => {
    await createLinkedTestUser(app, "st-admin-deleter", "Admin Deleter", {
      type: "Manifestor",
    }, {
      role: "admin",
    });
    const id = await createTestUser(app, "ToDelete", { type: "Reflector" });

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-admin-deleter"),
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(JSON.parse(deleteRes.body).ok).toBe(true);

    // Verify user is gone
    const getRes = await app.inject({
      method: "GET",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-admin-deleter"),
    });
    expect(getRes.statusCode).toBe(404);
  });

  it("returns 404 for nonexistent user", async () => {
    await createLinkedTestUser(app, "st-admin-missing-deleter", "Admin Missing Deleter", {
      type: "Manifestor",
    }, {
      role: "admin",
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/fake-id",
      headers: sessionHeaders("st-admin-missing-deleter"),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("special characters in user data", () => {
  it("handles names with accents and ñ", async () => {
    await createLinkedTestUser(app, "st-admin-special", "Admin Special", {
      type: "Manifestor",
    }, {
      role: "admin",
    });
    const id = await createTestUser(app, "José María Ñoño", { type: "Generador" });

    const getRes = await app.inject({
      method: "GET",
      url: `/api/users/${id}`,
      headers: sessionHeaders("st-admin-special"),
    });
    expect(JSON.parse(getRes.body).name).toBe("José María Ñoño");
  });

  it("handles complex profile objects", async () => {
    await createLinkedTestUser(app, "st-admin-complex", "Admin Complex", {
      type: "Manifestor",
    }, {
      role: "admin",
    });
    const profile = {
      humanDesign: {
        type: "Generador Manifestante",
        channels: ["Canal de Inspiración", "Canal del Pulso"],
        activatedGates: [{ number: 1 }, { number: 8 }],
        definedCenters: ["G", "Throat"],
      },
    };

    const id = await createTestUser(app, "Complex", profile);
    const { getUser } = await import("../db.js");
    const user = await getUser(id);
    const savedProfile = user?.profile as typeof profile | undefined;
    expect(savedProfile?.humanDesign.channels).toHaveLength(2);
    expect(savedProfile?.humanDesign.activatedGates[0]?.number).toBe(1);
  });
});

describe("GET /api/admin/users", () => {
  it("requires an admin role", async () => {
    await createLinkedTestUser(app, "st-admin-list-regular", "Regular User", {
      type: "Generator",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: sessionHeaders("st-admin-list-regular"),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "admin_required",
    });
  });

  it("returns paginated user summaries with top-level email and linked semantics for admins", async () => {
    await createLinkedTestUser(app, "st-admin-list-admin", "Admin User", {
      type: "Generator",
    }, {
      role: "admin",
      email: "admin@astral.test",
    });
    await createTestUser(app, "List Semantics Disabled", { type: "Projector" }, {
      status: "disabled",
    });
    await createLinkedTestUser(app, "st-list-semantics-linked", "List Semantics Linked", {
      type: "Generator",
    }, {
      email: "list-semantics@astral.test",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users?q=list semantics&page=1&pageSize=12",
      headers: sessionHeaders("st-admin-list-admin"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      pageSize: number;
      rangeStart: number;
      rangeEnd: number;
      users: Array<Record<string, unknown>>;
    };
    const linkedSummary = body.users.find((user) => user.name === "List Semantics Linked");
    const disabledSummary = body.users.find((user) => user.name === "List Semantics Disabled");

    expect(body.currentPage).toBe(1);
    expect(body.totalPages).toBe(1);
    expect(body.totalItems).toBe(2);
    expect(body.pageSize).toBe(12);
    expect(body.rangeStart).toBe(1);
    expect(body.rangeEnd).toBe(2);

    expect(linkedSummary).toMatchObject({
      name: "List Semantics Linked",
      email: "list-semantics@astral.test",
      plan: "free",
      role: "user",
      status: "active",
      linked: true,
    });
    expect(linkedSummary?.createdAt).toEqual(expect.any(String));
    expect(linkedSummary).not.toHaveProperty("created_at");

    expect(disabledSummary).toMatchObject({
      name: "List Semantics Disabled",
      email: null,
      plan: "free",
      role: "user",
      status: "disabled",
      linked: false,
    });
    expect(disabledSummary?.createdAt).toEqual(expect.any(String));
  });

  it("searches by name or email and keeps id as a silent fallback on the server", async () => {
    await createLinkedTestUser(app, "st-admin-list-search-admin", "Admin Search", {
      type: "Generator",
    }, {
      role: "admin",
      email: "admin-search@astral.test",
    });
    const emailUserId = await createLinkedTestUser(app, "st-admin-list-search-email", "Email Search Target", {
      type: "Projector",
    }, {
      email: "silent-fallback@astral.test",
    });
    await createTestUser(app, "Name Search Target", {
      type: "Manifestor",
    });

    const nameRes = await app.inject({
      method: "GET",
      url: "/api/admin/users?q=name search target&page=1&pageSize=12",
      headers: sessionHeaders("st-admin-list-search-admin"),
    });

    expect(nameRes.statusCode).toBe(200);
    expect(JSON.parse(nameRes.body)).toMatchObject({
      totalItems: 1,
      users: [
        expect.objectContaining({
          name: "Name Search Target",
        }),
      ],
    });

    const emailRes = await app.inject({
      method: "GET",
      url: "/api/admin/users?q=silent-fallback@astral.test&page=1&pageSize=12",
      headers: sessionHeaders("st-admin-list-search-admin"),
    });

    expect(emailRes.statusCode).toBe(200);
    expect(JSON.parse(emailRes.body)).toMatchObject({
      totalItems: 1,
      users: [
        expect.objectContaining({
          id: emailUserId,
          email: "silent-fallback@astral.test",
        }),
      ],
    });

    const fallbackRes = await app.inject({
      method: "GET",
      url: `/api/admin/users?q=${emailUserId.slice(0, 8)}&page=1&pageSize=12`,
      headers: sessionHeaders("st-admin-list-search-admin"),
    });

    expect(fallbackRes.statusCode).toBe(200);
    expect(JSON.parse(fallbackRes.body)).toMatchObject({
      totalItems: 1,
      users: [
        expect.objectContaining({
          id: emailUserId,
        }),
      ],
    });
  });

  it("paginates on the server and clamps overflow pages", async () => {
    await createLinkedTestUser(app, "st-admin-list-pagination-admin", "Admin Pagination", {
      type: "Generator",
    }, {
      role: "admin",
    });

    for (let index = 1; index <= 14; index += 1) {
      await createTestUser(
        app,
        `Paged Search User ${String(index).padStart(2, "0")}`,
        { type: "Generator" },
        {
          email: `paged-search-${String(index).padStart(2, "0")}@astral.test`,
        },
      );
    }

    const firstPageRes = await app.inject({
      method: "GET",
      url: "/api/admin/users?q=paged search user&page=1&pageSize=12",
      headers: sessionHeaders("st-admin-list-pagination-admin"),
    });

    expect(firstPageRes.statusCode).toBe(200);
    const firstPageBody = JSON.parse(firstPageRes.body) as {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      pageSize: number;
      rangeStart: number;
      rangeEnd: number;
      users: unknown[];
    };
    expect(firstPageBody).toMatchObject({
      currentPage: 1,
      totalPages: 2,
      totalItems: 14,
      pageSize: 12,
      rangeStart: 1,
      rangeEnd: 12,
    });
    expect(firstPageBody.users).toHaveLength(12);

    const overflowRes = await app.inject({
      method: "GET",
      url: "/api/admin/users?q=paged search user&page=99&pageSize=12",
      headers: sessionHeaders("st-admin-list-pagination-admin"),
    });

    expect(overflowRes.statusCode).toBe(200);
    const overflowBody = JSON.parse(overflowRes.body) as {
      currentPage: number;
      rangeStart: number;
      rangeEnd: number;
      users: Array<{ name: string }>;
    };
    expect(overflowBody.currentPage).toBe(2);
    expect(overflowBody.rangeStart).toBe(13);
    expect(overflowBody.rangeEnd).toBe(14);
    expect(overflowBody.users).toHaveLength(2);
  });
});

describe("PATCH /api/admin/users/:id/access", () => {
  it("requires an admin role", async () => {
    const userId = await createLinkedTestUser(app, "st-admin-access-non-admin-target", "Target User", {
      type: "Reflector",
    });
    await createLinkedTestUser(app, "st-admin-access-non-admin", "Regular User", {
      type: "Generator",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${userId}/access`,
      headers: sessionHeaders("st-admin-access-non-admin"),
      payload: {
        plan: "basic",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "admin_required",
    });
  });

  it("updates plan, role, and status for admins", async () => {
    await createLinkedTestUser(app, "st-admin-access-admin", "Admin Access", {
      type: "Manifestor",
    }, {
      role: "admin",
    });
    const userId = await createLinkedTestUser(app, "st-admin-access-target", "Target User", {
      type: "Reflector",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${userId}/access`,
      headers: sessionHeaders("st-admin-access-admin"),
      payload: {
        plan: "premium",
        role: "admin",
        status: "banned",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      ok: true,
    });

    const getRes = await app.inject({
      method: "GET",
      url: `/api/users/${userId}`,
      headers: sessionHeaders("st-admin-access-admin"),
    });

    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.body)).toMatchObject({
      id: userId,
      plan: "premium",
      role: "admin",
      status: "banned",
    });
  });

  it("persists partial access updates without overwriting untouched fields", async () => {
    await createLinkedTestUser(app, "st-admin-access-partial-admin", "Admin Access Partial", {
      type: "Manifestor",
    }, {
      role: "admin",
    });
    const userId = await createLinkedTestUser(
      app,
      "st-admin-access-partial-target",
      "Target Partial",
      {
        type: "Reflector",
      },
      {
        plan: "basic",
        role: "admin",
        status: "disabled",
      },
    );

    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${userId}/access`,
      headers: sessionHeaders("st-admin-access-partial-admin"),
      payload: {
        plan: "premium",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      ok: true,
    });

    const getRes = await app.inject({
      method: "GET",
      url: `/api/users/${userId}`,
      headers: sessionHeaders("st-admin-access-partial-admin"),
    });

    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.body)).toMatchObject({
      id: userId,
      plan: "premium",
      role: "admin",
      status: "disabled",
    });
  });

  it("rejects self access mutations", async () => {
    const adminId = await createLinkedTestUser(app, "st-admin-self-access", "Admin Self", {
      type: "Manifestor",
    }, {
      role: "admin",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${adminId}/access`,
      headers: sessionHeaders("st-admin-self-access"),
      payload: {
        plan: "basic",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({
      error: "cannot_modify_self_access",
    });
  });

  it.each([
    [{ plan: "vip" }, "Invalid plan", "plan"],
    [{ role: "superadmin" }, "Invalid role", "role"],
    [{ status: "paused" }, "Invalid status", "status"],
  ])("rejects invalid enum payload %j", async (payload, expectedError, suffix) => {
    await createLinkedTestUser(app, `st-admin-access-invalid-${suffix}`, "Admin Invalid", {
      type: "Manifestor",
    }, {
      role: "admin",
    });
    const userId = await createLinkedTestUser(app, `st-admin-access-invalid-target-${suffix}`, "Target Invalid", {
      type: "Reflector",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${userId}/access`,
      headers: sessionHeaders(`st-admin-access-invalid-${suffix}`),
      payload,
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({
      error: expectedError,
    });
  });
});
