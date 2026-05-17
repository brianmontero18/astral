# Remote MCP client smoke matrix

**Date**: 2026-05-17.
**Branch**: `feature/astral-mcp-architecture`.
**Bead**: `astral-2s5`.
**Endpoint tested**: `/api/mcp/v1` with `FEATURE_REMOTE_MCP=true`.

This matrix validates client compatibility after Slice 5. It is not a public
support promise. The goal is to identify which clients can be used for the next
private beta pass and which clients need OAuth, UI login, or further research.

## Control smoke

Local server:

```bash
cd backend
TURSO_DATABASE_URL="file:<temp-db>" node --import tsx/esm scripts/seed-mcp-smoke.ts
FEATURE_REMOTE_MCP=true \
TURSO_DATABASE_URL="file:<temp-db>" \
OPENAI_API_KEY="test-key-not-real" \
NODE_ENV=test \
MCP_ASK_ASTRAL_GUIDE_TEST_REPLY="MCP-client-smoke-reply" \
PORT=60777 \
node --import tsx/esm src/server.ts
```

Raw JSON-RPC over HTTP passed against the local server:

- `tools/list` with the read-only token returned only:
  - `find_channel_by_gates_v1`
  - `find_channels_by_gate_v1`
  - `get_center_for_gate_v1`
- This confirms the server-side Streamable HTTP, bearer auth, consent, and scope
  path before involving client CLIs.

## Matrix

| Client | Local version / evidence | Result | Notes |
|---|---:|---|---|
| Claude Code | `claude --version` -> `2.1.143`; `claude mcp add --help` documents `--transport http` and `--header` | **Connected** | `claude mcp add --scope user --transport http astral-smoke http://127.0.0.1:60777/api/mcp/v1 --header "Authorization: Bearer <read-only-token>"` in an isolated `HOME` succeeded. `claude mcp get astral-smoke` reported connected status. |
| Codex CLI | `codex --version` -> `codex-cli 0.125.0`; `codex mcp add --help` documents `--url` and `--bearer-token-env-var` | **Config validated** | With isolated `CODEX_HOME`, `codex mcp add astral-smoke --url http://127.0.0.1:60777/api/mcp/v1 --bearer-token-env-var ASTRAL_MCP_TOKEN` succeeded and `codex mcp get astral-smoke --json` returned `streamable_http`. Tool invocation still needs an interactive/model run; no separate `list-tools` CLI exists. |
| Cursor | `cursor --version` -> `3.4.20`; `cursor --help` documents `--add-mcp`; `cursor agent mcp --help` documents `list`, `list-tools`, `enable`, `disable` | **Blocked locally** | `cursor agent mcp list` failed with `ERROR: SecItemCopyMatching failed -50` in this environment, and `cursor agent status` reports not logged in. Needs authenticated Cursor Agent session before real MCP list/call validation. |
| ChatGPT | No local CLI path in this repo | **Blocked by OAuth** | Keep unsupported for beta until Astral exposes real OAuth/OIDC-compatible MCP auth. PAT bearer is not the target consumer connector path. |
| Gemini CLI | `gemini` binary exists | **Research-only / not validated** | Local `gemini --help` and `gemini mcp --help` hung and had to be killed. Do not claim Gemini MCP support from this environment. |

## Beta recommendation

1. Use **Claude Code** as the first private beta client. It can connect to the
   current Streamable HTTP endpoint with bearer headers.
2. Use **Codex CLI** as a config-compatible second client, but do one manual
   agent run before calling it fully validated.
3. Treat **Cursor** as pending until the local Cursor Agent auth/keychain issue is
   resolved.
4. Do not start **ChatGPT** connector work before OAuth.
5. Keep **Gemini** research-only until its CLI can be inspected and configured
   reliably.

## Follow-up for Slice 7

- Run the normal backend gate:
  - `cd backend && npm run check`
  - `cd backend && npm run test`
  - `cd backend && npm run smoke:mcp`
- Optional manual beta smoke:
  - Configure Claude Code with a short-lived beta token.
  - `tools/list` must show only scopes granted by the token and consent.
  - Call `get_center_for_gate_v1` with `{ "gate": 1 }`.
  - Call `ask_astral_guide_v1` only with an `mcp:ask` token.
