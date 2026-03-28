/**
 * App Builder
 *
 * Extracts Fastify app construction from server.ts for testability.
 * Tests import buildApp() and use inject() without starting a real server.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { healthRoutes } from "./routes/health.js";
import { transitRoutes } from "./routes/transits.js";
import { chatRoutes } from "./routes/chat.js";
import { userRoutes } from "./routes/users.js";
import { assetRoutes } from "./routes/assets.js";
import { extractRoutes } from "./routes/extract.js";
import { transcribeRoutes } from "./routes/transcribe.js";
import { reportRoutes } from "./routes/report.js";

export async function buildApp(opts?: { logger?: boolean }) {
  const app = Fastify({ logger: opts?.logger ?? false });

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

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
