import type { FastifyInstance } from "fastify";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { buildApp } from "../app.js";
import type { AuthRuntime } from "../auth/supertokens.js";

class FakeAuthError extends Error {}

const originalNodeEnv = process.env.NODE_ENV;
const originalFrontendOrigin = process.env.FRONTEND_ORIGIN;

function restoreCorsEnv(): void {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalFrontendOrigin === undefined) {
    delete process.env.FRONTEND_ORIGIN;
  } else {
    process.env.FRONTEND_ORIGIN = originalFrontendOrigin;
  }
}

function createFakeAuthRuntime(): AuthRuntime {
  return {
    enabled: true,
    corsHeaders: ["anti-csrf", "rid", "st-auth-mode"],
    register: async (app) => {
      app.get("/auth/ping", async () => ({ ok: true }));

      app.get("/auth/fail", async () => {
        throw new FakeAuthError("auth failure");
      });

      app.get("/auth/fail-open", async () => {
        throw new Error("generic failure");
      });
    },
    handleError: async (error, _request, reply) => {
      if (error instanceof FakeAuthError) {
        await reply.status(401).send({ error: "auth_runtime_error" });
        return true;
      }

      return false;
    },
  };
}

async function buildReadyAuthApp(): Promise<FastifyInstance> {
  const app = await buildApp({
    logger: false,
    auth: createFakeAuthRuntime(),
  });
  await app.ready();
  return app;
}

function injectHealthPreflight(
  app: FastifyInstance,
  origin: string,
  requestHeaders?: string,
): ReturnType<FastifyInstance["inject"]> {
  const headers: Record<string, string> = {
    origin,
    "access-control-request-method": "GET",
  };

  if (requestHeaders) {
    headers["access-control-request-headers"] = requestHeaders;
  }

  return app.inject({
    method: "OPTIONS",
    url: "/api/health",
    headers,
  });
}

describe("auth surface wiring", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      auth: createFakeAuthRuntime(),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("mounts the auth surface outside the business /api namespace", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/ping",
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it("registers a wildcard /auth surface so framework hooks can handle recipe endpoints", async () => {
    expect(app.printRoutes()).toMatch(
      /uth\/[\s\S]*\* \(GET, HEAD, TRACE, DELETE, OPTIONS, PATCH, PUT, POST\)/,
    );
  });

  it("lets HTML navigations to the auth entry route fall through to the SPA fallback", async () => {
    const spaApp = await buildApp({
      logger: false,
      auth: createFakeAuthRuntime(),
    });

    spaApp.setNotFoundHandler(async (_request, reply) => {
      await reply.status(200).send({ shell: true });
    });

    await spaApp.ready();

    // Each path the React SPA owns: /auth, /auth?..., /auth/, /auth/?... and
    // /auth/verify?... (the magic-link landing — used by admin invites in
    // production). All must resolve to the SPA shell, not a SuperTokens 404.
    const spaPaths = [
      "/auth",
      "/auth?intent=invite",
      "/auth/",
      "/auth/?redirectToPath=",
      "/auth/verify?preAuthSessionId=abc&intent=invite#linkcode",
    ];

    for (const url of spaPaths) {
      const res = await spaApp.inject({
        method: "GET",
        url,
        headers: { accept: "text/html" },
      });

      expect(res.statusCode, `expected SPA fallback for ${url}`).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ shell: true });
    }

    await spaApp.close();
  });

  it("still 404s non-HTML requests to unknown /auth/* paths so SuperTokens API errors stay JSON", async () => {
    // The SPA fallback is gated on Accept: text/html. API clients (no html
    // accept) should keep getting the JSON 404 — otherwise we'd shadow the
    // structured error responses SuperTokens relies on for its SDK.
    const res = await app.inject({
      method: "GET",
      url: "/auth/verify?preAuthSessionId=abc",
      headers: { accept: "application/json" },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: "Not Found" });
  });

  it("includes auth-compatible CORS headers when auth runtime is enabled", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/health",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "GET",
        "access-control-request-headers": "content-type,anti-csrf",
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-allow-headers"]).toContain("content-type");
    expect(res.headers["access-control-allow-headers"]).toContain("anti-csrf");
    expect(res.headers["vary"]).toContain("Origin");
  });

  it("delegates handled auth errors without swallowing generic fastify failures", async () => {
    const authRes = await app.inject({
      method: "GET",
      url: "/auth/fail",
    });

    expect(authRes.statusCode).toBe(401);
    expect(JSON.parse(authRes.body)).toEqual({ error: "auth_runtime_error" });

    const genericRes = await app.inject({
      method: "GET",
      url: "/auth/fail-open",
    });

    expect(genericRes.statusCode).toBe(500);
    expect(genericRes.body).toContain("generic failure");
  });
});

describe("CORS origin policy", () => {
  beforeEach(() => {
    restoreCorsEnv();
  });

  afterEach(restoreCorsEnv);
  afterAll(restoreCorsEnv);

  it("keeps permissive reflected origins outside production", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.FRONTEND_ORIGIN;

    const devApp = await buildReadyAuthApp();
    try {
      const res = await injectHealthPreflight(
        devApp,
        "https://unconfigured-local.example",
      );

      expect(res.statusCode).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "https://unconfigured-local.example",
      );
    } finally {
      await devApp.close();
    }
  });

  it("allows only FRONTEND_ORIGIN in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_ORIGIN = "https://app.astral.example";

    const prodApp = await buildReadyAuthApp();
    try {
      const allowedRes = await injectHealthPreflight(
        prodApp,
        "https://app.astral.example",
        "content-type,anti-csrf",
      );

      expect(allowedRes.statusCode).toBe(204);
      expect(allowedRes.headers["access-control-allow-origin"]).toBe(
        "https://app.astral.example",
      );
      expect(allowedRes.headers["access-control-allow-credentials"]).toBe("true");
      expect(allowedRes.headers["access-control-allow-headers"]).toContain(
        "anti-csrf",
      );

      const blockedRes = await injectHealthPreflight(
        prodApp,
        "https://evil.example",
      );

      expect(blockedRes.statusCode).toBe(204);
      expect(blockedRes.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await prodApp.close();
    }
  });

  it("fails closed when production FRONTEND_ORIGIN is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.FRONTEND_ORIGIN;

    const prodApp = await buildReadyAuthApp();
    try {
      const res = await injectHealthPreflight(
        prodApp,
        "https://app.astral.example",
      );

      expect(res.statusCode).toBe(404);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await prodApp.close();
    }
  });
});
