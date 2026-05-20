import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

const originalRemoteMcpFlag = process.env.FEATURE_REMOTE_MCP;
const originalWorkosApiKey = process.env.WORKOS_API_KEY;

let app: FastifyInstance | null = null;

const PROFILE = {
  humanDesign: {
    type: "Generator",
    strategy: "Respond",
    authority: "Sacral",
    profile: "2/4",
    channels: [],
    activatedGates: [{ number: 1 }],
    definedCenters: ["Sacral"],
    undefinedCenters: ["Head"],
  },
};

async function buildWorkosConnectTestApp(flagEnabled = true) {
  process.env.FEATURE_REMOTE_MCP = flagEnabled ? "true" : "false";
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.WORKOS_API_KEY = "sk_test_not_real";
  vi.resetModules();

  const [{ buildApp }, db] = await Promise.all([
    import("../app.js"),
    import("../db.js"),
  ]);

  await db.initDb();
  app = await buildApp({ logger: false });
  await app.ready();

  return { app, db };
}

function restoreEnv() {
  if (originalRemoteMcpFlag === undefined) {
    delete process.env.FEATURE_REMOTE_MCP;
  } else {
    process.env.FEATURE_REMOTE_MCP = originalRemoteMcpFlag;
  }

  if (originalWorkosApiKey === undefined) {
    delete process.env.WORKOS_API_KEY;
  } else {
    process.env.WORKOS_API_KEY = originalWorkosApiKey;
  }
}

afterEach(async () => {
  await app?.close();
  app = null;
  vi.unstubAllGlobals();
  restoreEnv();
});

function mockWorkosComplete(redirectUri = "https://thoughtful-trinket-33-staging.authkit.app/oauth2/continue") {
  const fetchMock = vi.fn(async () => new Response(
    JSON.stringify({ redirect_uri: redirectUri }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  ));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GET /auth/workos/connect", () => {
  it("does not register the WorkOS Login URI while FEATURE_REMOTE_MCP is false", async () => {
    const harness = await buildWorkosConnectTestApp(false);

    const res = await harness.app.inject({
      method: "GET",
      url: "/auth/workos/connect?external_auth_id=ext_123",
    });

    expect(res.statusCode).toBe(404);
  });

  it("requires external_auth_id", async () => {
    const harness = await buildWorkosConnectTestApp();

    const res = await harness.app.inject({
      method: "GET",
      url: "/auth/workos/connect",
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: "external_auth_id_required" });
  });

  it("redirects anonymous users into Astral auth while preserving the WorkOS flow", async () => {
    const harness = await buildWorkosConnectTestApp();

    const res = await harness.app.inject({
      method: "GET",
      url: "/auth/workos/connect?external_auth_id=ext_123",
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(
      "/auth?redirectToPath=%2Fauth%2Fworkos%2Fconnect%3Fexternal_auth_id%3Dext_123",
    );
  });

  it("blocks pending onboarding before calling WorkOS", async () => {
    const harness = await buildWorkosConnectTestApp();
    const fetchMock = mockWorkosComplete();
    await harness.db.createUserWithIdentity(
      "Pending MCP User",
      PROFILE,
      "supertokens",
      "st-workos-pending",
      {
        email: "pending@astral.test",
        plan: "premium",
        onboardingStatus: "pending",
      },
    );

    const res = await harness.app.inject({
      method: "GET",
      url: "/auth/workos/connect?external_auth_id=ext_123",
      headers: { "x-test-session-subject": "st-workos-pending" },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "onboarding_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks free users before calling WorkOS", async () => {
    const harness = await buildWorkosConnectTestApp();
    const fetchMock = mockWorkosComplete();
    await harness.db.createUserWithIdentity(
      "Free MCP User",
      PROFILE,
      "supertokens",
      "st-workos-free",
      {
        email: "free@astral.test",
        plan: "free",
      },
    );

    const res = await harness.app.inject({
      method: "GET",
      url: "/auth/workos/connect?external_auth_id=ext_123",
      headers: { "x-test-session-subject": "st-workos-free" },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "plan_upgrade_required",
      requiredPlan: "basic",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("completes WorkOS OAuth for paid onboarded users and links the WorkOS identity", async () => {
    const harness = await buildWorkosConnectTestApp();
    const fetchMock = mockWorkosComplete("https://thoughtful-trinket-33-staging.authkit.app/oauth2/continue?state=abc");
    const userId = await harness.db.createUserWithIdentity(
      "Paid MCP User",
      PROFILE,
      "supertokens",
      "st-workos-paid",
      {
        email: "paid@astral.test",
        plan: "basic",
      },
    );

    const res = await harness.app.inject({
      method: "GET",
      url: "/auth/workos/connect?external_auth_id=ext_123",
      headers: { "x-test-session-subject": "st-workos-paid" },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(
      "https://thoughtful-trinket-33-staging.authkit.app/oauth2/continue?state=abc",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.workos.com/authkit/oauth2/complete",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer sk_test_not_real",
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          external_auth_id: "ext_123",
          user: {
            id: userId,
            email: "paid@astral.test",
            first_name: "Paid",
            last_name: "MCP User",
          },
        }),
      }),
    );

    const linked = await harness.db.findUserByIdentity("workos", userId);
    expect(linked?.id).toBe(userId);
  });

  it("blocks WorkOS identity conflicts before calling WorkOS", async () => {
    const harness = await buildWorkosConnectTestApp();
    const fetchMock = mockWorkosComplete();
    const userId = await harness.db.createUserWithIdentity(
      "Paid MCP User",
      PROFILE,
      "supertokens",
      "st-workos-paid",
      {
        email: "paid@astral.test",
        plan: "basic",
      },
    );
    const otherUserId = await harness.db.createUserWithIdentity(
      "Other MCP User",
      PROFILE,
      "supertokens",
      "st-workos-other",
      {
        email: "other@astral.test",
        plan: "basic",
      },
    );
    await harness.db.linkIdentity("workos", userId, otherUserId);

    const res = await harness.app.inject({
      method: "GET",
      url: "/auth/workos/connect?external_auth_id=ext_123",
      headers: { "x-test-session-subject": "st-workos-paid" },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toEqual({ error: "workos_identity_conflict" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
