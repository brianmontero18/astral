/**
 * Astral Agent — Backend
 * Node.js / TypeScript / Fastify
 *
 * All API routes under /api prefix.
 * In production, serves the React frontend as static files.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { initDb } from "./db.js";
import { healthRoutes } from "./routes/health.js";
import { transitRoutes } from "./routes/transits.js";
import { chatRoutes } from "./routes/chat.js";
import { userRoutes } from "./routes/users.js";
import { assetRoutes } from "./routes/assets.js";
import { extractRoutes } from "./routes/extract.js";

// ─── Env ──────────────────────────────────────────────────────────────────────

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const IS_PROD = process.env.NODE_ENV === "production";

function assertEnv() {
  const missing = [!OPENAI_KEY && "OPENAI_API_KEY"].filter(Boolean);
  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────

const app = Fastify({ logger: true });

// Plugins
await app.register(cors, {
  origin: IS_PROD ? true : true, // tighten in production with real domain
});

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ─── API Routes (under /api prefix) ──────────────────────────────────────────

await app.register(
  async (api) => {
    await api.register(healthRoutes);
    await api.register(transitRoutes);
    await api.register(chatRoutes);
    await api.register(userRoutes);
    await api.register(assetRoutes);
    await api.register(extractRoutes);
  },
  { prefix: "/api" },
);

// ─── Static files (production) ───────────────────────────────────────────────

if (IS_PROD) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");

  await app.register(fastifyStatic, {
    root: frontendDist,
    wildcard: false,
  });

  // SPA fallback: any non-API route serves index.html
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.sendFile("index.html");
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────

try {
  assertEnv();
  await initDb();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Astral backend running on port ${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
