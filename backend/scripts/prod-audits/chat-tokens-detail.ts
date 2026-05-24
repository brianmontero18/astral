/**
 * Deep dive de los chat_stream calls de un user (lookup por email).
 * Muestra el schema de llm_calls + los últimos N calls con TODOS sus campos
 * (tokens_in/out, cached_tokens, latency, cost, prompt_hash, tool_calls si
 * existen, etc).
 *
 * Útil para diagnosticar:
 * - Alucinaciones (¿el modelo usó las tools? — buscar tool_calls > 0).
 * - Context budget (cuántos tokens está consumiendo por turn).
 * - Cache hit rate (cached_tokens vs tokens_in).
 * - Latencia anormal.
 *
 * Uso:
 *   ./node_modules/.bin/tsx scripts/prod-audits/chat-tokens-detail.ts <email> [limit]
 *
 * Default limit: 8.
 */
import "./lib/prod-env.js";
import { createProdClient } from "./lib/prod-db.js";

const email = process.argv[2];
const limit = Number(process.argv[3] ?? 8);

if (!email) {
  console.error("Usage: chat-tokens-detail.ts <email> [limit]");
  process.exit(1);
}

const client = createProdClient("read");

const u = await client.execute({
  sql: "SELECT id, email, name FROM users WHERE lower(email) = lower(?)",
  args: [email],
});

if (u.rows.length === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

const user = u.rows[0] as { id: string; email: string; name: string };
console.log(`=== ${user.name} <${user.email}> (${user.id}) ===\n`);

const cols = await client.execute("SELECT name FROM pragma_table_info('llm_calls')");
console.log("llm_calls columns:");
console.log("  " + cols.rows.map((r: { name: string }) => r.name).join(", "));

const calls = await client.execute({
  sql: `SELECT * FROM llm_calls WHERE user_id = ? AND route = 'chat_stream' ORDER BY created_at DESC LIMIT ?`,
  args: [user.id, limit],
});

console.log(`\nlast ${calls.rows.length} chat_stream calls:`);

for (const row of calls.rows) {
  const r = row as Record<string, unknown>;
  console.log(`\n--- ${String(r.created_at)} ---`);
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (v == null) continue;
    if (typeof v === "string" && v.length > 200) {
      console.log(`  ${k}: ${v.substring(0, 200)}... [${v.length} chars]`);
    } else {
      console.log(`  ${k}: ${String(v)}`);
    }
  }
}
