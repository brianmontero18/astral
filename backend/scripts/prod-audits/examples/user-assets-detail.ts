/**
 * Imprime todos los assets de un usuario + length de campos de profile/intake
 * para diagnosticar cuál asset es la carta correcta.
 *
 * Uso:
 *   ./node_modules/.bin/tsx scripts/prod-audits/examples/user-assets-detail.ts <userId>
 */
import "../lib/prod-env.js";
import { createProdClient } from "../lib/prod-db.js";

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: user-assets-detail.ts <userId>");
  process.exit(1);
}

const client = createProdClient("read");

const userResult = await client.execute({
  sql: "SELECT id, name, email, profile, intake, profile_asset_id FROM users WHERE id = ?",
  args: [userId],
});
const user = userResult.rows[0];
if (!user) {
  console.error("User not found:", userId);
  process.exit(1);
}

console.log(`=== User: ${user.name} <${user.email}> ===`);
console.log(`  id: ${user.id}`);
console.log(`  active profile_asset_id: ${user.profile_asset_id ?? "NULL"}`);

const profile = typeof user.profile === "string" ? JSON.parse(user.profile) : user.profile;
const intake = typeof user.intake === "string" ? JSON.parse(user.intake) : user.intake;

console.log(`\n  profile.name: ${profile?.name ?? "(none)"}`);
console.log(`  profile.birthData: ${JSON.stringify(profile?.birthData ?? null)}`);
console.log(`  profile.humanDesign.type: ${profile?.humanDesign?.type ?? "(empty)"}`);
console.log(`  profile.humanDesign.profile: ${profile?.humanDesign?.profile ?? "(empty)"}`);
console.log(`  profile.humanDesign.authority: ${profile?.humanDesign?.authority ?? "(empty)"}`);
console.log(`  profile.humanDesign.activatedGates.length: ${profile?.humanDesign?.activatedGates?.length ?? 0}`);
console.log(`  profile.humanDesign.channels.length: ${profile?.humanDesign?.channels?.length ?? 0}`);

console.log(`\n  intake: ${JSON.stringify(intake, null, 2)}`);

const assetsResult = await client.execute({
  sql: "SELECT id, filename, mime_type, file_type, size_bytes, storage_key, created_at FROM assets WHERE user_id = ? ORDER BY created_at ASC",
  args: [userId],
});

console.log(`\n=== Assets (${assetsResult.rows.length}) ===`);
for (const row of assetsResult.rows) {
  const marker = row.id === user.profile_asset_id ? " ← ACTIVE" : "";
  console.log(`  - ${row.id}${marker}`);
  console.log(`      filename: ${row.filename}`);
  console.log(`      file_type: ${row.file_type}  mime: ${row.mime_type}  size: ${row.size_bytes}B`);
  console.log(`      storage_key: ${row.storage_key}`);
  console.log(`      created: ${row.created_at}`);
}

await client.close();
