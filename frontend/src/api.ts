/**
 * API Client
 *
 * Todas las llamadas al backend centralizadas acá.
 * En dev, Vite proxea /api → http://localhost:3000/api
 * En prod, el mismo Fastify sirve todo.
 */

import type {
  ChatMessage,
  ChatResponse,
  TransitsResponse,
  UserProfile,
  AssetMeta,
} from "./types";

const BASE = "/api";

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function sendChat(
  userId: string,
  messages: ChatMessage[],
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Backend error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function getChatHistory(
  userId: string,
): Promise<{ messages: Array<{ role: string; content: string; created_at: string }> }> {
  const res = await fetch(`${BASE}/users/${userId}/messages`);
  if (!res.ok) throw new Error(`Chat history error ${res.status}`);
  return res.json();
}

// ─── Transits ────────────────────────────────────────────────────────────────

export async function fetchTransits(): Promise<TransitsResponse> {
  const res = await fetch(`${BASE}/transits`);
  if (!res.ok) throw new Error(`Transits error ${res.status}`);
  return res.json();
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function createUser(
  name: string,
  profile: UserProfile,
): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, profile }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Create user error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function getUser(
  id: string,
): Promise<{ id: string; name: string; profile: UserProfile }> {
  const res = await fetch(`${BASE}/users/${id}`);
  if (!res.ok) throw new Error(`Get user error ${res.status}`);
  return res.json();
}

export async function updateUser(
  id: string,
  name: string,
  profile: UserProfile,
): Promise<void> {
  const res = await fetch(`${BASE}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, profile }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Update user error ${res.status}: ${err}`);
  }
}

// ─── Assets ──────────────────────────────────────────────────────────────────

export async function uploadAsset(
  userId: string,
  file: File,
  fileType: string,
): Promise<AssetMeta> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileType", fileType);

  const res = await fetch(`${BASE}/users/${userId}/assets`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function getUserAssets(
  userId: string,
): Promise<{ assets: AssetMeta[] }> {
  const res = await fetch(`${BASE}/users/${userId}/assets`);
  if (!res.ok) throw new Error(`Assets error ${res.status}`);
  return res.json();
}

export async function deleteAsset(id: string): Promise<void> {
  const res = await fetch(`${BASE}/assets/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete asset error ${res.status}`);
}

// ─── Extraction ──────────────────────────────────────────────────────────────

export async function extractProfile(
  assetIds: string[],
): Promise<{ profile: UserProfile }> {
  const res = await fetch(`${BASE}/extract-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetIds }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Extraction error ${res.status}: ${err}`);
  }
  return res.json();
}
