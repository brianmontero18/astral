/**
 * Lista TODOS los users de prod con un resumen schema-agnostic:
 * - Todas las columnas existentes en `users` (descubiertas via pragma_table_info)
 * - Counts de assets / chat_messages / llm_calls relacionados (si las tablas existen)
 *
 * Si mañana se agregan columnas o tablas, este script las muestra automáticamente.
 *
 * Uso (desde backend/):
 *   ./node_modules/.bin/tsx scripts/prod-audits/examples/users-overview.ts
 */
import "../lib/prod-env.js";
import { createProdClient } from "../lib/prod-db.js";

const client = createProdClient("read");

const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
const tableNames = new Set(tables.rows.map((r) => String(r.name)));

const userCols = await client.execute(`SELECT name FROM pragma_table_info('users')`);
const colNames = userCols.rows.map((r) => String(r.name));
console.log(`users columns (${colNames.length}): ${colNames.join(", ")}`);
console.log(`tables present (${tableNames.size}): ${[...tableNames].join(", ")}\n`);

// Build a SELECT that pulls everything, omitting heavy blobs/long text by default.
const SHORT_PREVIEW = new Set(["profile", "intake", "memory_md"]);
const select = colNames
  .map((c) => (SHORT_PREVIEW.has(c) ? `length(${c}) AS ${c}_len` : c))
  .join(", ");

const all = await client.execute(`SELECT ${select} FROM users ORDER BY created_at ASC`);

for (const row of all.rows) {
  console.log(`--- ${row.name ?? "(no name)"} <${row.email ?? "(no email)"}> ---`);
  for (const col of colNames) {
    if (SHORT_PREVIEW.has(col)) {
      const lenKey = `${col}_len`;
      console.log(`  ${col}: ${row[lenKey] ?? "NULL"} chars`);
    } else {
      const v = row[col];
      const s = v === null || v === undefined ? "NULL" : String(v);
      console.log(`  ${col}: ${s.length > 80 ? s.slice(0, 77) + "…" : s}`);
    }
  }
  // Related counts
  const userId = row.id as string;
  for (const rel of ["assets", "chat_messages", "llm_calls"]) {
    if (!tableNames.has(rel)) continue;
    const r = await client.execute({
      sql: `SELECT count(*) AS n, max(created_at) AS last FROM ${rel} WHERE user_id = ?`,
      args: [userId],
    });
    console.log(`  ${rel}: ${r.rows[0].n}  (last: ${r.rows[0].last ?? "—"})`);
  }
  console.log();
}

await client.close();
