/**
 * API Client
 *
 * Todas las llamadas al backend centralizadas acá.
 * En dev, Vite proxea /api → http://localhost:3000/api
 * En prod, el mismo Fastify sirve todo.
 */

import type {
  AdminInviteRequest,
  AdminInviteSendFailure,
  AdminInviteSuccess,
  AdminUserAccessPatch,
  AdminUserDetail,
  AdminUserListResponse,
  AdminUserLlmUsage,
  AppUserStatus,
  ChatMessage,
  ChatResponse,
  TransitsResponse,
  UserProfile,
  AssetMeta,
  Intake,
  DesignReport,
} from "./types";
import type { ChatUsageSnapshot } from "./chat-limits";

const BASE = "/api";

interface ChatLimitResponse extends Partial<ChatUsageSnapshot> {
  error?: string;
}

function buildMessageLimitError(data: ChatLimitResponse) {
  const err = new Error("message_limit_reached") as Error & ChatUsageSnapshot;
  err.plan = data.plan ?? "free";
  err.used = data.used ?? 0;
  err.limit = data.limit ?? null;
  err.cycle = data.cycle ?? "";
  err.resetsAt = data.resetsAt ?? "";
  return err;
}

export interface CurrentUserResponse {
  id: string;
  name: string;
  profile: UserProfile;
  intake: Intake | null;
  plan: "free" | "basic" | "premium";
  role: "user" | "admin";
  status: AppUserStatus;
  onboardingStatus: "pending" | "complete";
  onboardingStep: "name" | "upload" | "review" | "intake" | null;
  accessSource: "self" | "manual" | "payment";
}

export interface OnboardingPatchInput {
  step?: "name" | "upload" | "review" | "intake" | null;
  name?: string;
  profile?: UserProfile;
  intake?: Intake;
  complete?: boolean;
}

export async function patchOnboarding(
  input: OnboardingPatchInput,
): Promise<void> {
  const res = await fetch(`${BASE}/me/onboarding`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(`Onboarding patch error ${res.status}: ${message}`);
  }
}

export type CurrentUserBootstrapResult =
  | { kind: "linked"; user: CurrentUserResponse }
  | { kind: "anonymous" }
  | { kind: "inactive"; status: AppUserStatus }
  | { kind: "unlinked"; provider: string; subject: string };

async function readJsonBody<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await res.json() as T;
  } catch {
    return null;
  }
}

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
  messages: ChatMessage[],
  profile?: UserProfile,
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile ? { profile, messages } : { messages }),
  });
  if (!res.ok) {
    if (res.status === 403) {
      const data = await res.json() as ChatLimitResponse;
      if (data.error === "message_limit_reached") {
        throw buildMessageLimitError(data);
      }
    }
    const err = await res.text();
    throw new Error(`Backend error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function sendChatStream(
  messages: ChatMessage[],
  onChunk: (accumulated: string) => void,
  profile?: UserProfile,
): Promise<{ transits_used: string; userMsgId?: number; assistantMsgId?: number }> {
  const res = await fetch(`${BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile ? { profile, messages } : { messages }),
  });

  if (!res.ok) {
    if (res.status === 403) {
      const data = await res.json() as ChatLimitResponse;
      if (data.error === "message_limit_reached") {
        throw buildMessageLimitError(data);
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
  let userMsgId: number | undefined;
  let assistantMsgId: number | undefined;

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
          userMsgId?: number;
          assistantMsgId?: number;
          error?: string;
        };

        if (data.error) throw new Error(data.error);

        if (data.done) {
          transitsUsed = data.transits_used ?? "";
          userMsgId = data.userMsgId;
          assistantMsgId = data.assistantMsgId;
        } else if (data.content) {
          accumulated += data.content;
          onChunk(accumulated);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "") throw e;
      }
    }
  }

  return { transits_used: transitsUsed, userMsgId, assistantMsgId };
}

export async function getChatHistory(
): Promise<{
  messages: Array<{ id: number; role: string; content: string; created_at: string }>;
} & ChatUsageSnapshot> {
  const res = await fetch(`${BASE}/me/messages`);
  if (!res.ok) throw new Error(`Chat history error ${res.status}`);
  return res.json();
}

export async function truncateChatHistory(
  fromId: number,
): Promise<{ deleted: number } & ChatUsageSnapshot> {
  const res = await fetch(`${BASE}/me/messages?fromId=${fromId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Truncate error ${res.status}`);
  return res.json();
}

export async function submitMessageFeedback(
  messageId: number,
  thumb: "up" | "down",
  note?: string,
): Promise<void> {
  const res = await fetch(`${BASE}/messages/${messageId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thumb, ...(note !== undefined && { note }) }),
  });
  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(`Feedback error ${res.status}: ${err}`);
  }
}

// ─── Transits ────────────────────────────────────────────────────────────────

export async function fetchTransits(): Promise<TransitsResponse> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clientNow = Date.now();
  const search = new URLSearchParams();
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

export async function bootstrapCurrentUser(
  name: string,
  profile: UserProfile,
): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, profile }),
  });

  if (res.status === 409) {
    const data = await readJsonBody<{ error?: string; userId?: string }>(res);
    if (data?.error === "identity_already_linked" && data.userId) {
      return { id: data.userId };
    }
  }

  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(`Bootstrap current user error ${res.status}: ${err}`);
  }

  return res.json();
}

export async function getCurrentUser(): Promise<CurrentUserBootstrapResult> {
  const res = await fetch(`${BASE}/me`);

  if (res.status === 401) {
    return { kind: "anonymous" };
  }

  if (res.status === 409) {
    const data = await readJsonBody<{
      error?: string;
      provider?: string;
      subject?: string;
    }>(res);

    if (data?.error === "identity_not_linked") {
      return {
        kind: "unlinked",
        provider: data.provider ?? "supertokens",
        subject: data.subject ?? "",
      };
    }

    throw new Error(`Get current user error ${res.status}: ${data?.error ?? "identity_not_linked"}`);
  }

  if (res.status === 403) {
    const data = await readJsonBody<{
      error?: string;
      status?: AppUserStatus;
    }>(res);

    if (data?.error === "account_inactive" && data.status) {
      return {
        kind: "inactive",
        status: data.status,
      };
    }
  }

  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(`Get current user error ${res.status}: ${err}`);
  }

  return {
    kind: "linked",
    user: await res.json() as CurrentUserResponse,
  };
}

export async function updateCurrentUser(
  name: string,
  profile: UserProfile,
  intake?: Intake,
): Promise<void> {
  const res = await fetch(`${BASE}/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, profile, ...(intake !== undefined && { intake }) }),
  });

  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(`Update current user error ${res.status}: ${err}`);
  }
}

// ─── Assets ──────────────────────────────────────────────────────────────────

export async function uploadAsset(
  file: File,
  fileType: string,
): Promise<AssetMeta> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileType", fileType);

  const res = await fetch(`${BASE}/me/assets`, {
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
): Promise<{ assets: AssetMeta[] }> {
  const res = await fetch(`${BASE}/me/assets`);
  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(err);
  }
  return res.json();
}

export async function deleteAsset(id: string): Promise<void> {
  const res = await fetch(`${BASE}/assets/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(err);
  }
}

export async function getAdminUsers({
  query,
  page,
  pageSize,
}: {
  query?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminUserListResponse> {
  const search = new URLSearchParams();

  if (query?.trim()) {
    search.set("q", query.trim());
  }

  if (typeof page === "number" && Number.isFinite(page)) {
    search.set("page", String(page));
  }

  if (typeof pageSize === "number" && Number.isFinite(pageSize)) {
    search.set("pageSize", String(pageSize));
  }

  const params = search.toString() ? `?${search.toString()}` : "";
  const res = await fetch(`${BASE}/admin/users${params}`);

  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(`Admin users error ${res.status}: ${err}`);
  }

  return await res.json() as AdminUserListResponse;
}

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail> {
  const res = await fetch(`${BASE}/users/${encodeURIComponent(userId)}`);

  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(`Admin user detail error ${res.status}: ${err}`);
  }

  return await res.json() as AdminUserDetail;
}

export async function getAdminUserLlmUsage(
  userId: string,
  days = 7,
): Promise<AdminUserLlmUsage> {
  const search = new URLSearchParams();
  if (Number.isFinite(days) && days > 0) {
    search.set("days", String(days));
  }
  const params = search.toString() ? `?${search.toString()}` : "";
  const res = await fetch(
    `${BASE}/admin/users/${encodeURIComponent(userId)}/llm-usage${params}`,
  );

  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(`Admin LLM usage error ${res.status}: ${err}`);
  }

  return await res.json() as AdminUserLlmUsage;
}

export type AdminInviteResult =
  | { kind: "ok"; data: AdminInviteSuccess }
  | { kind: "send-failed"; data: AdminInviteSendFailure };

export async function createAdminInvite(
  request: AdminInviteRequest,
): Promise<AdminInviteResult> {
  const res = await fetch(`${BASE}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (res.status === 200) {
    return { kind: "ok", data: (await res.json()) as AdminInviteSuccess };
  }

  if (res.status === 502) {
    const data = (await res.json()) as AdminInviteSendFailure;
    if (data?.error === "invite_send_failed") {
      return { kind: "send-failed", data };
    }
  }

  const message = await readErrorMessage(res);
  throw new Error(`Admin invite error ${res.status}: ${message}`);
}

export async function updateAdminUserAccess(
  userId: string,
  patch: AdminUserAccessPatch,
): Promise<void> {
  const res = await fetch(
    `${BASE}/admin/users/${encodeURIComponent(userId)}/access`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );

  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(`Admin user access update error ${res.status}: ${err}`);
  }
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

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function generateReport(
  tier: "free" | "premium" = "free",
): Promise<DesignReport> {
  const res = await fetch(`${BASE}/me/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier }),
  });
  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(err);
  }
  return res.json();
}

export async function getReport(
  tier: "free" | "premium" = "free",
): Promise<DesignReport | null> {
  const res = await fetch(`${BASE}/me/report?tier=${tier}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await readErrorMessage(res);
    throw new Error(err);
  }
  return res.json();
}

export function getReportPdfUrl(tier: "free" | "premium" = "free"): string {
  return `${BASE}/me/report/pdf?tier=${tier}`;
}

export async function shareReport(
  tier: "free" | "premium" = "free",
): Promise<{ token: string; url: string }> {
  const res = await fetch(`${BASE}/me/report/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier }),
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
