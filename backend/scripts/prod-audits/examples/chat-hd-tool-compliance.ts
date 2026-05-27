/**
 * Audita respuestas de chat con claims HD verificables pero sin tool calls.
 *
 * Uso (desde backend/):
 *   ./node_modules/.bin/tsx scripts/prod-audits/examples/chat-hd-tool-compliance.ts [email] [days]
 *
 * Default: todos los usuarios, últimos 7 días.
 */
import "../lib/prod-env.js";
import { createProdClient } from "../lib/prod-db.js";

const email = process.argv[2];
const days = Number(process.argv[3] ?? 7);

if (!Number.isFinite(days) || days <= 0) {
  console.error("Usage: chat-hd-tool-compliance.ts [email] [days]");
  process.exit(1);
}

const HD_CLAIM_RE = /\b(canal(?:es)?|puerta(?:s)?|centro(?:s)?|gate(?:s)?|channel(?:s)?)\b/i;
const CHANNEL_ID_RE = /\b\d{1,2}-\d{1,2}\b/;
const GATE_NUMBER_RE = /\b(?:puerta|gate)\s+\d{1,2}\b/i;
const sinceModifier = `-${days} days`;

interface AssistantMessageRow {
  id: number;
  user_id: string;
  user_name: string | null;
  email: string | null;
  created_at: string;
  content: string;
}

interface LlmCallRow {
  created_at: string;
  route: string;
  model: string;
  tool_calls_count: number;
  tool_calls_json: string | null;
  prompt_hash: string;
}

function hasVerifiableHdClaim(content: string): boolean {
  return HD_CLAIM_RE.test(content) && (CHANNEL_ID_RE.test(content) || GATE_NUMBER_RE.test(content));
}

function preview(content: string): string {
  return content.replace(/\s+/g, " ").slice(0, 220);
}

const client = createProdClient("read");

const messages = await client.execute({
  sql: `
    SELECT cm.id, cm.user_id, u.name AS user_name, u.email, cm.created_at, cm.content
    FROM chat_messages cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.role = 'assistant'
      AND cm.created_at > datetime('now', ?)
      ${email ? "AND lower(u.email) = lower(?)" : ""}
    ORDER BY cm.created_at DESC
  `,
  args: email ? [sinceModifier, email] : [sinceModifier],
});

const suspects: Array<{ message: AssistantMessageRow; call: LlmCallRow | null }> = [];

for (const raw of messages.rows) {
  const message = raw as unknown as AssistantMessageRow;
  if (!hasVerifiableHdClaim(message.content)) continue;

  const callResult = await client.execute({
    sql: `
      SELECT created_at, route, model, tool_calls_count, tool_calls_json, prompt_hash
      FROM llm_calls
      WHERE user_id = ?
        AND route IN ('chat', 'chat_stream', 'mcp_ask')
        AND created_at <= ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [message.user_id, message.created_at],
  });
  const call = (callResult.rows[0] as unknown as LlmCallRow | undefined) ?? null;
  if (!call || call.tool_calls_count === 0) {
    suspects.push({ message, call });
  }
}

console.log(`HD tool-compliance suspects: ${suspects.length}`);
console.log(`Window: last ${days} day(s)${email ? ` · ${email}` : ""}`);

for (const { message, call } of suspects) {
  console.log("\n---");
  console.log(`${message.created_at} · ${message.user_name ?? "Unknown"} <${message.email ?? "no-email"}>`);
  console.log(`message_id=${message.id}`);
  if (call) {
    console.log(
      `nearest_llm_call=${call.created_at} route=${call.route} model=${call.model} ` +
        `tools=${call.tool_calls_count} prompt_hash=${call.prompt_hash}`,
    );
  } else {
    console.log("nearest_llm_call=NOT_FOUND");
  }
  console.log(preview(message.content));
}

await client.close();
