/**
 * SQLite Database Layer
 *
 * Uses @libsql/client for async SQLite access (local file or Turso remote).
 * Tables: users, assets, transit_cache, chat_messages
 */

import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";

let client: Client;

// ─── Init ────────────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./astral.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  client = createClient({ url, ...(authToken && { authToken }) });

  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        profile    TEXT NOT NULL,
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
    ],
    "write",
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function createUser(name: string, profile: object): Promise<string> {
  const id = randomUUID();
  await client.execute({
    sql: "INSERT INTO users (id, name, profile) VALUES (?, ?, ?)",
    args: [id, name, JSON.stringify(profile)],
  });
  return id;
}

export async function getUser(
  id: string,
): Promise<{ id: string; name: string; profile: object; created_at: string; updated_at: string } | undefined> {
  const result = await client.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id as string,
    name: row.name as string,
    profile: JSON.parse(row.profile as string),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function updateUser(id: string, name: string, profile: object): Promise<boolean> {
  const result = await client.execute({
    sql: "UPDATE users SET name = ?, profile = ?, updated_at = datetime('now') WHERE id = ?",
    args: [name, JSON.stringify(profile), id],
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

export async function saveChatMessage(userId: string, role: string, content: string): Promise<void> {
  await client.execute({
    sql: "INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)",
    args: [userId, role, content],
  });
}

export async function getChatMessages(
  userId: string,
): Promise<Array<{ role: string; content: string; created_at: string }>> {
  const result = await client.execute({
    sql: "SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id ASC",
    args: [userId],
  });
  return result.rows.map((row) => ({
    role: row.role as string,
    content: row.content as string,
    created_at: row.created_at as string,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getISOWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
