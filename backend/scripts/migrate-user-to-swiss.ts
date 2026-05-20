/**
 * Migración a Swiss Ephemeris bodygraph desde birth data manual.
 *
 * Reemplaza el approach legacy de PDF-as-source-of-truth (astral-m25)
 * por Swiss Ephemeris determinístico (astral-e5f / astral-4ue): el PDF
 * deja de ser la fuente del bodygraph; el bodygraph se computa desde
 * { date, time, place } y el PDF queda solo como archivo histórico.
 *
 * Manual override 100%: el founder pasa los datos por args. No hay
 * auto-extract desde PDF (mucha variabilidad entre formatos) ni Vision.
 *
 * Uso:
 *   ./node_modules/.bin/tsx scripts/migrate-user-to-swiss.ts \
 *     --user-id=<uuid> \
 *     --date=YYYY-MM-DD \
 *     --time=HH:MM \
 *     --place="City, Province, Country" \
 *     [--name="Display Name"] \
 *     [--clear-active-asset] \
 *     [--geo-pick=<index 0-N, default 0>] \
 *     [--dry-run]
 *
 * Modo dry-run: imprime el profile resultante sin escribir DB.
 * Modo normal: snapshot del row pre-update + UPDATE en prod.
 */
import "./prod-audits/lib/prod-env.js";
import { createProdClient } from "./prod-audits/lib/prod-db.js";
import { calculateBodygraph } from "../src/bodygraph/calculate.js";
import { autocompletePlaces } from "../src/places/geonames.js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      out[arg.slice(2)] = true;
    } else {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  return out;
}

const args = parseArgs();

function require_(key: string): string {
  const v = args[key];
  if (typeof v !== "string" || !v.trim()) {
    console.error(`Missing required arg: --${key}=...`);
    process.exit(1);
  }
  return v.trim();
}

const userId = require_("user-id");
const date = require_("date"); // YYYY-MM-DD
const time = require_("time"); // HH:MM 24h
const placeQuery = require_("place");
const nameOverride = typeof args.name === "string" ? args.name : undefined;
const dryRun = args["dry-run"] === true;
const clearActiveAsset = args["clear-active-asset"] === true;
const geoPick = typeof args["geo-pick"] === "string" ? Number(args["geo-pick"]) : 0;

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("--date must be YYYY-MM-DD");
  process.exit(1);
}
if (!/^\d{1,2}:\d{2}$/.test(time)) {
  console.error("--time must be HH:MM (24h)");
  process.exit(1);
}

// ─── Pre-flight ──────────────────────────────────────────────────────────────

const readClient = createProdClient("read");

const userRes = await readClient.execute({
  sql: "SELECT id, name, email, profile, profile_asset_id FROM users WHERE id = ?",
  args: [userId],
});
const user = userRes.rows[0];
if (!user) {
  console.error(`User ${userId} not found`);
  process.exit(1);
}

console.log(`\n━━━ User ${user.name} <${user.email}> ━━━`);
console.log(`  id: ${user.id}`);
console.log(`  current profile_asset_id: ${user.profile_asset_id ?? "NULL"}`);

const oldProfile = typeof user.profile === "string" ? JSON.parse(user.profile) : user.profile;
console.log(`  current profile.name: ${oldProfile?.name ?? "(none)"}`);
console.log(`  current profile.birthData: ${JSON.stringify(oldProfile?.birthData ?? null)}`);
console.log(`  current humanDesign.type: ${oldProfile?.humanDesign?.type ?? "(empty)"}`);
console.log(`  current humanDesign.profile: ${oldProfile?.humanDesign?.profile ?? "(empty)"}`);
console.log(`  current humanDesign.authority: ${oldProfile?.humanDesign?.authority ?? "(empty)"}`);
console.log(`  current humanDesign.activatedGates.length: ${oldProfile?.humanDesign?.activatedGates?.length ?? 0}`);

// ─── Geocode ─────────────────────────────────────────────────────────────────

console.log(`\n━━━ Geocoding "${placeQuery}" ━━━`);
const places = await autocompletePlaces(placeQuery, { limit: 5 });
if (places.length === 0) {
  console.error(`No GeoNames results for "${placeQuery}". Try a different query.`);
  process.exit(1);
}
places.forEach((p, i) => {
  const marker = i === geoPick ? " ← PICK" : "";
  console.log(`  [${i}] ${p.name}, ${p.admin1}, ${p.country} (lat=${p.lat}, lon=${p.lon})${marker}`);
});
if (geoPick < 0 || geoPick >= places.length) {
  console.error(`--geo-pick=${geoPick} out of range (0..${places.length - 1})`);
  process.exit(1);
}
const place = places[geoPick];
const placeLabel = `${place.name}, ${place.admin1}, ${place.country}`.replace(/, ,/g, ",");

// ─── Calculate bodygraph ────────────────────────────────────────────────────

console.log(`\n━━━ Running Swiss Ephemeris ━━━`);
const profile = await calculateBodygraph({
  date,
  time,
  coordinates: { lat: place.lat, lon: place.lon },
  placeLabel,
  name: nameOverride ?? (user.name as string),
});

console.log(`  new profile.name: ${profile.name}`);
console.log(`  new profile.birthData:`);
console.log(`    dateLocalIso: ${profile.birthData?.dateLocalIso}`);
console.log(`    dateUtcIso: ${profile.birthData?.dateUtcIso}`);
console.log(`    placeLabel: ${profile.birthData?.placeLabel}`);
console.log(`    coordinates: ${JSON.stringify(profile.birthData?.coordinates)}`);
console.log(`    timezoneOffsetHours: ${profile.birthData?.timezoneOffsetHours}`);
console.log(`    ageYears: ${profile.birthData?.ageYears}`);
console.log(`  new humanDesign.type: ${profile.humanDesign.type} (qualifier: ${profile.humanDesign.typeQualifier})`);
console.log(`  new humanDesign.profile: ${profile.humanDesign.profile} (${profile.humanDesign.profileName})`);
console.log(`  new humanDesign.authority: ${profile.humanDesign.authority}`);
console.log(`  new humanDesign.definition: ${profile.humanDesign.definition}`);
console.log(`  new humanDesign.incarnationCross: ${profile.humanDesign.incarnationCross}`);
console.log(`  new humanDesign.activatedGates.length: ${profile.humanDesign.activatedGates.length}`);
console.log(`  new humanDesign.channels.length: ${profile.humanDesign.channels.length}`);
console.log(`  new humanDesign.definedCenters: ${JSON.stringify(profile.humanDesign.definedCenters)}`);
console.log(`  new humanDesign.channels:`);
for (const ch of profile.humanDesign.channels) {
  console.log(`    - ${ch.id} ${ch.name}`);
}

await readClient.close();

// ─── Persist (or dry-run exit) ──────────────────────────────────────────────

if (dryRun) {
  console.log(`\n━━━ DRY-RUN — no DB write ━━━`);
  process.exit(0);
}

console.log(`\n━━━ Backup pre-update ━━━`);
const backupDir = path.resolve(import.meta.dirname, "migration-backups");
await mkdir(backupDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `${ts}-${userId}.json`);
await writeFile(
  backupPath,
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      userId,
      args: { date, time, placeQuery, placeResolved: place, name: nameOverride, clearActiveAsset, geoPick },
      previous: { name: user.name, profile: oldProfile, profile_asset_id: user.profile_asset_id },
    },
    null,
    2,
  ),
);
console.log(`  Saved: ${backupPath}`);

console.log(`\n━━━ Writing prod DB ━━━`);
const writeClient = createProdClient("write");
const newAssetId = clearActiveAsset ? null : user.profile_asset_id;
const updateRes = await writeClient.execute({
  sql: "UPDATE users SET name = ?, profile = ?, profile_asset_id = ?, updated_at = datetime('now') WHERE id = ?",
  args: [profile.name, JSON.stringify(profile), newAssetId as string | null, userId],
});
await writeClient.close();

if (updateRes.rowsAffected !== 1) {
  console.error(`UPDATE returned ${updateRes.rowsAffected} rows affected. Expected 1. Check DB state.`);
  process.exit(1);
}
console.log(`  Updated 1 row.`);
console.log(`  profile_asset_id: ${user.profile_asset_id ?? "NULL"} → ${newAssetId ?? "NULL"}`);
console.log(`\n✓ Migration complete for ${user.name}.`);
