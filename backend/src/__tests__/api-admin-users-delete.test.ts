/**
 * DELETE /api/admin/users/:id — admin-driven user deletion (bead astral-cwh).
 *
 * Validates:
 *  - admin-only auth (401 anon, 403 non-admin).
 *  - self-delete is blocked at the route boundary (400 cannot_delete_self).
 *  - 404 for unknown ids.
 *  - happy path: DB cascade drops dependents, R2 storage_keys deleted,
 *    response reports deletedAssets count.
 *  - R2 errors are best-effort: a failing object does not abort the user
 *    delete; the response carries r2Errors so operators can clean up.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import type { FastifyInstance } from "fastify";

import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

// Spy on r2.deleteObject to control success/failure per test without
// disturbing the in-memory R2 stub installed by helpers.createTestApp.
const r2DeleteObjectMock = vi.fn();
vi.mock("../storage/r2.js", async () => {
  const actual = await vi.importActual<typeof import("../storage/r2.js")>(
    "../storage/r2.js",
  );
  return {
    ...actual,
    deleteObject: r2DeleteObjectMock,
  };
});

const { createTestApp, createLinkedTestUser, sessionHeaders } = await import(
  "./helpers.js"
);

const ADMIN_SUBJECT = "st-admin-delete-1";
const REGULAR_SUBJECT = "st-regular-delete-1";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  await createLinkedTestUser(app, ADMIN_SUBJECT, "Admin", undefined, {
    role: "admin",
    email: "admin@coach.test",
  });
  await createLinkedTestUser(app, REGULAR_SUBJECT, "Regular", undefined, {
    email: "regular@coach.test",
  });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  r2DeleteObjectMock.mockReset();
  // Default to success — individual tests override as needed.
  r2DeleteObjectMock.mockResolvedValue(undefined);
});

async function deleteAdminUser(
  id: string,
  subject: string = ADMIN_SUBJECT,
) {
  return app.inject({
    method: "DELETE",
    url: `/api/admin/users/${id}`,
    headers: sessionHeaders(subject),
  });
}

async function getAdminUser(subject: string = ADMIN_SUBJECT) {
  const { findUserByIdentity } = await import("../db.js");
  const u = await findUserByIdentity("supertokens", subject);
  if (!u) throw new Error("admin not found");
  return u;
}

describe("DELETE /api/admin/users/:id — auth", () => {
  it("rejects anon callers with 401", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/admin/users/anything",
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-admin sessions with 403", async () => {
    const res = await deleteAdminUser("any", REGULAR_SUBJECT);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "admin_required" });
  });
});

describe("DELETE /api/admin/users/:id — guards", () => {
  it("blocks self-delete with 400 cannot_delete_self", async () => {
    const admin = await getAdminUser();
    const res = await deleteAdminUser(admin.id);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: "cannot_delete_self" });
  });

  it("returns 404 when the target user does not exist", async () => {
    const res = await deleteAdminUser("non-existent-id");
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/admin/users/:id — happy path", () => {
  it("deletes the user and reports the asset count", async () => {
    const { createUser, getUser, saveChatMessage, createAsset } = await import(
      "../db.js"
    );

    const targetId = await createUser(
      "Doomed",
      { humanDesign: {} },
      { email: "doomed@coach.test" },
    );

    // Seed dependents that the cascade should sweep.
    await saveChatMessage(targetId, "user", "hello");
    const assetId = await createAsset(
      targetId,
      "bg.png",
      "image/png",
      "image/png",
      Buffer.from("payload"),
    );
    expect(assetId).toBeTruthy();

    const res = await deleteAdminUser(targetId);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      ok: true,
      deletedAssets: 1,
      r2Errors: [],
    });

    expect(await getUser(targetId)).toBeUndefined();
  });

  it("continues the user delete even if some R2 objects fail to remove", async () => {
    const { createUser, getUser, createAsset } = await import("../db.js");

    const targetId = await createUser(
      "Half-broken",
      { humanDesign: {} },
      { email: "halfbroken@coach.test" },
    );
    await createAsset(
      targetId,
      "broken.png",
      "image/png",
      "image/png",
      Buffer.from("a"),
    );
    await createAsset(
      targetId,
      "ok.png",
      "image/png",
      "image/png",
      Buffer.from("b"),
    );

    // First R2 delete throws, second resolves — the route must absorb
    // the failure and still drop the DB row.
    r2DeleteObjectMock.mockRejectedValueOnce(new Error("R2 503 transient"));
    r2DeleteObjectMock.mockResolvedValueOnce(undefined);

    const res = await deleteAdminUser(targetId);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.deletedAssets).toBe(2);
    expect(body.r2Errors).toHaveLength(1);
    expect(body.r2Errors[0]).toMatchObject({
      reason: expect.stringContaining("R2 503 transient"),
    });

    expect(await getUser(targetId)).toBeUndefined();
  });
});
