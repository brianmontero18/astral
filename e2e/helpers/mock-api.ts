import { Page } from "@playwright/test";
import type { AssetMeta, DesignReport } from "../../frontend/src/types";

type MockUsageSnapshot = {
  plan?: "free" | "basic" | "premium";
  used?: number;
  limit?: number | null;
  cycle?: string;
  resetsAt?: string;
};

const DEFAULT_USAGE: Required<MockUsageSnapshot> = {
  plan: "free",
  used: 0,
  limit: 20,
  cycle: "2026-04",
  resetsAt: "2026-05-01T00:00:00-03:00",
};

function buildUsageSnapshot(
  usage?: MockUsageSnapshot,
  messages?: Array<{ role: string }>,
) {
  return {
    plan: usage?.plan ?? DEFAULT_USAGE.plan,
    used: usage?.used ?? messages?.filter((message) => message.role === "user").length ?? DEFAULT_USAGE.used,
    limit: usage?.limit ?? DEFAULT_USAGE.limit,
    cycle: usage?.cycle ?? DEFAULT_USAGE.cycle,
    resetsAt: usage?.resetsAt ?? DEFAULT_USAGE.resetsAt,
  };
}

function isExactPath(url: string, pathname: string) {
  return new URL(url).pathname === pathname;
}

export async function mockChatStream(
  page: Page,
  chunks: string[],
  ids?: { userMsgId: number; assistantMsgId: number },
) {
  await page.route("**/api/chat/stream", async (route) => {
    const body =
      chunks.map((c) => `data: ${JSON.stringify({ content: c })}\n\n`).join("") +
      `data: ${JSON.stringify({ done: true, transits_used: "2026-03-28T00:00:00.000Z", ...ids })}\n\n`;
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body,
    });
  });
}

export async function mockChatFallback(page: Page, reply: string, ids?: { userMsgId: number; assistantMsgId: number }) {
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        json: { reply, transits_used: "2026-03-28T00:00:00.000Z", ...ids },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockChatStreamError(page: Page) {
  await page.route("**/api/chat/stream", async (route) => {
    await route.abort("connectionfailed");
  });
}

export async function mockChatHistory(
  page: Page,
  messages: Array<{ id: number; role: string; content: string; created_at: string }>,
  usage?: MockUsageSnapshot,
) {
  await page.route("**/api/me/messages**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        json: {
          messages,
          ...buildUsageSnapshot(usage, messages),
        },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockTruncate(page: Page, usage?: number | MockUsageSnapshot) {
  const snapshot = typeof usage === "number"
    ? buildUsageSnapshot({ used: usage })
    : buildUsageSnapshot(usage ?? { used: 1 });

  await page.route("**/api/me/messages**", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        json: {
          deleted: 1,
          ...snapshot,
        },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockTranscribe(page: Page, text: string) {
  await page.route("**/api/transcribe", async (route) => {
    await route.fulfill({ status: 200, json: { text } });
  });
}

export async function mockTranscribeError(page: Page) {
  await page.route("**/api/transcribe", async (route) => {
    await route.fulfill({ status: 500, json: { error: "Transcription failed" } });
  });
}

export async function mockGetUser(
  page: Page,
  user: { id: string; name: string; profile: unknown; intake: unknown },
) {
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me")) {
      await route.fulfill({ status: 200, json: user });
    } else {
      await route.fallback();
    }
  });
}

export async function mockUpdateUser(page: Page) {
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "PUT" && isExactPath(route.request().url(), "/api/me")) {
      await route.fulfill({ status: 200, json: { ok: true } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockUpdateUserError(page: Page) {
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "PUT" && isExactPath(route.request().url(), "/api/me")) {
      await route.fulfill({ status: 500, json: { error: "Internal error" } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockGetReport(page: Page, report: DesignReport | null) {
  await page.route("**/api/me/report**", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me/report")) {
      if (report) {
        await route.fulfill({ status: 200, json: report });
      } else {
        await route.fulfill({ status: 404, json: { error: "No report found" } });
      }
    } else {
      await route.fallback();
    }
  });
}

export async function mockGenerateReport(page: Page, report: DesignReport) {
  await page.route("**/api/me/report", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/report")) {
      await route.fulfill({ status: 200, json: report });
    } else {
      await route.fallback();
    }
  });
}

export async function mockGenerateReportError(page: Page, status = 500) {
  await page.route("**/api/me/report", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/report")) {
      await route.fulfill({ status, json: { error: "Generation failed" } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockUploadAsset(page: Page, asset: Partial<AssetMeta> = {}) {
  await page.route("**/api/me/assets", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/assets")) {
      await route.fulfill({
        status: 200,
        json: {
          id: asset.id ?? "asset-123",
          filename: asset.filename ?? "chart.pdf",
          mimeType: asset.mimeType ?? "application/pdf",
          fileType: asset.fileType ?? "hd",
          sizeBytes: asset.sizeBytes ?? 1024,
          createdAt: asset.createdAt ?? "2026-03-28T09:00:00.000Z",
        },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockShareReport(page: Page, url = "http://localhost:3000/api/report/shared/abc") {
  await page.route("**/api/me/report/share", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/report/share")) {
      await route.fulfill({ status: 200, json: { token: "abc", url } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockShareReportError(page: Page) {
  await page.route("**/api/me/report/share", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/me/report/share")) {
      await route.fulfill({ status: 500, json: { error: "Share failed" } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockChatStreamLimit(
  page: Page,
  used: number,
  limit: number,
  usage?: Omit<MockUsageSnapshot, "used" | "limit">,
) {
  const snapshot = buildUsageSnapshot({ ...usage, used, limit });

  await page.route("**/api/chat/stream", async (route) => {
    await route.fulfill({
      status: 403,
      json: { error: "message_limit_reached", ...snapshot },
    });
  });
}

export async function mockHealth(page: Page) {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({ status: 200, json: { status: "ok" } });
  });
}

export async function mockTransits(page: Page) {
  await page.route("**/api/transits**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        fetchedAt: "2026-03-28T00:00:00.000Z",
        weekRange: "Mar 28 – Apr 3, 2026",
        planets: [],
        activatedChannels: [],
      },
    });
  });
}

export async function mockTransitsError(
  page: Page,
  status = 500,
  error = "Internal error",
) {
  await page.route("**/api/transits**", async (route) => {
    await route.fulfill({
      status,
      json: { error },
    });
  });
}

export async function mockGetAssets(page: Page, assets: AssetMeta[]) {
  await page.route("**/api/me/assets", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me/assets")) {
      await route.fulfill({
        status: 200,
        json: { assets },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockExtractProfile(page: Page, profile: unknown) {
  await page.route("**/api/extract-profile", async (route) => {
    if (route.request().method() === "POST" && isExactPath(route.request().url(), "/api/extract-profile")) {
      await route.fulfill({ status: 200, json: { profile } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockGetAssetsError(
  page: Page,
  status = 500,
  error = "Internal error",
) {
  await page.route("**/api/me/assets", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me/assets")) {
      await route.fulfill({
        status,
        json: { error },
      });
    } else {
      await route.fallback();
    }
  });
}
