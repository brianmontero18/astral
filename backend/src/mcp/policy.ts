import type { AppUserPlan } from "../db.js";

export const MCP_ASK_SCOPE = "mcp:ask";
export const MCP_READ_HD_SCOPE = "mcp:read_hd";
export const MCP_WRITE_BODYGRAPH_SCOPE = "mcp:write_bodygraph";

export const MCP_PRODUCT_SCOPES = [
  MCP_ASK_SCOPE,
  MCP_READ_HD_SCOPE,
  MCP_WRITE_BODYGRAPH_SCOPE,
] as const;

export type McpProductScope = (typeof MCP_PRODUCT_SCOPES)[number];

export function allowedMcpScopesForPlan(plan: AppUserPlan): Array<McpProductScope> {
  if (plan === "premium") {
    return [MCP_READ_HD_SCOPE, MCP_WRITE_BODYGRAPH_SCOPE, MCP_ASK_SCOPE];
  }

  if (plan === "basic") {
    return [MCP_READ_HD_SCOPE, MCP_WRITE_BODYGRAPH_SCOPE];
  }

  return [];
}

export function isRemoteMcpPlan(plan: AppUserPlan): boolean {
  return allowedMcpScopesForPlan(plan).length > 0;
}

export function planAllowsMcpScopes(
  plan: AppUserPlan,
  requiredScopes: ReadonlyArray<string>,
): boolean {
  const allowed = new Set(allowedMcpScopesForPlan(plan));
  return requiredScopes.every((scope) => allowed.has(scope as McpProductScope));
}
