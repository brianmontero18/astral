/**
 * Detecta patrones de data inconsistente. Hoy busca:
 *
 *   1. users con profile.humanDesign.type vacío pero ≥1 HD asset
 *      (firma del bug astral-0b7 ya cerrado, queda como cicatriz histórica)
 *   2. users con profile_asset_id NULL pero profile.humanDesign no vacío
 *      (asset desvinculado — caso Mayra antes del fix)
 *   3. users con profile_asset_id NULL pero ≥1 HD asset upload
 *      (asset huérfano sin vincular)
 *   4. users con ≥2 HD assets activos en su historial
 *      (firma de astral-j8f: REEMPLAZAR agrega en vez de reemplazar)
 *   5. HD assets cuyo filename no contiene el nombre del owner ni es genérico
 *      (posible carta de cliente subida por una coach)
 *
 * Para agregar un patrón nuevo: definir una función que devuelva Row[] con
 * el shape canonical { email, name, detail } y agregarla al array ANOMALIES.
 */
import "../lib/prod-env.js";
import { createProdClient } from "../lib/prod-db.js";

const c = createProdClient("read");

const ANOMALIES: Array<{ name: string; run: () => Promise<unknown[]> }> = [
  {
    name: "users con HD vacío pero ≥1 HD asset (astral-0b7 cicatriz)",
    run: async () => {
      const r = await c.execute(`
        SELECT u.email, u.name,
               (SELECT count(*) FROM assets a WHERE a.user_id = u.id AND a.file_type = 'hd') AS hd_assets
          FROM users u
         WHERE (json_extract(u.profile, '$.humanDesign.type') = '' OR json_extract(u.profile, '$.humanDesign.type') IS NULL)
           AND (SELECT count(*) FROM assets a WHERE a.user_id = u.id AND a.file_type = 'hd') > 0
      `);
      return r.rows.map((row) => ({ email: row.email, name: row.name, hd_assets: row.hd_assets }));
    },
  },
  {
    name: "profile_asset_id NULL pero profile HD lleno",
    run: async () => {
      const r = await c.execute(`
        SELECT email, name
          FROM users
         WHERE profile_asset_id IS NULL
           AND json_extract(profile, '$.humanDesign.type') IS NOT NULL
           AND json_extract(profile, '$.humanDesign.type') != ''
      `);
      return r.rows.map((row) => ({ email: row.email, name: row.name }));
    },
  },
  {
    name: "profile_asset_id NULL pero ≥1 HD asset uploaded",
    run: async () => {
      const r = await c.execute(`
        SELECT u.email, u.name,
               (SELECT count(*) FROM assets a WHERE a.user_id = u.id AND a.file_type = 'hd') AS hd_assets
          FROM users u
         WHERE u.profile_asset_id IS NULL
           AND (SELECT count(*) FROM assets a WHERE a.user_id = u.id AND a.file_type = 'hd') > 0
      `);
      return r.rows.map((row) => ({ email: row.email, name: row.name, hd_assets: row.hd_assets }));
    },
  },
  {
    name: "≥2 HD assets (firma astral-j8f)",
    run: async () => {
      const r = await c.execute(`
        SELECT u.email, u.name, count(a.id) AS hd_count
          FROM users u
          JOIN assets a ON a.user_id = u.id AND a.file_type = 'hd'
         GROUP BY u.id
        HAVING hd_count >= 2
         ORDER BY hd_count DESC
      `);
      return r.rows.map((row) => ({ email: row.email, name: row.name, hd_count: row.hd_count }));
    },
  },
  {
    name: "HD assets con filename de tercero (posible cliente subida por coach)",
    run: async () => {
      const r = await c.execute(`
        SELECT u.email, u.name, a.filename, a.created_at, (a.id = u.profile_asset_id) AS is_active
          FROM users u
          JOIN assets a ON a.user_id = u.id AND a.file_type = 'hd'
      `);
      const out: Array<Record<string, unknown>> = [];
      const generic = /(my[-_ ]?human[-_ ]?design|^chart|bodygraph|^reporte?[-_ ]?dh\b|human[-_ ]?design|export|download|untitled|mi[-_ ]?dise.o)/i;
      for (const row of r.rows) {
        const firstName = String(row.name || "").split(/\s+/)[0]?.toLowerCase() ?? "";
        const fn = String(row.filename || "").toLowerCase();
        if (firstName.length < 3) continue;
        if (fn.includes(firstName)) continue;
        if (generic.test(fn)) continue;
        out.push({ email: row.email, name: row.name, filename: row.filename, created_at: row.created_at, is_active: !!row.is_active });
      }
      return out;
    },
  },
];

for (const a of ANOMALIES) {
  console.log(`\n=== ${a.name} ===`);
  const rows = await a.run();
  if (rows.length === 0) {
    console.log("  (none)");
    continue;
  }
  for (const r of rows) console.log(`  ${JSON.stringify(r)}`);
}

await c.close();
