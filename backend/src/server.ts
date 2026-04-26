/**
 * Astral Agent — Backend
 * Node.js / TypeScript / Fastify
 *
 * All API routes under /api prefix.
 * In production, serves the React frontend as static files.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { initDb } from "./db.js";
import { buildApp } from "./app.js";
import { isR2Configured } from "./storage/r2.js";

// ─── Env ──────────────────────────────────────────────────────────────────────

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const IS_PROD = process.env.NODE_ENV === "production";

function assertEnv() {
  const missing: Array<string> = [];
  if (!OPENAI_KEY) missing.push("OPENAI_API_KEY");
  if (IS_PROD && !isR2Configured()) {
    missing.push("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME");
  }
  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────

const app = await buildApp({ logger: true });

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
