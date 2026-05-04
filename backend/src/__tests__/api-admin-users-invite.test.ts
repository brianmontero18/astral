/**
 * POST /api/admin/users — admin invite endpoint (bead astral-wlx).
 *
 * Validates the contract with which Slice 5 (frontend admin modal) and Slice 4
 * (auto-link in /api/me) interoperate:
 *
 *  - new email → INSERT users in `pending` state with access_source='manual',
 *    plan locked, name optional, onboarding_step depends on whether name
 *    came in the body.
 *  - existing email (case-insensitive) → upgrade plan + access_source='manual',
 *    no duplicate row, do not touch onboarding_status / profile / identity.
 *  - 400 on malformed email or unknown plan; 403 for non-admin sessions.
 *  - 502 invite_send_failed when the Passwordless code cannot be issued or
 *    the email cannot be sent — the users row remains intact so admin can
 *    retry from the UI.
 *
 * SuperTokens.Passwordless create/send calls are mocked module-wide because
 * tests cannot reach a real SuperTokens core or email service; the magicLink
 * in the response is built deterministically from the mocked output.
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

const passwordlessCreateCodeMock = vi.fn();
const passwordlessSendEmailMock = vi.fn();

vi.mock("supertokens-node/recipe/passwordless", async () => {
  const actual = await vi.importActual<
    typeof import("supertokens-node/recipe/passwordless")
  >("supertokens-node/recipe/passwordless");
  return {
    ...actual,
    default: {
      ...actual.default,
      createCode: passwordlessCreateCodeMock,
      sendEmail: passwordlessSendEmailMock,
    },
  };
});

const { createTestApp, createLinkedTestUser, sessionHeaders } = await import(
  "./helpers.js"
);

const ADMIN_SUBJECT = "st-admin-1";
const REGULAR_SUBJECT = "st-regular-1";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
  await createLinkedTestUser(app, ADMIN_SUBJECT, "Admin", undefined, {
    role: "admin",
  });
  await createLinkedTestUser(app, REGULAR_SUBJECT, "Regular User");
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  passwordlessCreateCodeMock.mockReset();
  passwordlessSendEmailMock.mockReset();
  passwordlessCreateCodeMock.mockResolvedValue({
    status: "OK",
    preAuthSessionId: "preauth-mock",
    codeId: "code-mock",
    deviceId: "device-mock",
    userInputCode: "123456",
    linkCode: "linkcode-mock",
    codeLifetime: 48 * 60 * 60 * 1000,
    timeCreated: Date.now(),
  });
  passwordlessSendEmailMock.mockResolvedValue(undefined);
});

async function postInvite(payload: {
  email?: unknown;
  plan?: unknown;
  name?: unknown;
}, headers: Record<string, string> = sessionHeaders(ADMIN_SUBJECT)) {
  return app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers,
    payload,
  });
}

describe("POST /api/admin/users — happy paths", () => {
  it("creates a new pending user with access_source='manual' and returns the magic link", async () => {
    const res = await postInvite({
      email: "marina@coach.test",
      plan: "premium",
      name: "Marina",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      plan: "premium",
      isNewUser: true,
      magicLink: expect.stringContaining("preauth-mock"),
      expiresAt: expect.any(String),
    });
    expect(body.magicLink).toContain("linkcode-mock");
    expect(typeof body.userId).toBe("string");

    const { getUser } = await import("../db.js");
    const created = await getUser(body.userId);
    expect(created?.email).toBe("marina@coach.test");
    expect(created?.plan).toBe("premium");
    expect(created?.access_source).toBe("manual");
    expect(created?.onboarding_status).toBe("pending");
    expect(created?.onboarding_step).toBe("upload"); // name was provided
    expect(created?.name).toBe("Marina");

    expect(passwordlessCreateCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "marina@coach.test" }),
    );
    expect(passwordlessSendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PASSWORDLESS_LOGIN",
        email: "marina@coach.test",
        preAuthSessionId: "preauth-mock",
        urlWithLinkCode: body.magicLink,
        userInputCode: "123456",
        tenantId: "public",
      }),
    );
  });

  it("creates a pending user starting at step='name' when no name is provided", async () => {
    const res = await postInvite({
      email: "noname@coach.test",
      plan: "premium",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    const { getUser } = await import("../db.js");
    const created = await getUser(body.userId);
    expect(created?.onboarding_step).toBe("name");
    expect(created?.name).toBe("");
  });

  it("upgrades an existing free user to premium and marks access_source='manual' without duplicating the row", async () => {
    // Seed a free self-signup user with the target email.
    const { createUser, findUserByEmail } = await import("../db.js");
    const seededId = await createUser(
      "Already Here",
      { humanDesign: {} },
      { email: "existing@coach.test", plan: "free" },
    );

    const res = await postInvite({
      email: "Existing@Coach.Test", // different casing on purpose
      plan: "premium",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.userId).toBe(seededId);
    expect(body.isNewUser).toBe(false);
    expect(body.plan).toBe("premium");

    const after = await findUserByEmail("existing@coach.test");
    expect(after?.plan).toBe("premium");
    expect(after?.access_source).toBe("manual");
    // Upgrade must not flip a self-signup user into pending.
    expect(after?.onboarding_status).toBe("complete");
    // body.userId already asserted equal to seededId above — proves no
    // duplicate row was created.
  });
});

describe("POST /api/admin/users — validation", () => {
  it("rejects malformed emails with 400 invalid_email", async () => {
    const res = await postInvite({ email: "not-an-email", plan: "premium" });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: "invalid_email" });
  });

  it("rejects empty email with 400 invalid_email", async () => {
    const res = await postInvite({ email: "   ", plan: "premium" });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: "invalid_email" });
  });

  it("rejects unknown plans with 400 invalid_plan", async () => {
    const res = await postInvite({
      email: "ok@coach.test",
      plan: "ultra-premium",
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: "invalid_plan" });
  });

  it("rejects missing plan with 400 invalid_plan", async () => {
    const res = await postInvite({ email: "ok@coach.test" });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: "invalid_plan" });
  });
});

describe("POST /api/admin/users — auth gating", () => {
  it("returns 403 admin_required for a non-admin session", async () => {
    const res = await postInvite(
      { email: "blocked@coach.test", plan: "premium" },
      sessionHeaders(REGULAR_SUBJECT),
    );
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "admin_required" });
  });

  it("returns 401 authentication_required when there is no session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      payload: { email: "noauth@coach.test", plan: "premium" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/admin/users — invite send failure", () => {
  it("returns 502 invite_send_failed but keeps the users row when createCode throws", async () => {
    passwordlessCreateCodeMock.mockRejectedValueOnce(
      new Error("SMTP 421 service unavailable"),
    );

    const res = await postInvite({
      email: "fragile@coach.test",
      plan: "premium",
      name: "Fragile",
    });

    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      error: "invite_send_failed",
      plan: "premium",
      isNewUser: true,
    });
    expect(typeof body.userId).toBe("string");
    expect(body.magicLink).toBeUndefined();

    const { getUser } = await import("../db.js");
    const stranded = await getUser(body.userId);
    expect(stranded?.email).toBe("fragile@coach.test");
    expect(stranded?.access_source).toBe("manual");
    expect(stranded?.onboarding_status).toBe("pending");
  });

  it("returns 502 invite_send_failed but keeps the users row when email delivery throws", async () => {
    passwordlessSendEmailMock.mockRejectedValueOnce(
      new Error("SMTP 421 service unavailable"),
    );

    const res = await postInvite({
      email: "maildown@coach.test",
      plan: "premium",
      name: "Mail Down",
    });

    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      error: "invite_send_failed",
      plan: "premium",
      isNewUser: true,
    });
    expect(body.magicLink).toBeUndefined();

    const { getUser } = await import("../db.js");
    const stranded = await getUser(body.userId);
    expect(stranded?.email).toBe("maildown@coach.test");
    expect(stranded?.access_source).toBe("manual");
    expect(stranded?.onboarding_status).toBe("pending");
  });

  it("a successful retry against the same email upgrades and reissues the link instead of duplicating", async () => {
    // First attempt fails to send.
    passwordlessCreateCodeMock.mockRejectedValueOnce(new Error("smtp down"));
    const failing = await postInvite({
      email: "retry@coach.test",
      plan: "premium",
      name: "Retry",
    });
    expect(failing.statusCode).toBe(502);
    const failingBody = JSON.parse(failing.body);

    // Admin retries from the UI — same endpoint, same email. createCode now
    // succeeds (default mock from beforeEach).
    const retry = await postInvite({
      email: "retry@coach.test",
      plan: "premium",
    });
    expect(retry.statusCode).toBe(200);
    const retryBody = JSON.parse(retry.body);
    expect(retryBody.userId).toBe(failingBody.userId);
    expect(retryBody.isNewUser).toBe(false);
    expect(retryBody.magicLink).toContain("preauth-mock");
  });
});
