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

async function readErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const data = await res.json() as { error?: string };
      if (typeof data?.error === "string") return data.error;
      return JSON.stringify(data);
    } catch {
      return `Request failed (${res.status})`;
    }
  }

  const text = await res.text();
  return text || `Request failed (${res.status})`;
}

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
    if (res.status === 403) {
      const data = await res.json() as { error?: string; used?: number; limit?: number };
      if (data.error === "message_limit_reached") {
        const err = new Error("message_limit_reached") as Error & { used: number; limit: number };
        err.used = data.used ?? 0;
        err.limit = data.limit ?? 15;
        throw err;
      }
    }
    const err = await res.text();
    throw new Error(`Backend error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function sendChatStream(
  userId: string,
  messages: ChatMessage[],
  onChunk: (accumulated: string) => void,
): Promise<{ transits_used: string }> {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, messages }),
  });

  if (!res.ok) {
    if (res.status === 403) {
      const data = await res.json() as { error?: string; used?: number; limit?: number };
      if (data.error === "message_limit_reached") {
        const err = new Error("message_limit_reached") as Error & { used: number; limit: number };
        err.used = data.used ?? 0;
        err.limit = data.limit ?? 15;
        throw err;
      }
    }
    const err = await res.text();
    throw new Error(`Backend error ${res.status}: ${err}`);
  }

  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let transitsUsed = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmed.slice(6)) as {
          content?: string;
          done?: boolean;
          transits_used?: string;
          error?: string;
        };

        if (data.error) throw new Error(data.error);

        if (data.done) {
          transitsUsed = data.transits_used ?? "";
        } else if (data.content) {
          accumulated += data.content;
          onChunk(accumulated);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "") throw e;
      }
    }
  }

  return { transits_used: transitsUsed };
}

export async function getChatHistory(
  userId: string,
): Promise<{ messages: Array<{ role: string; content: string; created_at: string }>; used: number; limit: number }> {
  const res = await fetch(`${BASE}/users/${userId}/messages`);
  if (!res.ok) throw new Error(`Chat history error ${res.status}`);
  return res.json();
}

// ─── Transits ────────────────────────────────────────────────────────────────

export async function fetchTransits(userId?: string): Promise<TransitsResponse> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clientNow = Date.now();
  const search = new URLSearchParams();
  if (userId) search.set("userId", userId);
  if (timeZone) search.set("timeZone", timeZone);
  search.set("clientNow", String(clientNow));
  const params = search.toString() ? `?${search.toString()}` : "";
  const res = await fetch(`${BASE}/transits${params}`);
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
    const err = await readErrorMessage(res);
    throw new Error(err);
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

// ─── Transcription ───────────────────────────────────────────────────────────

export async function transcribeAudio(
  blob: Blob,
  filename = "voice.webm",
): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append("file", blob, filename);

  const res = await fetch(`${BASE}/transcribe`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(err);
  }
  return res.json();
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
    const err = await readErrorMessage(res);
    throw new Error(err);
  }
  return res.json();
}
