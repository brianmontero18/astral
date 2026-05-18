import type { FastifyReply, FastifyRequest } from "fastify";

export const MCP_RESOURCE_PATH = "/api/mcp/v1";
export const MCP_PROTECTED_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";
export const MCP_PROTECTED_RESOURCE_METADATA_PATH_FOR_RESOURCE =
  `${MCP_PROTECTED_RESOURCE_METADATA_PATH}${MCP_RESOURCE_PATH}`;

const SUPPORTED_OAUTH_SCOPES = ["openid", "profile", "email", "offline_access"] as const;

type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: ["header"];
  scopes_supported: typeof SUPPORTED_OAUTH_SCOPES;
};

function firstHeaderValue(header: string | string[] | undefined): string | undefined {
  return Array.isArray(header) ? header[0] : header;
}

function readConfiguredUrl(key: string): string | null {
  const raw = process.env[key]?.trim();
  if (!raw) return null;

  try {
    return new URL(raw).toString();
  } catch {
    return null;
  }
}

function readConfiguredIssuer(value: string): string | null {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function requestOrigin(request: FastifyRequest): string {
  const host =
    firstHeaderValue(request.headers["x-forwarded-host"]) ??
    firstHeaderValue(request.headers.host) ??
    "localhost";
  const proto =
    firstHeaderValue(request.headers["x-forwarded-proto"]) ??
    request.protocol ??
    "http";

  return `${proto.split(",")[0]?.trim() || "http"}://${host.split(",")[0]?.trim() || "localhost"}`;
}

function urlFromRequest(request: FastifyRequest, path: string): string {
  return new URL(path, requestOrigin(request)).toString();
}

export function mcpResourceUrl(request: FastifyRequest): string {
  return readConfiguredUrl("MCP_RESOURCE_URL") ?? urlFromRequest(request, MCP_RESOURCE_PATH);
}

export function mcpResourceMetadataUrl(request: FastifyRequest): string {
  const configuredResourceUrl = readConfiguredUrl("MCP_RESOURCE_URL");
  if (configuredResourceUrl) {
    return new URL(MCP_PROTECTED_RESOURCE_METADATA_PATH, configuredResourceUrl).toString();
  }

  return urlFromRequest(request, MCP_PROTECTED_RESOURCE_METADATA_PATH);
}

export function mcpAuthorizationServers(): string[] {
  const raw = process.env.MCP_AUTHORIZATION_SERVER_ISSUER?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      const issuer = readConfiguredIssuer(value);
      return issuer ? [issuer] : [];
    });
}

export function mcpProtectedResourceMetadata(
  request: FastifyRequest,
): ProtectedResourceMetadata | null {
  const authorizationServers = mcpAuthorizationServers();
  if (authorizationServers.length === 0) {
    return null;
  }

  return {
    resource: mcpResourceUrl(request),
    authorization_servers: authorizationServers,
    bearer_methods_supported: ["header"],
    scopes_supported: SUPPORTED_OAUTH_SCOPES,
  };
}

export function addMcpAuthenticateHeader(
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const metadataUrl = mcpResourceMetadataUrl(request);
  reply.header(
    "WWW-Authenticate",
    [
      'Bearer error="invalid_token"',
      'error_description="Authorization needed"',
      `resource_metadata="${metadataUrl}"`,
    ].join(", "),
  );
}
