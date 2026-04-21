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
