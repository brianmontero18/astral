import type { FastifyInstance } from "fastify";
import { handleMcpPost, handleMcpUnsupportedMethod } from "../mcp/server.js";

export async function mcpRoutes(app: FastifyInstance) {
  app.post("/mcp/v1", handleMcpPost);
  app.get("/mcp/v1", handleMcpUnsupportedMethod);
  app.delete("/mcp/v1", handleMcpUnsupportedMethod);
}
