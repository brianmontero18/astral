#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${MCP_SMOKE_PORT:-$(node -e "const net = require('node:net'); const server = net.createServer(); server.listen(0, '127.0.0.1', function () { console.log(server.address().port); server.close(); });")}"
BASE_URL="http://127.0.0.1:${PORT}"
DB_PATH="$(mktemp -t astral-mcp-smoke.XXXXXX)"
LOG_PATH="$(mktemp -t astral-mcp-server.XXXXXX)"
SERVER_PID=""
LAST_BODY=""
LAST_HEADERS=""
LAST_STATUS=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  rm -f "${DB_PATH}" "${DB_PATH}-shm" "${DB_PATH}-wal" "${LOG_PATH}"
  if [[ -n "${LAST_BODY}" ]]; then
    rm -f "${LAST_BODY}"
  fi
  if [[ -n "${LAST_HEADERS}" ]]; then
    rm -f "${LAST_HEADERS}"
  fi
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  if [[ -f "${LOG_PATH}" ]]; then
    echo "--- server log ---" >&2
    tail -80 "${LOG_PATH}" >&2 || true
  fi
  exit 1
}

pass() {
  echo "PASS: $*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

json_get() {
  local expr="$1"
  SEED_JSON="${SEED_JSON}" node -e "const data = JSON.parse(process.env.SEED_JSON); const value = ${expr}; process.stdout.write(String(value));"
}

assert_status() {
  local expected="$1"
  local label="$2"
  [[ "${LAST_STATUS}" == "${expected}" ]] || fail "${label}: expected HTTP ${expected}, got ${LAST_STATUS}. Body: $(cat "${LAST_BODY}")"
}

assert_body_empty() {
  local label="$1"
  [[ ! -s "${LAST_BODY}" ]] || fail "${label}: expected empty body, got $(cat "${LAST_BODY}")"
}

assert_json() {
  local label="$1"
  local expr="$2"
  BODY_FILE="${LAST_BODY}" ASSERT_LABEL="${label}" ASSERT_EXPR="${expr}" node -e "
    const fs = require('node:fs');
    const body = fs.readFileSync(process.env.BODY_FILE, 'utf8');
    const expr = process.env.ASSERT_EXPR;
    let data;
    try {
      data = JSON.parse(body);
    } catch (error) {
      console.error('Invalid JSON body:', body);
      process.exit(2);
    }
    const ok = Function('data', 'return (' + expr + ');')(data);
    if (!ok) {
      console.error('Assertion failed:', process.env.ASSERT_LABEL);
      console.error('Body:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
  " || fail "${label}"
}

assert_header_contains() {
  local label="$1"
  local expected="$2"
  local headers
  headers="$(tr -d '\r' < "${LAST_HEADERS}")"
  [[ "${headers}" == *"${expected}"* ]] || fail "${label}: expected header fragment '${expected}', got: ${headers}"
}

request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  shift 3 || true

  if [[ -n "${LAST_BODY}" ]]; then
    rm -f "${LAST_BODY}"
  fi
  LAST_BODY="$(mktemp -t astral-mcp-curl.XXXXXX)"
  LAST_HEADERS="$(mktemp -t astral-mcp-headers.XXXXXX)"
  if [[ -n "${body}" ]]; then
    LAST_STATUS="$(curl -sS -D "${LAST_HEADERS}" -o "${LAST_BODY}" -w "%{http_code}" -X "${method}" "${url}" "$@" --data "${body}")"
  else
    LAST_STATUS="$(curl -sS -D "${LAST_HEADERS}" -o "${LAST_BODY}" -w "%{http_code}" -X "${method}" "${url}" "$@")"
  fi
}

wait_for_server() {
  local attempts=0
  until curl -sS "${BASE_URL}/api/health" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ "${attempts}" -gt 80 ]]; then
      fail "Server did not become ready at ${BASE_URL}"
    fi
    sleep 0.1
  done
}

start_server() {
  local flag="$1"
  : >"${LOG_PATH}"
  FEATURE_REMOTE_MCP="${flag}" \
  TURSO_DATABASE_URL="file:${DB_PATH}" \
  OPENAI_API_KEY="test-key-not-real" \
  NODE_ENV="test" \
  MCP_ASK_ASTRAL_GUIDE_TEST_REPLY="MCP smoke Astral Guide reply" \
  MCP_RESOURCE_URL="${BASE_URL}/api/mcp/v1" \
  MCP_AUTHORIZATION_SERVER_ISSUER="https://auth.astral.test" \
  PORT="${PORT}" \
  node --import tsx/esm src/server.ts >"${LOG_PATH}" 2>&1 &
  SERVER_PID="$!"
  wait_for_server
}

stop_server() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  SERVER_PID=""
}

require_command curl
require_command node

cd "${ROOT_DIR}"
SEED_JSON="$(TURSO_DATABASE_URL="file:${DB_PATH}" node --import tsx/esm scripts/seed-mcp-smoke.ts)"
VALID_TOKEN="$(json_get "data.tokens.valid.token")"
NO_CONSENT_TOKEN="$(json_get "data.tokens.noConsent.token")"
WRONG_AUDIENCE_TOKEN="$(json_get "data.tokens.wrongAudience.token")"
EXPIRED_TOKEN="$(json_get "data.tokens.expired.token")"
REVOKED_TOKEN="$(json_get "data.tokens.revoked.token")"
READ_ONLY_TOKEN="$(json_get "data.tokens.readOnly.token")"
ASK_ONLY_TOKEN="$(json_get "data.tokens.askOnly.token")"
QUOTA_EXCEEDED_TOKEN="$(json_get "data.tokens.quotaExceeded.token")"

echo "Remote MCP curl smoke"
echo "Base URL: ${BASE_URL}"
echo "DB: ${DB_PATH}"

start_server "false"
request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"off","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${VALID_TOKEN}"
assert_status "404" "flag off keeps MCP unregistered"
pass "flag off keeps /api/mcp/v1 unavailable"

request "GET" "${BASE_URL}/.well-known/oauth-protected-resource" ""
assert_status "404" "flag off keeps MCP discovery unregistered"
pass "flag off keeps MCP discovery unavailable"
stop_server

start_server "true"

request "GET" "${BASE_URL}/.well-known/oauth-protected-resource" ""
assert_status "200" "protected resource metadata is available"
assert_json "protected resource metadata uses the MCP resource URL" "data.resource === '${BASE_URL}/api/mcp/v1'"
assert_json "protected resource metadata links the authorization server" "Array.isArray(data.authorization_servers) && data.authorization_servers.includes('https://auth.astral.test')"
assert_json "protected resource metadata lists supported OAuth scopes" "Array.isArray(data.scopes_supported) && data.scopes_supported.includes('openid') && data.scopes_supported.includes('profile') && data.scopes_supported.includes('email')"
pass "protected resource metadata is available"

request "GET" "${BASE_URL}/.well-known/oauth-protected-resource/api/mcp/v1" ""
assert_status "200" "path-specific protected resource metadata is available"
assert_json "path-specific protected resource metadata uses the MCP resource URL" "data.resource === '${BASE_URL}/api/mcp/v1'"
pass "path-specific protected resource metadata is available"

request "GET" "${BASE_URL}/api/mcp/v1" "" \
  -H "accept: application/json, text/event-stream"
assert_status "405" "GET is not a Streamable HTTP MCP call"
assert_json "GET returns method_not_allowed" "data.error === 'method_not_allowed'"
pass "GET is rejected with method_not_allowed"

request "PATCH" "${BASE_URL}/api/mcp/v1" "" \
  -H "accept: application/json, text/event-stream"
assert_status "405" "PATCH is not a Streamable HTTP MCP call"
assert_json "PATCH returns method_not_allowed" "data.error === 'method_not_allowed'"
pass "PATCH is rejected with method_not_allowed"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"missing-auth","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream"
assert_status "401" "missing bearer"
assert_header_contains "missing bearer includes OAuth protected resource discovery" "resource_metadata=\"${BASE_URL}/.well-known/oauth-protected-resource\""
assert_json "missing bearer returns auth error" "data.error.message === 'authentication_required'"
pass "missing bearer returns authentication_required"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"invalid-token","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer not-a-real-token"
assert_status "401" "invalid bearer"
assert_json "invalid bearer returns invalid_token" "data.error.message === 'invalid_token'"
pass "invalid bearer returns invalid_token"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"no-consent","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${NO_CONSENT_TOKEN}"
assert_status "403" "missing consent"
assert_json "missing consent blocks initialize" "data.error.message === 'consent_required'"
assert_json "missing consent does not leak internal ids" "data.error.data && !('userId' in data.error.data) && !('clientId' in data.error.data) && !('tokenId' in data.error.data)"
pass "missing consent blocks initialize"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"wrong-audience","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${WRONG_AUDIENCE_TOKEN}"
assert_status "401" "wrong audience"
assert_json "wrong audience returns invalid_audience" "data.error.message === 'invalid_audience'"
pass "wrong audience returns invalid_audience"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"expired","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${EXPIRED_TOKEN}"
assert_status "401" "expired token"
assert_json "expired token returns token_expired" "data.error.message === 'token_expired'"
pass "expired token returns token_expired"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"revoked","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${REVOKED_TOKEN}"
assert_status "401" "revoked token"
assert_json "revoked token returns token_revoked" "data.error.message === 'token_revoked'"
pass "revoked token returns token_revoked"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"bad-accept","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json" \
  -H "authorization: Bearer ${VALID_TOKEN}"
assert_status "406" "missing event-stream accept"
assert_json "bad accept returns not_acceptable" "data.error === 'not_acceptable'"
pass "bad Accept header is rejected"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"lookalike-accept","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/jsonl, text/event-stream" \
  -H "authorization: Bearer ${VALID_TOKEN}"
assert_status "406" "lookalike JSON accept"
assert_json "lookalike Accept returns not_acceptable" "data.error === 'not_acceptable'"
pass "lookalike Accept media type is rejected"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"bad-origin","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${VALID_TOKEN}" \
  -H "host: astral.guide" \
  -H "origin: https://evil.example"
assert_status "403" "origin mismatch"
assert_json "bad origin returns origin_not_allowed" "data.error === 'origin_not_allowed'"
pass "cross-origin browser request is rejected"

request "POST" "${BASE_URL}/api/mcp/v1" '[{"jsonrpc":"2.0","id":"batch","method":"initialize"}]' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${VALID_TOKEN}"
assert_status "400" "batch requests"
assert_json "batch is rejected as invalid request" "data.error.code === -32600"
pass "batch-shaped JSON is rejected"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"init","method":"initialize"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${VALID_TOKEN}"
assert_status "200" "initialize"
assert_json "initialize returns server info" "data.result.protocolVersion === '2025-06-18' && data.result.serverInfo.name === 'astral-guide-remote-mcp'"
pass "initialize succeeds"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${VALID_TOKEN}"
assert_status "202" "initialized notification"
assert_body_empty "initialized notification"
pass "initialized notification is acknowledged without body"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"ping","method":"ping"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${VALID_TOKEN}"
assert_status "200" "ping"
assert_json "ping returns empty result" "data.result && Object.keys(data.result).length === 0"
pass "ping succeeds"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"tools","method":"tools/list"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${VALID_TOKEN}"
assert_status "200" "tools/list"
assert_json "tools/list exposes ask tool for mcp:ask clients" "Array.isArray(data.result.tools) && data.result.tools.some((tool) => tool.name === 'ask_astral_guide_v1')"
pass "tools/list exposes ask tool for mcp:ask clients"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"call","method":"tools/call","params":{"name":"ask_astral_guide_v1","arguments":{"question":"hello"}}}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${VALID_TOKEN}"
assert_status "200" "ask tool call"
assert_json "ask tool returns content" "Array.isArray(data.result.content) && data.result.content[0].type === 'text' && data.result.content[0].text === 'MCP smoke Astral Guide reply'"
pass "ask tool call succeeds through curl without network LLM"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"read-only-tools","method":"tools/list"}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${READ_ONLY_TOKEN}"
assert_status "200" "read-only tools/list"
assert_json "read-only token does not list ask" "Array.isArray(data.result.tools) && !data.result.tools.some((tool) => tool.name === 'ask_astral_guide_v1')"
assert_json "read-only token lists deterministic HD tool" "data.result.tools.some((tool) => tool.name === 'get_center_for_gate_v1')"
pass "read-only token lists deterministic HD tools without ask"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"read-only-hd-call","method":"tools/call","params":{"name":"get_center_for_gate_v1","arguments":{"gate":1}}}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${READ_ONLY_TOKEN}"
assert_status "200" "deterministic HD tool call"
assert_json "deterministic HD tool returns center" "data.result.structuredContent && data.result.structuredContent.gate === 1 && data.result.structuredContent.center === 'G'"
pass "read-only token can call deterministic HD tool"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"ask-only-hd-call","method":"tools/call","params":{"name":"get_center_for_gate_v1","arguments":{"gate":1}}}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${ASK_ONLY_TOKEN}"
assert_status "403" "deterministic HD tool requires mcp:read_hd"
assert_json "ask-only token cannot call deterministic HD tool" "data.error.code === -32006 && data.error.message === 'insufficient_scope'"
pass "ask-only token cannot call deterministic HD tool"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"read-only-call","method":"tools/call","params":{"name":"ask_astral_guide_v1","arguments":{"question":"hello"}}}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${READ_ONLY_TOKEN}"
assert_status "403" "ask tool requires mcp:ask"
assert_json "read-only token cannot call ask" "data.error.code === -32006 && data.error.message === 'insufficient_scope'"
pass "read-only token cannot call ask"

request "POST" "${BASE_URL}/api/mcp/v1" '{"jsonrpc":"2.0","id":"quota-call","method":"tools/call","params":{"name":"ask_astral_guide_v1","arguments":{"question":"hello"}}}' \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer ${QUOTA_EXCEEDED_TOKEN}"
assert_status "200" "ask tool monthly chat quota"
assert_json "quota-exhausted token cannot call ask" "data.error.code === -32014 && data.error.message === 'message_limit_reached' && data.error.data.plan === 'premium' && data.error.data.used === 300 && data.error.data.limit === 300"
pass "quota-exhausted token cannot call ask"

echo "Remote MCP curl smoke complete"
