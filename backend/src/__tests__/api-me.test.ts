import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

const { createLinkedTestUser, createTestApp } = await import("./helpers.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/me", () => {
  it("returns authentication_required when there is no validated session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/me",
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("returns identity_not_linked when the session has no mapped Astral user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: {
        "x-test-session-subject": "st-unlinked-user",
      },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toEqual({
      error: "identity_not_linked",
      provider: "supertokens",
      subject: "st-unlinked-user",
    });
  });

  it("returns the linked Astral user when the session subject is mapped", async () => {
    const userId = await createLinkedTestUser(app, "st-linked-user", "Linked User", {
      type: "Generator",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: {
        "x-test-session-subject": "st-linked-user",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      id: userId,
      name: "Linked User",
      profile: {
        type: "Generator",
      },
      role: "user",
      status: "active",
    });
  });

  it("returns account_inactive when the linked user is disabled", async () => {
    await createLinkedTestUser(
      app,
      "st-disabled-user",
      "Disabled User",
      {
        type: "Projector",
      },
      {
        status: "disabled",
      },
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: {
        "x-test-session-subject": "st-disabled-user",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "account_inactive",
      status: "disabled",
      provider: "supertokens",
      subject: "st-disabled-user",
    });
  });
});

describe("PUT /api/me", () => {
  it("returns authentication_required when there is no validated session", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/me",
      payload: {
        name: "Anonymous",
        profile: {
          type: "Generator",
        },
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("does not mutate the linked user when a protected update loses session context", async () => {
    await createLinkedTestUser(
      app,
      "st-update-current-user-expired",
      "Stable Name",
      {
        type: "Projector",
      },
    );

    const updateRes = await app.inject({
      method: "PUT",
      url: "/api/me",
      payload: {
        name: "Mutated Without Session",
        profile: {
          type: "Manifesting Generator",
        },
      },
    });

    expect(updateRes.statusCode).toBe(401);
    expect(JSON.parse(updateRes.body)).toEqual({
      error: "authentication_required",
    });

    const meRes = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: {
        "x-test-session-subject": "st-update-current-user-expired",
      },
    });

    expect(meRes.statusCode).toBe(200);
    expect(JSON.parse(meRes.body)).toMatchObject({
      name: "Stable Name",
      profile: {
        type: "Projector",
      },
    });
  });

  it("updates the linked Astral user without requiring a client userId", async () => {
    const userId = await createLinkedTestUser(
      app,
      "st-update-current-user",
      "Original Name",
      {
        type: "Projector",
      },
    );

    const updateRes = await app.inject({
      method: "PUT",
      url: "/api/me",
      headers: {
        "x-test-session-subject": "st-update-current-user",
      },
      payload: {
        name: "Updated Name",
        profile: {
          type: "Manifesting Generator",
        },
        intake: {
          actividad: "Deep work",
        },
      },
    });

    expect(updateRes.statusCode).toBe(200);
    expect(JSON.parse(updateRes.body)).toEqual({
      ok: true,
    });

    const meRes = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: {
        "x-test-session-subject": "st-update-current-user",
      },
    });

    expect(meRes.statusCode).toBe(200);
    expect(JSON.parse(meRes.body)).toMatchObject({
      id: userId,
      name: "Updated Name",
      profile: {
        type: "Manifesting Generator",
      },
      intake: {
        actividad: "Deep work",
      },
    });
  });
});

describe("PATCH /api/me/bodygraph/name", () => {
  it("returns authentication_required when there is no validated session", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/me/bodygraph/name",
      payload: {
        name: "Carta Nueva",
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("renames the active chart without changing bodygraph-dependent state", async () => {
    const userId = await createLinkedTestUser(
      app,
      "st-rename-active-chart",
      "Nombre Viejo",
      {
        name: "Nombre Viejo",
        humanDesign: {
          type: "Projector",
          channels: [{ id: "10-20", name: "Canal del Despertar" }],
          activatedGates: [{ number: 10 }],
        },
      },
    );

    const db = await import("../db.js");
    await db.updateUserMemory(userId, "Memory should stay");
    await db.saveChatMessage(userId, "user", "Chat should stay");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/me/bodygraph/name",
      headers: {
        "x-test-session-subject": "st-rename-active-chart",
      },
      payload: {
        name: "  María   José  ",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      user: {
        id: userId,
        name: "María José",
      },
      profile: {
        name: "María José",
        humanDesign: {
          type: "Projector",
          channels: [{ id: "10-20", name: "Canal del Despertar" }],
        },
      },
    });

    const user = await db.getUser(userId);
    expect(user?.name).toBe("María José");
    expect(user?.profile).toMatchObject({
      name: "María José",
      humanDesign: {
        type: "Projector",
        channels: [{ id: "10-20", name: "Canal del Despertar" }],
      },
    });
    expect(user?.memory_md).toBe("Memory should stay");
    expect(await db.getChatMessages(userId)).toHaveLength(1);
  });

  it("rejects invalid active chart names without mutating the user", async () => {
    const userId = await createLinkedTestUser(
      app,
      "st-rename-active-chart-blank",
      "Nombre Estable",
      {
        name: "Nombre Estable",
        humanDesign: { type: "Generator" },
      },
    );

    for (const name of ["   ", "a".repeat(61), "\u0000Agus", "!!!"]) {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/me/bodygraph/name",
        headers: {
          "x-test-session-subject": "st-rename-active-chart-blank",
        },
        payload: { name },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body)).toMatchObject({
        error: "invalid_name",
      });
    }

    const { getUser } = await import("../db.js");
    const user = await getUser(userId);
    expect(user?.name).toBe("Nombre Estable");
    expect(user?.profile).toMatchObject({ name: "Nombre Estable" });
  });
});
