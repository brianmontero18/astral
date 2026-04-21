import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";

import { getCurrentChatUsageCycle } from "./chat-limits.js";
import type { ReportTier } from "./report/types.js";

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
        profile    TEXT NOT NULL,
        intake     TEXT DEFAULT NULL,
        plan       TEXT NOT NULL DEFAULT 'free',
        role       TEXT NOT NULL DEFAULT 'user',
        status     TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS assets (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename   TEXT NOT NULL,
        mime_type  TEXT NOT NULL,
        file_type  TEXT NOT NULL,
        data       BLOB NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS transit_cache (
        week_key   TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role       TEXT NOT NULL,
        content    TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  // Add intake column to existing DBs (idempotent)
  try {
    await client.execute("ALTER TABLE users ADD COLUMN intake TEXT DEFAULT NULL");
  } catch {
    // Column already exists
  }

  try {
    await client.execute("ALTER TABLE users ADD COLUMN email TEXT DEFAULT NULL");
  } catch {
    // Column already exists
  }

  try {
    await client.execute("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
  } catch {
    // Column already exists
  }

  try {
    await client.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  } catch {
    // Column already exists
  }

  try {
    await client.execute("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  } catch {
    // Column already exists
  }
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
  await client.execute({
    sql: "INSERT INTO assets (id, user_id, filename, mime_type, file_type, data, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [id, userId, filename, mimeType, fileType, data, data.length],
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
): Promise<{ id: string; user_id: string; filename: string; mime_type: string; file_type: string; data: Buffer; size_bytes: number; created_at: string } | undefined> {
  const result = await client.execute({
    sql: "SELECT * FROM assets WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    filename: row.filename as string,
    mime_type: row.mime_type as string,
    file_type: row.file_type as string,
    data: Buffer.from(row.data as ArrayBuffer),
    size_bytes: row.size_bytes as number,
    created_at: row.created_at as string,
  };
}

export async function deleteAsset(id: string): Promise<boolean> {
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
): Promise<{ id: string; user_id: string; tier: string; profile_hash: string; content: string; tokens_used: number; cost_usd: number; created_at: string } | undefined> {
  const result = await client.execute({
    sql: "SELECT id, user_id, tier, profile_hash, content, tokens_used, cost_usd, created_at FROM hd_reports WHERE user_id = ? AND tier = ?",
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
      sql: `UPDATE hd_reports SET profile_hash = ?, content = ?, tokens_used = ?, cost_usd = ?, created_at = datetime('now') WHERE id = ?`,
      args: [report.profileHash, report.content, report.tokensUsed, report.costUsd, existingId],
    });
    return existingId;
  }
  await client.execute({
    sql: `INSERT INTO hd_reports (id, user_id, tier, profile_hash, content, tokens_used, cost_usd, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [report.id, report.userId, report.tier, report.profileHash, report.content, report.tokensUsed, report.costUsd],
  });
  return report.id;
}

export async function updateReportContent(id: string, content: string): Promise<void> {
  await client.execute({
    sql: "UPDATE hd_reports SET content = ? WHERE id = ?",
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getISOWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
