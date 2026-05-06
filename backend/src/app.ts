/**
 * App Builder
 *
 * Extracts Fastify app construction from server.ts for testability.
 * Tests import buildApp() and use inject() without starting a real server.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { createAuthRuntime, type AuthRuntime } from "./auth/supertokens.js";
import { healthRoutes } from "./routes/health.js";
import { transitRoutes } from "./routes/transits.js";
import { chatRoutes } from "./routes/chat.js";
import { userRoutes } from "./routes/users.js";
import { assetRoutes } from "./routes/assets.js";
import { extractRoutes } from "./routes/extract.js";
import { transcribeRoutes } from "./routes/transcribe.js";
import { reportRoutes } from "./routes/report.js";

function isHtmlAuthEntryRequest(acceptHeader: string | undefined, requestUrl: string) {
  if (!acceptHeader?.includes("text/html")) {
    return false;
  }

  // Match every auth sub-path the React SPA owns. SuperTokens itself only
  // claims its API endpoints (e.g. /auth/signinup/code/consume); everything
  // listed below is rendered client-side and must fall through to index.html
  // so the SPA can read the URL and complete the flow. Mirrors the dev-only
  // bypass list in frontend/vite.config.ts — keep both in sync.
  return (
    requestUrl === "/auth" ||
    requestUrl === "/auth/" ||
    requestUrl.startsWith("/auth?") ||
    requestUrl.startsWith("/auth/?") ||
    requestUrl.startsWith("/auth/verify")
  );
}

function buildCorsOptions(auth: AuthRuntime) {
  if (!auth.enabled) {
    return { origin: true };
  }

  return {
    origin: true,
    credentials: true,
    allowedHeaders: Array.from(
      new Set(["content-type", ...auth.corsHeaders]),
    ),
  };
}

export async function buildApp(opts?: { logger?: boolean; auth?: AuthRuntime }) {
  const app = Fastify({ logger: opts?.logger ?? false });
  const auth = opts?.auth ?? createAuthRuntime();

  app.setErrorHandler(async (error, request, reply) => {
    const handled = await auth.handleError(error, request, reply);

    if (!handled && !reply.sent) {
      await reply.send(error);
    }
  });

  await app.register(cors, buildCorsOptions(auth));
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await auth.register(app);

  if (auth.enabled) {
    // Fastify only runs preHandler hooks for matched routes, so auth endpoints
    // need a wildcard route for the SuperTokens hook to intercept them.
    await app.all("/auth/*", async (request, reply) => {
      const requestUrl = request.raw.url ?? request.url;
      const acceptHeader =
        typeof request.headers.accept === "string"
          ? request.headers.accept
          : undefined;

      if (isHtmlAuthEntryRequest(acceptHeader, requestUrl)) {
        await reply.callNotFound();
        return;
      }

      if (!reply.sent) {
        await reply.status(404).send({ error: "Not Found" });
      }
    });
  }

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(transitRoutes);
      await api.register(chatRoutes);
      await api.register(userRoutes);
      await api.register(assetRoutes);
      await api.register(extractRoutes);
      await api.register(transcribeRoutes);
      await api.register(reportRoutes);
    },
    { prefix: "/api" },
  );

  return app;
}
