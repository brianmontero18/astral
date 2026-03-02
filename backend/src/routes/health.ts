import type { FastifyInstance } from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const frontendDist = path.resolve(__dirname, "../../frontend/dist");
    return {
      status: "ok",
      ts: new Date().toISOString(),
      env: process.env.NODE_ENV,
      __dirname,
      frontendDist,
      frontendExists: fs.existsSync(frontendDist),
      frontendFiles: fs.existsSync(frontendDist) ? fs.readdirSync(frontendDist) : [],
    };
  });
}
