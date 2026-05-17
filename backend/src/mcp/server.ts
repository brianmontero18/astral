import type { FastifyReply, FastifyRequest } from "fastify";
import {
  resolveMcpPrincipal,
  type McpAuthError,
  type ResolveMcpPrincipalResult,
} from "./auth.js";

const MCP_PROTOCOL_VERSION = "2025-06-18";
const JSONRPC_VERSION = "2.0";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: typeof JSONRPC_VERSION;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcErrorResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId;
  error: JsonRpcErrorObject;
}

interface JsonRpcSuccessResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId;
  result: unknown;
}

const AUTH_ERROR_CODES: Record<McpAuthError, number> = {
  authentication_required: -32001,
  invalid_token: -32002,
  token_expired: -32003,
  token_revoked: -32004,
  invalid_audience: -32005,
  insufficient_scope: -32006,
  client_inactive: -32007,
  account_inactive: -32008,
  consent_required: -32009,
};

function getHeaderValue(header: string | Array<string> | undefined): string | undefined {
  return Array.isArray(header) ? header[0] : header;
}

function wantsJson(request: FastifyRequest): boolean {
  const accept = getHeaderValue(request.headers.accept);
  return Boolean(
    accept &&
    (accept.includes("application/json") || accept.includes("*/*")) &&
    (accept.includes("text/event-stream") || accept.includes("*/*")),
  );
}

function isSameHostOrigin(request: FastifyRequest): boolean {
  const origin = getHeaderValue(request.headers.origin);
  if (!origin) return true;

  const host =
    getHeaderValue(request.headers["x-forwarded-host"]) ??
    getHeaderValue(request.headers.host);
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function readRequestId(body: unknown): JsonRpcId {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const id = (body as { id?: unknown }).id;
  if (typeof id === "string" || typeof id === "number" || id === null) {
    return id;
  }
  return null;
}

function isJsonRpcRequest(body: unknown): body is JsonRpcRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const candidate = body as { jsonrpc?: unknown; id?: unknown; method?: unknown };
  const validId =
    candidate.id === undefined ||
    candidate.id === null ||
    typeof candidate.id === "string" ||
    typeof candidate.id === "number";

  return (
    candidate.jsonrpc === JSONRPC_VERSION &&
    validId &&
    (candidate.method === undefined || typeof candidate.method === "string")
  );
}

function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined;
}

function success(id: JsonRpcId, result: unknown): JsonRpcSuccessResponse {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    result,
  };
}

function errorResponse(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function authErrorResponse(
  id: JsonRpcId,
  auth: Exclude<ResolveMcpPrincipalResult, { kind: "authorized" }>,
): JsonRpcErrorResponse {
  return errorResponse(
    id,
    AUTH_ERROR_CODES[auth.error],
    auth.error,
    {
      tokenId: auth.tokenId,
      userId: auth.userId,
      clientId: auth.clientId,
      requiredScopes: auth.requiredScopes ?? [],
    },
  );
}

function initializeResult() {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    serverInfo: {
      name: "astral-guide-remote-mcp",
      version: "0.1.0",
    },
  };
}

async function authorizeForMethod(
  request: FastifyRequest,
  method: string | undefined,
): Promise<ResolveMcpPrincipalResult> {
  const requiredScopes = method === "tools/call" ? ["mcp:ask"] : [];
  return resolveMcpPrincipal({
    authorizationHeader: request.headers.authorization,
    requiredScopes,
  });
}

export async function handleMcpPost(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  reply.header("mcp-protocol-version", MCP_PROTOCOL_VERSION);

  if (!isSameHostOrigin(request)) {
    await reply.status(403).type("application/json").send({
      error: "origin_not_allowed",
    });
    return;
  }

  if (!wantsJson(request)) {
    await reply.status(406).type("application/json").send({
      error: "not_acceptable",
    });
    return;
  }

  const id = readRequestId(request.body);
  if (!isJsonRpcRequest(request.body) || !request.body.method) {
    await reply
      .status(400)
      .type("application/json")
      .send(errorResponse(id, -32600, "Invalid Request"));
    return;
  }

  const message = request.body;
  const auth = await authorizeForMethod(request, message.method);
  if (auth.kind !== "authorized") {
    await reply
      .status(auth.statusCode)
      .type("application/json")
      .send(authErrorResponse(id, auth));
    return;
  }

  if (isNotification(message)) {
    await reply.status(202).send();
    return;
  }

  if (message.method === "initialize") {
    await reply
      .status(200)
      .type("application/json")
      .send(success(message.id ?? null, initializeResult()));
    return;
  }

  if (message.method === "ping") {
    await reply
      .status(200)
      .type("application/json")
      .send(success(message.id ?? null, {}));
    return;
  }

  if (message.method === "tools/list") {
    await reply
      .status(200)
      .type("application/json")
      .send(success(message.id ?? null, { tools: [] }));
    return;
  }

  await reply
    .status(200)
    .type("application/json")
    .send(errorResponse(message.id ?? null, -32601, "Method not found"));
}

export async function handleMcpUnsupportedMethod(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply
    .status(405)
    .header("allow", "POST")
    .type("application/json")
    .send({ error: "method_not_allowed" });
}
