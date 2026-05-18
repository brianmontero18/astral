import type { FastifyInstance } from "fastify";
import {
  MCP_PROTECTED_RESOURCE_METADATA_PATH,
  MCP_PROTECTED_RESOURCE_METADATA_PATH_FOR_RESOURCE,
  mcpProtectedResourceMetadata,
} from "../mcp/discovery.js";

export async function mcpDiscoveryRoutes(app: FastifyInstance) {
  for (const path of [
    MCP_PROTECTED_RESOURCE_METADATA_PATH,
    MCP_PROTECTED_RESOURCE_METADATA_PATH_FOR_RESOURCE,
  ]) {
    app.get(path, async (request, reply) => {
      const metadata = mcpProtectedResourceMetadata(request);
      if (!metadata) {
        await reply.status(503).type("application/json").send({
          error: "mcp_authorization_server_not_configured",
        });
        return;
      }

      await reply
        .status(200)
        .type("application/json")
        .header("cache-control", "no-store")
        .send(metadata);
    });
  }
}
