/**
 * Seed eval corpus — read-only extracción de turnos de chat recientes para
 * etiquetado humano (astral-y3c.3).
 *
 * Uso:
 *   ./node_modules/.bin/tsx scripts/prod-audits/seed-eval-corpus.ts > seed.json
 *   ./node_modules/.bin/tsx scripts/prod-audits/seed-eval-corpus.ts --limit 30 > seed.json
 *
 * Read-only. NO llama a ningún modelo — no consume tokens. Imprime un array JSON
 * a stdout (el operador redirige a archivo). Cada entry trae el turno assistant,
 * el mensaje user previo y el intake/memory del usuario, listo para etiquetar.
 */
import "./lib/prod-env.js";
import { createProdClient } from "./lib/prod-db.js";
import { mapSeedRow } from "../../src/evals/eval-ops.js";

function parseLimit(argv: string[]): number {
  const idx = argv.indexOf("--limit");
  if (idx === -1) return 30;
  const n = Number(argv[idx + 1]);
  return Number.isFinite(n) && n > 0 && n <= 200 ? Math.trunc(n) : 30;
}

const limit = parseLimit(process.argv.slice(2));
const client = createProdClient("read");

const result = await client.execute({
  sql: `
    SELECT
      a.id          AS assistant_id,
      a.user_id     AS user_id,
      a.content     AS assistant_content,
      a.created_at  AS created_at,
      (SELECT u.content FROM chat_messages u
        WHERE u.user_id = a.user_id AND u.role = 'user' AND u.id < a.id
        ORDER BY u.id DESC LIMIT 1) AS user_content,
      usr.name      AS name,
      usr.email     AS email,
      usr.intake    AS intake,
      usr.memory_md AS memory_md
    FROM chat_messages a
    JOIN users usr ON usr.id = a.user_id
    WHERE a.role = 'assistant'
    ORDER BY a.id DESC
    LIMIT ?
  `,
  args: [limit],
});

// Oldest-first reads more naturally for a human reviewer.
const entries = result.rows.map((row) => mapSeedRow(row)).reverse();
console.log(JSON.stringify(entries, null, 2));

await client.close();
