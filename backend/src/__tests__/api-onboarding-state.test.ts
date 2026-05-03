/**
 * Onboarding state plumbing — auto-link, guards, PATCH endpoint (bead astral-4ub).
 *
 *   - resolveRequestCurrentUser auto-links a SuperTokens session to a
 *     pending admin-invited users row by email match (only when
 *     access_source='manual' and there is no identity yet).
 *   - /api/me surfaces onboardingStatus, onboardingStep, accessSource.
 *   - POST /api/chat, /api/chat/stream and /api/me/report return
 *     `403 onboarding_required` when the linked user is pending.
 *   - GET /api/transits silently degrades to the collective view (no
 *     impact field) when the linked user is pending.
 *   - PATCH /api/me/onboarding persists checkpoints (name / profile /
 *     intake / step) and finalises with `complete: true`.
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

const { createTestApp, sessionHeaders } = await import("./helpers.js");

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

describe("auto-link by email — pending admin-invited users", () => {
  it("links a SuperTokens subject to the pending users row when the email matches and access_source='manual'", async () => {
    const { createUser, getUserIdentity } = await import("../db.js");
    const seededId = await createUser(
      "",
      { humanDesign: {} },
      {
        email: "invited@coach.test",
        plan: "premium",
        accessSource: "manual",
        onboardingStatus: "pending",
        onboardingStep: "name",
      },
    );

    supertokensGetUserMock.mockResolvedValue({
      emails: ["invited@coach.test"],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: sessionHeaders("st-invited-1"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(seededId);
    expect(body.onboardingStatus).toBe("pending");
    expect(body.onboardingStep).toBe("name");
    expect(body.accessSource).toBe("manual");

    const identity = await getUserIdentity(seededId);
    expect(identity).toEqual({
      provider: "supertokens",
      subject: "st-invited-1",
    });
  });

  it("does NOT auto-link when the candidate users row has access_source='self' (legacy bootstrap)", async () => {
    const { createUser, getUserIdentity } = await import("../db.js");
    const legacyId = await createUser(
      "Legacy",
      { humanDesign: {} },
      { email: "legacy@coach.test", plan: "free" },
    );

    supertokensGetUserMock.mockResolvedValue({
      emails: ["legacy@coach.test"],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: sessionHeaders("st-legacy-1"),
    });

    // Stays unlinked → frontend goes through the legacy POST /users path.
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toBe("identity_not_linked");

    const identity = await getUserIdentity(legacyId);
    expect(identity).toBeNull();
  });

  it("does NOT auto-link when the email match has no provider email (SuperTokens lookup empty)", async () => {
    const { createUser } = await import("../db.js");
    await createUser(
      "Orphan",
      { humanDesign: {} },
      {
        email: "orphan@coach.test",
        plan: "premium",
        accessSource: "manual",
        onboardingStatus: "pending",
        onboardingStep: "upload",
      },
    );

    supertokensGetUserMock.mockResolvedValue({ emails: [] });

    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: sessionHeaders("st-orphan-1"),
    });

    expect(res.statusCode).toBe(409);
  });
});

describe("/api/me response shape", () => {
  it("exposes onboardingStatus / onboardingStep / accessSource for a complete linked user", async () => {
    const { createUserWithIdentity } = await import("../db.js");
    await createUserWithIdentity(
      "Complete User",
      { humanDesign: {} },
      "supertokens",
      "st-complete-1",
      { email: "complete@coach.test", plan: "free" },
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: sessionHeaders("st-complete-1"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.onboardingStatus).toBe("complete");
    expect(body.onboardingStep).toBeNull();
    expect(body.accessSource).toBe("self");
  });
});

describe("guards — onboarding_required for pending users", () => {
  async function seedPendingLinkedUser(subject: string, email: string) {
    const { createUserWithIdentity } = await import("../db.js");
    return createUserWithIdentity(
      "Pending",
      { humanDesign: {} },
      "supertokens",
      subject,
      {
        email,
        plan: "premium",
        accessSource: "manual",
        onboardingStatus: "pending",
        onboardingStep: "upload",
      },
    );
  }

  it("POST /api/chat returns 403 onboarding_required when pending", async () => {
    await seedPendingLinkedUser("st-chat-pending-1", "chat-pending@coach.test");

    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("st-chat-pending-1"),
      payload: { messages: [{ role: "user", content: "hola" }] },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "onboarding_required" });
  });

  it("POST /api/chat/stream returns 403 onboarding_required when pending", async () => {
    await seedPendingLinkedUser(
      "st-chat-stream-pending-1",
      "chat-stream-pending@coach.test",
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      headers: sessionHeaders("st-chat-stream-pending-1"),
      payload: { messages: [{ role: "user", content: "hola" }] },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "onboarding_required" });
  });

  it("POST /api/me/report returns 403 onboarding_required when pending", async () => {
    await seedPendingLinkedUser(
      "st-report-pending-1",
      "report-pending@coach.test",
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-pending-1"),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "onboarding_required" });
  });

  it("GET /api/transits returns no `impact` field when pending (degraded view, not 403)", async () => {
    await seedPendingLinkedUser(
      "st-transits-pending-1",
      "transits-pending@coach.test",
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/transits",
      headers: sessionHeaders("st-transits-pending-1"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.impact).toBeUndefined();
    expect(body.planets).toBeDefined();
  });
});

describe("PATCH /api/me/onboarding", () => {
  async function seedPendingUser(subject: string) {
    const { createUserWithIdentity } = await import("../db.js");
    return createUserWithIdentity(
      "",
      { humanDesign: {} },
      "supertokens",
      subject,
      {
        email: `${subject}@coach.test`,
        plan: "premium",
        accessSource: "manual",
        onboardingStatus: "pending",
        onboardingStep: "name",
      },
    );
  }

  it("returns 401 when there is no session", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/me/onboarding",
      payload: { step: "upload" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an unknown step with 400 invalid_step", async () => {
    await seedPendingUser("st-patch-bad-step");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/me/onboarding",
      headers: sessionHeaders("st-patch-bad-step"),
      payload: { step: "extracting" },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: "invalid_step" });
  });

  it("persists name + step transition and reflects them on the next /api/me", async () => {
    const userId = await seedPendingUser("st-patch-name-step");

    const patchRes = await app.inject({
      method: "PATCH",
      url: "/api/me/onboarding",
      headers: sessionHeaders("st-patch-name-step"),
      payload: { name: "Marina", step: "upload" },
    });
    expect(patchRes.statusCode).toBe(200);

    const me = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: sessionHeaders("st-patch-name-step"),
    });
    const body = JSON.parse(me.body);
    expect(body.id).toBe(userId);
    expect(body.name).toBe("Marina");
    expect(body.onboardingStep).toBe("upload");
    expect(body.onboardingStatus).toBe("pending");
  });

  it("`complete: true` finalises onboarding (status='complete', step=NULL) atomically", async () => {
    await seedPendingUser("st-patch-complete");

    const patchRes = await app.inject({
      method: "PATCH",
      url: "/api/me/onboarding",
      headers: sessionHeaders("st-patch-complete"),
      payload: {
        complete: true,
        intake: { actividad: "coach" },
      },
    });
    expect(patchRes.statusCode).toBe(200);

    const me = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: sessionHeaders("st-patch-complete"),
    });
    const body = JSON.parse(me.body);
    expect(body.onboardingStatus).toBe("complete");
    expect(body.onboardingStep).toBeNull();
    expect(body.intake).toEqual({ actividad: "coach" });
  });

  it("after completing onboarding, chat is no longer 403-gated", async () => {
    await seedPendingUser("st-patch-then-chat");

    await app.inject({
      method: "PATCH",
      url: "/api/me/onboarding",
      headers: sessionHeaders("st-patch-then-chat"),
      payload: { complete: true },
    });

    // Chat won't reach LLM (no OPENAI mock here), but the 403 onboarding
    // guard must NOT fire. Any other failure is fine for this assertion.
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      headers: sessionHeaders("st-patch-then-chat"),
      payload: { messages: [{ role: "user", content: "hola" }] },
    });
    expect(res.statusCode).not.toBe(403);
  });
});
