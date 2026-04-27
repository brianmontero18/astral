import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";

import { getCurrentChatUsageCycle } from "./chat-limits.js";
import type { ReportTier } from "./report/types.js";
import {
  buildAssetKey,
  deleteObject as r2DeleteObject,
  getObject as r2GetObject,
  inferExtensionFromFile,
  putObject as r2PutObject,
} from "./storage/r2.js";

let client: Client;

export type AppUserPlan = "free" | "basic" | "premium";
export type AppUserRole = "user" | "admin";
export type AppUserStatus = "active" | "disabled" | "banned";

interface AppUserAccessInput {
  plan?: AppUserPlan;
  role?: AppUserRole;
  status?: AppUserStatus;
}

interface AppUserCreateInput extends AppUserAccessInput {
  // Astral-owned support contact field. Nullable until auth/provider sync exists.
  email?: string | null;
}

export interface AppUserRecord {
  id: string;
  name: string;
  email: string | null;
  profile: object;
  intake: object | null;
  plan: AppUserPlan;
  role: AppUserRole;
  status: AppUserStatus;
  created_at: string;
  updated_at: string;
}

export interface AppUserListRecord extends AppUserRecord {
  linked: boolean;
}

export interface AppUserIdentityRecord {
  provider: string;
  subject: string;
}

const DEFAULT_USER_PLAN: AppUserPlan = "free";
const DEFAULT_USER_ROLE: AppUserRole = "user";
const DEFAULT_USER_STATUS: AppUserStatus = "active";

function resolveUserAccess(access: AppUserAccessInput = {}) {
  return {
    plan: access.plan ?? DEFAULT_USER_PLAN,
    role: access.role ?? DEFAULT_USER_ROLE,
    status: access.status ?? DEFAULT_USER_STATUS,
  };
}

function mapUserRow(row: Record<string, unknown>): AppUserRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    email: typeof row.email === "string" ? row.email : null,
    profile: JSON.parse(row.profile as string),
    intake: row.intake ? JSON.parse(row.intake as string) : null,
    plan: (row.plan as AppUserPlan | null) ?? DEFAULT_USER_PLAN,
    role: (row.role as AppUserRole | null) ?? DEFAULT_USER_ROLE,
    status: (row.status as AppUserStatus | null) ?? DEFAULT_USER_STATUS,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapLinkedFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

// ─── Migrations ──────────────────────────────────────────────────────────────

/**
 * Detects the legacy `assets` schema (with `data BLOB NOT NULL` and a nullable
 * `storage_key`) and rebuilds the table to the R2-only shape inside a single
 * libsql transaction. Idempotent: running it on an already-migrated DB or a
 * fresh install is a no-op. Refuses to run when any row would violate the
 * new NOT NULL invariant — preserves the legacy table untouched and surfaces
 * a clear error instead of silently dropping data.
 *
 * Exported for direct testing: see `__tests__/db-migration-rebuild.test.ts`.
 *
 * Note on the SELECT below: `pragma_table_info` exposes a column literally
 * named `notnull`, which is a reserved word in libsql/SQLite (part of the
 * `IS NOTNULL` operator). It can be referenced if quoted, but it cannot be
 * used as an unquoted alias — hence we read it back without aliasing and
 * access it via bracket notation on the row object.
 */
export async function rebuildLegacyAssetsTableIfNeeded(c: Client): Promise<void> {
  const assetsInfo = await c.execute({
    sql: 'SELECT name, "notnull" FROM pragma_table_info(\'assets\')',
    args: [],
  });
  const dataColumnExists = assetsInfo.rows.some((row) => row.name === "data");
  const storageKeyColumn = assetsInfo.rows.find((row) => row.name === "storage_key");
  const storageKeyNullable = storageKeyColumn
    ? Number(storageKeyColumn["notnull"]) === 0
    : false;

  if (!(dataColumnExists || storageKeyNullable)) {
    return;
  }

  const orphans = await c.execute({
    sql: "SELECT COUNT(*) AS count FROM assets WHERE storage_key IS NULL",
    args: [],
  });
  const orphanCount = Number(orphans.rows[0]?.count ?? 0);
  if (orphanCount > 0) {
    throw new Error(
      `Cannot rebuild assets table: ${orphanCount} row(s) have NULL storage_key. ` +
      "Migrate them to R2 (or DELETE the rows) before redeploying with this schema.",
    );
  }

  await c.batch(
    [
      `CREATE TABLE assets_new (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename    TEXT NOT NULL,
        mime_type   TEXT NOT NULL,
        file_type   TEXT NOT NULL,
        size_bytes  INTEGER NOT NULL,
        storage_key TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `INSERT INTO assets_new (id, user_id, filename, mime_type, file_type, size_bytes, storage_key, created_at, updated_at)
       SELECT id, user_id, filename, mime_type, file_type, size_bytes, storage_key, created_at, updated_at
       FROM assets`,
      "DROP TABLE assets",
      "ALTER TABLE assets_new RENAME TO assets",
    ],
    "write",
  );
}

// ─── Init ────────────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./astral.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  client = createClient({ url, ...(authToken && { authToken }) });

  await client.execute("PRAGMA foreign_keys = ON");

  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        email      TEXT DEFAULT NULL,
        profile    TEXT NOT NULL CHECK(json_valid(profile)),
        intake     TEXT DEFAULT NULL CHECK(intake IS NULL OR json_valid(intake)),
        plan       TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'basic', 'premium')),
        role       TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        status     TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled', 'banned')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS assets (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename    TEXT NOT NULL,
        mime_type   TEXT NOT NULL,
        file_type   TEXT NOT NULL,
        size_bytes  INTEGER NOT NULL,
        storage_key TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS transit_cache (
        week_key   TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role           TEXT NOT NULL,
        content        TEXT NOT NULL,
        feedback_thumb TEXT DEFAULT NULL CHECK(feedback_thumb IS NULL OR feedback_thumb IN ('up','down')),
        feedback_note  TEXT DEFAULT NULL,
        feedback_at    TEXT DEFAULT NULL,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS llm_calls (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        route       TEXT NOT NULL CHECK(route IN ('chat','chat_stream','report','extraction')),
        model       TEXT NOT NULL,
        tokens_in   INTEGER NOT NULL DEFAULT 0,
        tokens_out  INTEGER NOT NULL DEFAULT 0,
        cost_usd    REAL    NOT NULL DEFAULT 0,
        latency_ms  INTEGER NOT NULL DEFAULT 0,
        prompt_hash TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS hd_reports (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tier         TEXT NOT NULL CHECK(tier IN ('free', 'premium')),
        profile_hash TEXT NOT NULL,
        content      TEXT NOT NULL,
        tokens_used  INTEGER NOT NULL DEFAULT 0,
        cost_usd     REAL NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, tier)
      )`,
      `CREATE TABLE IF NOT EXISTS report_shares (
        token      TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_id  TEXT NOT NULL REFERENCES hd_reports(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS user_identities (
        id               TEXT PRIMARY KEY,
        user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider         TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(provider, provider_user_id)
      )`,
    ],
    "write",
  );

  // ─── Idempotent migrations for existing DBs ────────────────────────────────
  // SQLite ALTER TABLE ADD COLUMN doesn't accept dynamic defaults like
  // datetime('now'), so we add the column nullable and backfill from created_at.
  const idempotentAlters: Array<string> = [
    "ALTER TABLE users ADD COLUMN intake TEXT DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN email TEXT DEFAULT NULL",
    "ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
    "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE assets ADD COLUMN updated_at TEXT",
    "ALTER TABLE hd_reports ADD COLUMN updated_at TEXT",
    "ALTER TABLE assets ADD COLUMN storage_key TEXT DEFAULT NULL",
    "ALTER TABLE chat_messages ADD COLUMN feedback_thumb TEXT DEFAULT NULL",
    "ALTER TABLE chat_messages ADD COLUMN feedback_note TEXT DEFAULT NULL",
    "ALTER TABLE chat_messages ADD COLUMN feedback_at TEXT DEFAULT NULL",
  ];

  for (const sql of idempotentAlters) {
    try {
      await client.execute(sql);
    } catch {
      // Column already exists — safe to ignore.
    }
  }

  // Backfill new updated_at columns from created_at so rows inserted before the
  // migration still have a meaningful timestamp.
  try {
    await client.batch(
      [
        "UPDATE assets SET updated_at = created_at WHERE updated_at IS NULL",
        "UPDATE hd_reports SET updated_at = created_at WHERE updated_at IS NULL",
      ],
      "write",
    );
  } catch {
    // Tables may not exist yet on a fresh run; CREATE TABLE above handled defaults.
  }

  // ─── One-shot R2 schema cleanup ────────────────────────────────────────────
  // Legacy schema kept the asset bytes in a `data BLOB NOT NULL` column and
  // stored the R2 key as nullable. With R2 as the source of truth the BLOB
  // column is dead weight and storage_key must be NOT NULL. Detect the legacy
  // shape and rebuild the table when present. See rebuildLegacyAssetsTableIfNeeded
  // for the detail (extracted so it is directly testable).
  await rebuildLegacyAssetsTableIfNeeded(client);

  // ─── Indexes ───────────────────────────────────────────────────────────────
  // SQLite does not auto-index foreign keys. These cover the hot-path queries
  // that filter or order by user_id and shared-token expiry.
  await client.batch(
    [
      "CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_chat_user_created ON chat_messages(user_id, created_at)",
      "CREATE INDEX IF NOT EXISTS idx_identities_user ON user_identities(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_shares_user ON report_shares(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_shares_expires ON report_shares(expires_at)",
      "CREATE INDEX IF NOT EXISTS idx_llm_calls_user_created ON llm_calls(user_id, created_at)",
    ],
    "write",
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function createUser(
  name: string,
  profile: object,
  options: AppUserCreateInput = {},
): Promise<string> {
  const id = randomUUID();
  const resolvedAccess = resolveUserAccess(options);
  await client.execute({
    sql: "INSERT INTO users (id, name, email, profile, plan, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [
      id,
      name,
      options.email ?? null,
      JSON.stringify(profile),
      resolvedAccess.plan,
      resolvedAccess.role,
      resolvedAccess.status,
    ],
  });
  return id;
}

export async function createUserWithIdentity(
  name: string,
  profile: object,
  provider: string,
  providerUserId: string,
  options: AppUserCreateInput = {},
): Promise<string> {
  const userId = randomUUID();
  const resolvedAccess = resolveUserAccess(options);
  await client.batch(
    [
      {
        sql: "INSERT INTO users (id, name, email, profile, plan, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [
          userId,
          name,
          options.email ?? null,
          JSON.stringify(profile),
          resolvedAccess.plan,
          resolvedAccess.role,
          resolvedAccess.status,
        ],
      },
      {
        sql: "INSERT INTO user_identities (id, user_id, provider, provider_user_id) VALUES (?, ?, ?, ?)",
        args: [randomUUID(), userId, provider, providerUserId],
      },
    ],
    "write",
  );

  return userId;
}

export async function getUser(
  id: string,
): Promise<AppUserRecord | undefined> {
  const result = await client.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return mapUserRow(row);
}

export async function findUserByIdentity(
  provider: string,
  providerUserId: string,
): Promise<AppUserRecord | undefined> {
  const result = await client.execute({
    sql: `
      SELECT
        users.id,
        users.name,
        users.email,
        users.profile,
        users.intake,
        users.plan,
        users.role,
        users.status,
        users.created_at,
        users.updated_at
      FROM user_identities
      INNER JOIN users ON users.id = user_identities.user_id
      WHERE user_identities.provider = ? AND user_identities.provider_user_id = ?
      LIMIT 1
    `,
    args: [provider, providerUserId],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return mapUserRow(row);
}

export interface AppUserListPageRecord {
  users: Array<AppUserListRecord>;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  rangeStart: number;
  rangeEnd: number;
}

const DEFAULT_ADMIN_USERS_PAGE_SIZE = 12;
const MAX_ADMIN_USERS_PAGE_SIZE = 100;

export async function listUsers({
  query = "",
  page = 1,
  pageSize = DEFAULT_ADMIN_USERS_PAGE_SIZE,
}: {
  query?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<AppUserListPageRecord> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const safePageSize = Math.min(
    MAX_ADMIN_USERS_PAGE_SIZE,
    Math.max(1, Number.isFinite(pageSize) ? Math.floor(pageSize) : DEFAULT_ADMIN_USERS_PAGE_SIZE),
  );
  const normalizedPage =
    Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const whereClause = normalizedQuery
    ? `
      WHERE
        lower(users.name) LIKE ?
        OR lower(COALESCE(users.email, '')) LIKE ?
        OR lower(users.id) LIKE ?
    `
    : "";
  const searchPattern = `%${normalizedQuery}%`;
  const filterArgs = normalizedQuery
    ? [searchPattern, searchPattern, searchPattern]
    : [];

  const countResult = await client.execute({
    sql: `
      SELECT COUNT(*) AS count
      FROM users
      ${whereClause}
    `,
    args: filterArgs,
  });
  const totalItems = Number(countResult.rows[0]?.count ?? 0);

  if (totalItems === 0) {
    return {
      users: [],
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      pageSize: safePageSize,
      rangeStart: 0,
      rangeEnd: 0,
    };
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(normalizedPage, totalPages);
  const offset = (currentPage - 1) * safePageSize;
  const result = await client.execute({
    sql: `
      SELECT
        users.*,
        EXISTS(
          SELECT 1
          FROM user_identities
          WHERE user_identities.user_id = users.id
        ) AS linked
      FROM users
      ${whereClause}
      ORDER BY datetime(users.created_at) DESC, users.id DESC
      LIMIT ? OFFSET ?
    `,
    args: [...filterArgs, safePageSize, offset],
  });

  return {
    users: result.rows.map((row) => ({
      ...mapUserRow(row),
      linked: mapLinkedFlag(row.linked),
    })),
    currentPage,
    totalPages,
    totalItems,
    pageSize: safePageSize,
    rangeStart: offset + 1,
    rangeEnd: offset + result.rows.length,
  };
}

export async function getUserIdentity(
  userId: string,
): Promise<AppUserIdentityRecord | null> {
  const result = await client.execute({
    sql: `
      SELECT provider, provider_user_id AS subject
      FROM user_identities
      WHERE user_id = ?
      ORDER BY datetime(created_at) ASC, id ASC
      LIMIT 1
    `,
    args: [userId],
  });
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    provider: row.provider as string,
    subject: row.subject as string,
  };
}

export async function updateUserProfile(
  id: string,
  name: string,
  profile: object,
  intake?: object | null,
): Promise<boolean> {
  const result = await client.execute({
    sql: "UPDATE users SET name = ?, profile = ?, intake = ?, updated_at = datetime('now') WHERE id = ?",
    args: [name, JSON.stringify(profile), intake ? JSON.stringify(intake) : null, id],
  });
  return result.rowsAffected > 0;
}

export async function updateUserAccess(
  id: string,
  access: AppUserAccessInput,
): Promise<boolean> {
  const updates: Array<string> = [];
  const args: Array<string> = [];

  if (access.role) {
    updates.push("role = ?");
    args.push(access.role);
  }

  if (access.plan) {
    updates.push("plan = ?");
    args.push(access.plan);
  }

  if (access.status) {
    updates.push("status = ?");
    args.push(access.status);
  }

  if (updates.length === 0) {
    return false;
  }

  const result = await client.execute({
    sql: `UPDATE users SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    args: [...args, id],
  });

  return result.rowsAffected > 0;
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await client.execute({
    sql: "DELETE FROM users WHERE id = ?",
    args: [id],
  });
  return result.rowsAffected > 0;
}

// ─── Assets ──────────────────────────────────────────────────────────────────

export async function createAsset(
  userId: string,
  filename: string,
  mimeType: string,
  fileType: string,
  data: Buffer,
): Promise<string> {
  const id = randomUUID();
  const ext = inferExtensionFromFile(filename, mimeType);
  const storageKey = buildAssetKey(userId, id, ext);

  await r2PutObject({ key: storageKey, body: data, contentType: mimeType });

  await client.execute({
    sql: "INSERT INTO assets (id, user_id, filename, mime_type, file_type, size_bytes, storage_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [id, userId, filename, mimeType, fileType, data.length, storageKey],
  });
  return id;
}

export async function getUserAssets(
  userId: string,
): Promise<Array<{ id: string; filename: string; mime_type: string; file_type: string; size_bytes: number; created_at: string }>> {
  const result = await client.execute({
    sql: "SELECT id, filename, mime_type, file_type, size_bytes, created_at FROM assets WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    filename: row.filename as string,
    mime_type: row.mime_type as string,
    file_type: row.file_type as string,
    size_bytes: row.size_bytes as number,
    created_at: row.created_at as string,
  }));
}

export async function getUserAssetCount(userId: string): Promise<number> {
  const result = await client.execute({
    sql: "SELECT COUNT(*) as count FROM assets WHERE user_id = ?",
    args: [userId],
  });

  return (result.rows[0]?.count as number) ?? 0;
}

export async function getAsset(
  id: string,
): Promise<{ id: string; user_id: string; filename: string; mime_type: string; file_type: string; data: Buffer; size_bytes: number; storage_key: string; created_at: string; updated_at: string } | undefined> {
  const result = await client.execute({
    sql: "SELECT id, user_id, filename, mime_type, file_type, size_bytes, storage_key, created_at, updated_at FROM assets WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;

  const storageKey = row.storage_key as string;
  const data = await r2GetObject(storageKey);

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    filename: row.filename as string,
    mime_type: row.mime_type as string,
    file_type: row.file_type as string,
    data,
    size_bytes: row.size_bytes as number,
    storage_key: storageKey,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function deleteAsset(id: string): Promise<boolean> {
  const lookup = await client.execute({
    sql: "SELECT storage_key FROM assets WHERE id = ?",
    args: [id],
  });
  const storageKey = lookup.rows[0]?.storage_key as string | undefined;

  if (!storageKey) {
    return false;
  }

  try {
    await r2DeleteObject(storageKey);
  } catch (error) {
    // Log via stderr but don't fail the DB delete — the row removal is
    // the source of truth for the user-facing operation. R2 orphans can
    // be reaped by a separate cleanup job later.
    console.error(`[deleteAsset] R2 delete failed for ${storageKey}:`, error);
  }

  const result = await client.execute({
    sql: "DELETE FROM assets WHERE id = ?",
    args: [id],
  });
  return result.rowsAffected > 0;
}

// ─── Transit Cache ───────────────────────────────────────────────────────────

export async function getCachedTransits(weekKey: string): Promise<object | undefined> {
  const result = await client.execute({
    sql: "SELECT data FROM transit_cache WHERE week_key = ?",
    args: [weekKey],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return JSON.parse(row.data as string);
}

export async function setCachedTransits(weekKey: string, data: object): Promise<void> {
  await client.execute({
    sql: "INSERT OR REPLACE INTO transit_cache (week_key, data, created_at) VALUES (?, ?, datetime('now'))",
    args: [weekKey, JSON.stringify(data)],
  });
}

// ─── Chat Messages ───────────────────────────────────────────────────────────

export async function saveChatMessage(
  userId: string,
  role: string,
  content: string,
  createdAt?: string,
): Promise<number> {
  const result = await client.execute({
    sql: createdAt
      ? "INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?, ?, ?, ?) RETURNING id"
      : "INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?) RETURNING id",
    args: createdAt
      ? [userId, role, content, createdAt]
      : [userId, role, content],
  });
  return result.rows[0].id as number;
}

export async function getChatMessages(
  userId: string,
): Promise<Array<{ id: number; role: string; content: string; created_at: string }>> {
  const result = await client.execute({
    sql: "SELECT id, role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id ASC",
    args: [userId],
  });
  return result.rows.map((row) => ({
    id: row.id as number,
    role: row.role as string,
    content: row.content as string,
    created_at: row.created_at as string,
  }));
}

export async function deleteChatMessagesFrom(userId: string, fromId: number): Promise<number> {
  const result = await client.execute({
    sql: "DELETE FROM chat_messages WHERE user_id = ? AND id >= ?",
    args: [userId, fromId],
  });
  return result.rowsAffected;
}

export async function getUserMessageCount(
  userId: string,
  now = new Date(),
): Promise<number> {
  const { windowStartUtc, nextWindowStartUtc } = getCurrentChatUsageCycle(now);
  const result = await client.execute({
    sql: `SELECT COUNT(*) as count
          FROM chat_messages
          WHERE user_id = ?
            AND role = 'user'
            AND created_at >= ?
            AND created_at < ?`,
    args: [userId, windowStartUtc, nextWindowStartUtc],
  });
  return (result.rows[0]?.count as number) ?? 0;
}

// ─── HD Reports ──────────────────────────────────────────────────────────────

export async function getReport(
  userId: string,
  tier: string,
): Promise<{ id: string; user_id: string; tier: string; profile_hash: string; content: string; tokens_used: number; cost_usd: number; created_at: string; updated_at: string } | undefined> {
  const result = await client.execute({
    sql: "SELECT id, user_id, tier, profile_hash, content, tokens_used, cost_usd, created_at, updated_at FROM hd_reports WHERE user_id = ? AND tier = ?",
    args: [userId, tier],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    tier: row.tier as string,
    profile_hash: row.profile_hash as string,
    content: row.content as string,
    tokens_used: row.tokens_used as number,
    cost_usd: row.cost_usd as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getReportById(
  id: string,
): Promise<{ id: string; user_id: string; tier: string; content: string } | undefined> {
  const result = await client.execute({
    sql: "SELECT id, user_id, tier, content FROM hd_reports WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    tier: row.tier as string,
    content: row.content as string,
  };
}

export async function saveReport(report: {
  id: string;
  userId: string;
  tier: string;
  profileHash: string;
  content: string;
  tokensUsed: number;
  costUsd: number;
}): Promise<string> {
  const existing = await client.execute({
    sql: "SELECT id FROM hd_reports WHERE user_id = ? AND tier = ?",
    args: [report.userId, report.tier],
  });
  if (existing.rows.length > 0) {
    const existingId = existing.rows[0].id as string;
    await client.execute({
      sql: `UPDATE hd_reports SET profile_hash = ?, content = ?, tokens_used = ?, cost_usd = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [report.profileHash, report.content, report.tokensUsed, report.costUsd, existingId],
    });
    return existingId;
  }
  await client.execute({
    sql: `INSERT INTO hd_reports (id, user_id, tier, profile_hash, content, tokens_used, cost_usd, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [report.id, report.userId, report.tier, report.profileHash, report.content, report.tokensUsed, report.costUsd],
  });
  return report.id;
}

export async function updateReportContent(id: string, content: string): Promise<void> {
  await client.execute({
    sql: "UPDATE hd_reports SET content = ?, updated_at = datetime('now') WHERE id = ?",
    args: [content, id],
  });
}

export async function listUserReportTiers(
  userId: string,
): Promise<Array<ReportTier>> {
  const result = await client.execute({
    sql: `
      SELECT tier
      FROM hd_reports
      WHERE user_id = ?
      ORDER BY CASE tier WHEN 'free' THEN 0 ELSE 1 END, datetime(created_at) ASC
    `,
    args: [userId],
  });

  return result.rows.map((row) => row.tier as ReportTier);
}

// ─── Report Shares ───────────────────────────────────────────────────────────

export async function createShareToken(
  userId: string,
  reportId: string,
  expiryDays: number = 7,
): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
  await client.execute({
    sql: "INSERT INTO report_shares (token, user_id, report_id, expires_at) VALUES (?, ?, ?, ?)",
    args: [token, userId, reportId, expiresAt],
  });
  return token;
}

export async function getShareByToken(
  token: string,
): Promise<{ token: string; user_id: string; report_id: string; expires_at: string } | undefined> {
  const result = await client.execute({
    sql: "SELECT token, user_id, report_id, expires_at FROM report_shares WHERE token = ?",
    args: [token],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    token: row.token as string,
    user_id: row.user_id as string,
    report_id: row.report_id as string,
    expires_at: row.expires_at as string,
  };
}

export async function cleanupExpiredShares(): Promise<number> {
  const result = await client.execute({
    sql: "DELETE FROM report_shares WHERE expires_at < datetime('now')",
    args: [],
  });
  return result.rowsAffected;
}

// ─── LLM Calls (telemetry) ───────────────────────────────────────────────────

export type LlmCallRoute = "chat" | "chat_stream" | "report" | "extraction";

export interface LlmCallInput {
  userId: string;
  route: LlmCallRoute;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  promptHash: string;
}

export async function insertLlmCall(input: LlmCallInput): Promise<void> {
  await client.execute({
    sql: `INSERT INTO llm_calls (user_id, route, model, tokens_in, tokens_out, cost_usd, latency_ms, prompt_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.userId,
      input.route,
      input.model,
      input.tokensIn,
      input.tokensOut,
      input.costUsd,
      input.latencyMs,
      input.promptHash,
    ],
  });
}

export interface LlmUsageBreakdownEntry {
  callCount: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface LlmUsageSummary {
  totalCallCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  byRoute: Array<{ route: LlmCallRoute } & LlmUsageBreakdownEntry>;
  byModel: Array<{ model: string } & LlmUsageBreakdownEntry>;
}

export async function getLlmUsageForUser(
  userId: string,
  sinceIso: string,
): Promise<LlmUsageSummary> {
  const totalsResult = await client.execute({
    sql: `SELECT
            COUNT(*)                  AS call_count,
            COALESCE(SUM(tokens_in),  0) AS tokens_in,
            COALESCE(SUM(tokens_out), 0) AS tokens_out,
            COALESCE(SUM(cost_usd),   0) AS cost_usd
          FROM llm_calls
          WHERE user_id = ? AND datetime(created_at) >= datetime(?)`,
    args: [userId, sinceIso],
  });

  const totalsRow = totalsResult.rows[0] ?? {};
  const totalCallCount = Number(totalsRow.call_count ?? 0);
  const totalTokensIn = Number(totalsRow.tokens_in ?? 0);
  const totalTokensOut = Number(totalsRow.tokens_out ?? 0);
  const totalCostUsd = Number(totalsRow.cost_usd ?? 0);

  const byRouteResult = await client.execute({
    sql: `SELECT
            route,
            COUNT(*)                  AS call_count,
            COALESCE(SUM(tokens_in),  0) AS tokens_in,
            COALESCE(SUM(tokens_out), 0) AS tokens_out,
            COALESCE(SUM(cost_usd),   0) AS cost_usd
          FROM llm_calls
          WHERE user_id = ? AND datetime(created_at) >= datetime(?)
          GROUP BY route
          ORDER BY route ASC`,
    args: [userId, sinceIso],
  });

  const byRoute = byRouteResult.rows.map((row) => ({
    route: row.route as LlmCallRoute,
    callCount: Number(row.call_count ?? 0),
    tokensIn: Number(row.tokens_in ?? 0),
    tokensOut: Number(row.tokens_out ?? 0),
    costUsd: Number(row.cost_usd ?? 0),
  }));

  const byModelResult = await client.execute({
    sql: `SELECT
            model,
            COUNT(*)                  AS call_count,
            COALESCE(SUM(tokens_in),  0) AS tokens_in,
            COALESCE(SUM(tokens_out), 0) AS tokens_out,
            COALESCE(SUM(cost_usd),   0) AS cost_usd
          FROM llm_calls
          WHERE user_id = ? AND datetime(created_at) >= datetime(?)
          GROUP BY model
          ORDER BY model ASC`,
    args: [userId, sinceIso],
  });

  const byModel = byModelResult.rows.map((row) => ({
    model: row.model as string,
    callCount: Number(row.call_count ?? 0),
    tokensIn: Number(row.tokens_in ?? 0),
    tokensOut: Number(row.tokens_out ?? 0),
    costUsd: Number(row.cost_usd ?? 0),
  }));

  return { totalCallCount, totalTokensIn, totalTokensOut, totalCostUsd, byRoute, byModel };
}

// ─── Message Feedback ────────────────────────────────────────────────────────

export type FeedbackThumb = "up" | "down";

export async function setMessageFeedback(
  messageId: number,
  userId: string,
  thumb: FeedbackThumb,
  note?: string | null,
): Promise<boolean> {
  const result = await client.execute({
    sql: `UPDATE chat_messages
            SET feedback_thumb = ?,
                feedback_note  = ?,
                feedback_at    = datetime('now')
          WHERE id      = ?
            AND user_id = ?
            AND role    = 'assistant'`,
    args: [thumb, note ?? null, messageId, userId],
  });
  return result.rowsAffected > 0;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getISOWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
