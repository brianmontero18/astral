/**
 * Deep dive de un user por email. Muestra todo lo relacionado:
 * - users row completa (incluyendo memory_md y profile JSON)
 * - assets con flag [ACTIVE]
 * - chat_messages (primeros 10 + últimos 10)
 * - llm_calls aggregado por día/route
 * - feedback thumbs si hay
 *
 * Uso:
 *   ./node_modules/.bin/tsx scripts/prod-audits/examples/user-detail.ts <email>
 */
import "../lib/prod-env.js";
import { createProdClient } from "../lib/prod-db.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: user-detail.ts <email>");
  process.exit(1);
}

const client = createProdClient("read");

const tables = new Set((await client.execute(`SELECT name FROM sqlite_master WHERE type='table'`)).rows.map((r) => String(r.name)));
const userCols = (await client.execute(`SELECT name FROM pragma_table_info('users')`)).rows.map((r) => String(r.name));

const u = await client.execute({
  sql: `SELECT ${userCols.join(", ")} FROM users WHERE lower(email) = lower(?)`,
  args: [email],
});
if (u.rows.length === 0) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}
const user = u.rows[0];

console.log(`=== ${user.name} <${user.email}> ===`);
for (const col of userCols) {
  const v = user[col];
  if (v === null || v === undefined) {
    console.log(`  ${col}: NULL`);
    continue;
  }
  const s = String(v);
  if (col === "profile" || col === "intake") {
    try {
      const parsed = JSON.parse(s);
      console.log(`  ${col}: (JSON, ${s.length} chars)`);
      console.log(`    ${JSON.stringify(parsed, null, 2).replace(/\n/g, "\n    ")}`);
    } catch {
      console.log(`  ${col}: ${s.slice(0, 200)}`);
    }
  } else if (col === "memory_md") {
    console.log(`  memory_md (${s.length} chars):`);
    console.log(s.split("\n").map((l) => `    ${l}`).join("\n"));
  } else {
    console.log(`  ${col}: ${s}`);
  }
}

const userId = user.id as string;

if (tables.has("assets")) {
  const a = await client.execute({
    sql: `SELECT id, filename, mime_type, file_type, size_bytes, storage_key, created_at FROM assets WHERE user_id = ? ORDER BY created_at ASC`,
    args: [userId],
  });
  console.log(`\nassets (${a.rows.length}):`);
  for (const r of a.rows) {
    const active = r.id === user.profile_asset_id ? " [ACTIVE]" : "";
    console.log(`  ${r.created_at}  ${r.file_type}  ${r.filename}  ${r.size_bytes}B  id=${r.id}${active}`);
    console.log(`    storage_key: ${r.storage_key}`);
  }
}

if (tables.has("chat_messages")) {
  const total = await client.execute({
    sql: `SELECT count(*) AS n, min(created_at) AS first, max(created_at) AS last FROM chat_messages WHERE user_id = ?`,
    args: [userId],
  });
  console.log(`\nchat_messages: ${total.rows[0].n}  (${total.rows[0].first ?? "—"} → ${total.rows[0].last ?? "—"})`);

  if (Number(total.rows[0].n) > 0) {
    const first10 = await client.execute({
      sql: `SELECT id, created_at, role, substr(content, 1, 220) AS preview FROM chat_messages WHERE user_id = ? ORDER BY id ASC LIMIT 10`,
      args: [userId],
    });
    console.log(`\n  first 10 messages:`);
    for (const m of first10.rows) {
      console.log(`    id=${m.id}  ${m.created_at}  ${m.role}: ${String(m.preview).replace(/\s+/g, " ")}`);
    }
    const last10 = await client.execute({
      sql: `SELECT id, created_at, role, substr(content, 1, 220) AS preview FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 10`,
      args: [userId],
    });
    console.log(`\n  last 10 messages:`);
    for (const m of [...last10.rows].reverse()) {
      console.log(`    id=${m.id}  ${m.created_at}  ${m.role}: ${String(m.preview).replace(/\s+/g, " ")}`);
    }

    const feedback = await client.execute({
      sql: `SELECT id, created_at, feedback_thumb, feedback_at, substr(content, 1, 180) AS preview, substr(feedback_note, 1, 240) AS note
            FROM chat_messages WHERE user_id = ? AND feedback_thumb IS NOT NULL ORDER BY id ASC`,
      args: [userId],
    });
    if (feedback.rows.length > 0) {
      console.log(`\n  feedback thumbs:`);
      for (const f of feedback.rows) {
        console.log(`    id=${f.id}  ${f.created_at}  [${f.feedback_thumb}] at ${f.feedback_at}`);
        console.log(`      assistant said: ${String(f.preview).replace(/\s+/g, " ")}`);
        if (f.note) console.log(`      note: ${String(f.note).replace(/\s+/g, " ")}`);
      }
    }
  }
}

if (tables.has("llm_calls")) {
  const llm = await client.execute({
    sql: `SELECT date(created_at) AS day, route, model, count(*) AS n,
                 sum(tokens_in) AS tin, sum(tokens_out) AS tout, sum(cost_usd) AS cost
          FROM llm_calls WHERE user_id = ? GROUP BY day, route, model ORDER BY day, route`,
    args: [userId],
  });
  console.log(`\nllm_calls by day/route/model:`);
  for (const c of llm.rows) {
    console.log(`  ${c.day}  ${String(c.route).padEnd(14)}  ${String(c.model).padEnd(14)}  n=${String(c.n).padStart(3)}  in=${c.tin}  out=${c.tout}  cost=$${Number(c.cost).toFixed(4)}`);
  }
}

await client.close();
