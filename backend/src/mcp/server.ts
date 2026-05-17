import type { FastifyReply, FastifyRequest } from "fastify";
import {
  insertMcpAuditEvent,
  type McpAuditStatus,
} from "../db.js";
import {
  resolveMcpPrincipal,
  type McpAuthError,
  type ResolveMcpPrincipalResult,
} from "./auth.js";
import {
  allMcpTools,
  findMcpTool,
  McpToolCallError,
  serializeMcpTool,
  type McpToolDefinition,
} from "./tools.js";
import {
  checkMcpToolBudget,
  MCP_TOOL_CALL_COMPLETED_EVENT,
} from "./budgets.js";

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
  const mediaTypes = accept
    ?.toLowerCase()
    .split(",")
    .map((part) => part.trim().split(";")[0]?.trim())
    .filter((part): part is string => Boolean(part));
  const acceptsAny = mediaTypes?.includes("*/*") ?? false;

  return Boolean(
    mediaTypes &&
    (acceptsAny || mediaTypes.includes("application/json")) &&
    (acceptsAny || mediaTypes.includes("text/event-stream")),
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
  requiredScopes: ReadonlyArray<string> = [],
): Promise<ResolveMcpPrincipalResult> {
  return resolveMcpPrincipal({
    authorizationHeader: request.headers.authorization,
    requiredScopes,
  });
}

function includesAllScopes(
  grantedScopes: ReadonlyArray<string>,
  requiredScopes: ReadonlyArray<string>,
): boolean {
  const granted = new Set(grantedScopes);
  return requiredScopes.every((scope) => granted.has(scope));
}

function parseToolCallParams(
  params: unknown,
): { name: string; args: unknown } | { error: JsonRpcErrorResponse } {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return { error: errorResponse(null, -32602, "Invalid params") };
  }

  const candidate = params as { name?: unknown; arguments?: unknown };
  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    return { error: errorResponse(null, -32602, "Invalid params") };
  }

  return {
    name: candidate.name,
    args: candidate.arguments ?? {},
  };
}

type McpAuditIdentity = {
  userId?: string | null;
  clientId?: string | null;
  tokenId?: string | null;
};

function auditIdentityFromAuth(
  auth: ResolveMcpPrincipalResult,
): McpAuditIdentity | null {
  if (auth.kind === "authorized") {
    return auth.principal;
  }

  if (!auth.userId && !auth.clientId && !auth.tokenId) {
    return null;
  }

  return {
    userId: auth.userId,
    clientId: auth.clientId,
    tokenId: auth.tokenId,
  };
}

async function recordMcpToolAudit(
  request: FastifyRequest,
  identity: McpAuditIdentity | null,
  input: {
    event: string;
    toolName: string;
    status: McpAuditStatus;
    metadata?: object;
  },
): Promise<void> {
  try {
    await insertMcpAuditEvent({
      userId: identity?.userId,
      clientId: identity?.clientId,
      tokenId: identity?.tokenId,
      event: input.event,
      toolName: input.toolName,
      sideEffectsMode: "mcp_read_only",
      status: input.status,
      metadata: input.metadata,
    });
  } catch (err) {
    request.log.warn({ err, toolName: input.toolName }, "mcp audit insert failed");
  }
}

async function visibleToolsForRequest(
  request: FastifyRequest,
): Promise<Array<ReturnType<typeof serializeMcpTool>>> {
  const visible = [];

  for (const tool of allMcpTools()) {
    const auth = await authorizeForMethod(request, tool.requiredScopes);
    if (auth.kind === "authorized" && includesAllScopes(auth.principal.scopes, tool.requiredScopes)) {
      visible.push(serializeMcpTool(tool));
    }
  }

  return visible;
}

async function authorizeToolCall(
  request: FastifyRequest,
  tool: McpToolDefinition,
): Promise<ResolveMcpPrincipalResult> {
  return authorizeForMethod(request, tool.requiredScopes);
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
  const auth = await authorizeForMethod(request);
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
      .send(success(message.id ?? null, { tools: await visibleToolsForRequest(request) }));
    return;
  }

  if (message.method === "tools/call") {
    const parsed = parseToolCallParams(message.params);
    if ("error" in parsed) {
      await reply
        .status(200)
        .type("application/json")
        .send({
          ...parsed.error,
          id: message.id ?? null,
        });
      return;
    }

    const tool = findMcpTool(parsed.name);
    if (!tool) {
      await reply
        .status(200)
        .type("application/json")
        .send(errorResponse(message.id ?? null, -32602, "Unknown tool", {
          toolName: parsed.name,
        }));
      return;
    }

    const toolAuth = await authorizeToolCall(request, tool);
    if (toolAuth.kind !== "authorized") {
      await recordMcpToolAudit(request, auditIdentityFromAuth(toolAuth), {
        event: "tool_call_blocked",
        toolName: tool.name,
        status: "denied",
        metadata: { reason: toolAuth.error },
      });
      await reply
        .status(toolAuth.statusCode)
        .type("application/json")
        .send(authErrorResponse(message.id ?? null, toolAuth));
      return;
    }

    const budget = await checkMcpToolBudget({
      principal: toolAuth.principal,
      toolName: tool.name,
      budget: tool.budget,
    });
    if (!budget.allowed) {
      await recordMcpToolAudit(request, toolAuth.principal, {
        event: "tool_call_blocked",
        toolName: tool.name,
        status: "denied",
        metadata: {
          reason: "budget_exceeded",
          period: budget.period,
          limit: budget.limit,
          used: budget.used,
        },
      });
      await reply
        .status(429)
        .type("application/json")
        .send(errorResponse(message.id ?? null, -32011, "budget_exceeded", {
          period: budget.period,
          limit: budget.limit,
          used: budget.used,
        }));
      return;
    }

    try {
      await recordMcpToolAudit(request, toolAuth.principal, {
        event: "tool_call_started",
        toolName: tool.name,
        status: "success",
      });
      const result = await tool.call(parsed.args, {
        app: request.server,
        principal: toolAuth.principal,
      });
      await recordMcpToolAudit(request, toolAuth.principal, {
        event: MCP_TOOL_CALL_COMPLETED_EVENT,
        toolName: tool.name,
        status: "success",
      });
      await reply
        .status(200)
        .type("application/json")
        .send(success(message.id ?? null, result));
    } catch (err) {
      await recordMcpToolAudit(request, toolAuth.principal, {
        event: "tool_call_failed",
        toolName: tool.name,
        status: "error",
        metadata: {
          message: err instanceof Error ? err.message : String(err),
        },
      });

      if (err instanceof McpToolCallError) {
        await reply
          .status(200)
          .type("application/json")
          .send(errorResponse(message.id ?? null, err.code, err.message, err.data));
        return;
      }

      request.log.error({ err, toolName: tool.name }, "mcp tool call failed");
      await reply
        .status(502)
        .type("application/json")
        .send(errorResponse(message.id ?? null, -32000, "tool_call_failed"));
    }
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
