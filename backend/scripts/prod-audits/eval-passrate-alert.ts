/**
 * Eval pass-rate degradation alert — read-only (astral-y3c.3).
 *
 * Uso:
 *   ./node_modules/.bin/tsx scripts/prod-audits/eval-passrate-alert.ts
 *   ./node_modules/.bin/tsx scripts/prod-audits/eval-passrate-alert.ts --days 7 --threshold 0.7
 *
 * Lee eval_results YA persistidos (no re-corre el harness → sin tokens). Calcula
 * el pass-rate por eval (source='heuristic', surface='chat') desde hace N días y
 * alerta si alguno cae por debajo del umbral. Exit code 1 si hay degradación
 * (para CI/cron). Umbral por --threshold o EVAL_PASSRATE_THRESHOLD (default 0.7).
 * Si EVAL_ALERT_WEBHOOK_URL está seteada, postea un resumen JSON.
 *
 * Scheduling: correr semanalmente vía el scheduler de la plataforma (cron de Fury
 * o GitHub Action programada) invocando este script. No se agrega infra de cron.
 */
import "./lib/prod-env.js";
import { createProdClient } from "./lib/prod-db.js";
import {
  findDegradedEvals,
  resolvePassRateThreshold,
} from "../../src/evals/eval-ops.js";
import type { EvalPassRateRow, EvalSurface } from "../../src/db.js";

function getArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx !== -1 ? argv[idx + 1] : undefined;
}

function parseDays(argv: string[]): number {
  const n = Number(getArg(argv, "--days"));
  return Number.isFinite(n) && n > 0 && n <= 90 ? Math.trunc(n) : 7;
}

const argv = process.argv.slice(2);
const days = parseDays(argv);
const threshold = resolvePassRateThreshold(
  getArg(argv, "--threshold") ?? process.env.EVAL_PASSRATE_THRESHOLD,
);
const surface: EvalSurface = "chat";
const source = "heuristic";
const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

const client = createProdClient("read");
const result = await client.execute({
  sql: `SELECT eval_name, surface, COUNT(*) AS total, COALESCE(SUM(pass), 0) AS passed
        FROM eval_results
        WHERE datetime(created_at) >= datetime(?) AND surface = ? AND source = ?
        GROUP BY surface, eval_name
        ORDER BY surface, eval_name`,
  args: [sinceIso, surface, source],
});
await client.close();

const rows: EvalPassRateRow[] = result.rows.map((row) => {
  const total = Number(row.total ?? 0);
  const passed = Number(row.passed ?? 0);
  return {
    evalName: String(row.eval_name),
    surface: row.surface as EvalSurface,
    total,
    passed,
    passRate: total > 0 ? passed / total : 0,
  };
});

console.log(
  `Eval pass-rate (últimos ${days}d · surface=${surface} · source=${source} · umbral=${threshold}):`,
);
if (rows.length === 0) {
  console.log("  (sin datos en la ventana)");
}
for (const r of rows) {
  const tag = r.passRate >= threshold ? "ok " : "LOW";
  console.log(`  ${tag} ${r.evalName}: ${(r.passRate * 100).toFixed(0)}% (${r.passed}/${r.total})`);
}

const degraded = findDegradedEvals(rows, threshold);
if (degraded.length === 0) {
  console.log("\n✓ Sin degradación.");
  process.exit(0);
}

const summary = degraded
  .map((d) => `${d.evalName} ${(d.passRate * 100).toFixed(0)}% (${d.passed}/${d.total})`)
  .join(", ");
console.error(`\n⚠ Degradación en ${degraded.length} eval(s): ${summary}`);

const webhook = process.env.EVAL_ALERT_WEBHOOK_URL;
if (webhook) {
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `Astral eval degradation (${days}d, pass-rate < ${threshold}): ${summary}`,
      }),
    });
    console.error("Webhook notificado.");
  } catch (err) {
    console.error("Falló el webhook:", err instanceof Error ? err.message : String(err));
  }
}

process.exit(1);
