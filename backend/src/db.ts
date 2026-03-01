/**
 * SQLite Database Layer
 *
 * Uses better-sqlite3 for synchronous, fast SQLite access.
 * Tables: users, assets, transit_cache, chat_messages
 */

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";

let db: Database.Database;

// ─── Init ────────────────────────────────────────────────────────────────────

export function initDb(): void {
  const dbPath =
    process.env.NODE_ENV === "production"
      ? "/data/astral.db"
      : path.resolve("astral.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      profile    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      mime_type  TEXT NOT NULL,
      file_type  TEXT NOT NULL,
      data       BLOB NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transit_cache (
      week_key   TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role       TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function createUser(name: string, profile: object): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO users (id, name, profile) VALUES (?, ?, ?)",
  ).run(id, name, JSON.stringify(profile));
  return id;
}

export function getUser(id: string): { id: string; name: string; profile: object; created_at: string; updated_at: string } | undefined {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | { id: string; name: string; profile: string; created_at: string; updated_at: string }
    | undefined;
  if (!row) return undefined;
  return { ...row, profile: JSON.parse(row.profile) };
}

export function updateUser(id: string, name: string, profile: object): boolean {
  const result = db.prepare(
    "UPDATE users SET name = ?, profile = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(name, JSON.stringify(profile), id);
  return result.changes > 0;
}

export function deleteUser(id: string): boolean {
  const result = db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return result.changes > 0;
}

// ─── Assets ──────────────────────────────────────────────────────────────────

export function createAsset(
  userId: string,
  filename: string,
  mimeType: string,
  fileType: string,
  data: Buffer,
): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO assets (id, user_id, filename, mime_type, file_type, data, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, userId, filename, mimeType, fileType, data, data.length);
  return id;
}

export function getUserAssets(
  userId: string,
): Array<{ id: string; filename: string; mime_type: string; file_type: string; size_bytes: number; created_at: string }> {
  return db
    .prepare("SELECT id, filename, mime_type, file_type, size_bytes, created_at FROM assets WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Array<{ id: string; filename: string; mime_type: string; file_type: string; size_bytes: number; created_at: string }>;
}

export function getAsset(
  id: string,
): { id: string; user_id: string; filename: string; mime_type: string; file_type: string; data: Buffer; size_bytes: number; created_at: string } | undefined {
  return db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | { id: string; user_id: string; filename: string; mime_type: string; file_type: string; data: Buffer; size_bytes: number; created_at: string }
    | undefined;
}

export function deleteAsset(id: string): boolean {
  const result = db.prepare("DELETE FROM assets WHERE id = ?").run(id);
  return result.changes > 0;
}

// ─── Transit Cache ───────────────────────────────────────────────────────────

export function getCachedTransits(weekKey: string): object | undefined {
  const row = db.prepare("SELECT data FROM transit_cache WHERE week_key = ?").get(weekKey) as
    | { data: string }
    | undefined;
  if (!row) return undefined;
  return JSON.parse(row.data);
}

export function setCachedTransits(weekKey: string, data: object): void {
  db.prepare(
    "INSERT OR REPLACE INTO transit_cache (week_key, data, created_at) VALUES (?, ?, datetime('now'))",
  ).run(weekKey, JSON.stringify(data));
}

// ─── Chat Messages ───────────────────────────────────────────────────────────

export function saveChatMessage(userId: string, role: string, content: string): void {
  db.prepare(
    "INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)",
  ).run(userId, role, content);
}

export function getChatMessages(
  userId: string,
): Array<{ role: string; content: string; created_at: string }> {
  return db
    .prepare("SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id ASC")
    .all(userId) as Array<{ role: string; content: string; created_at: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getISOWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
