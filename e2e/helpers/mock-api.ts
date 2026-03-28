import { Page } from "@playwright/test";
import type { DesignReport } from "../../frontend/src/types";

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
  usage?: { used: number; limit: number },
) {
  await page.route("**/api/users/*/messages**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        json: { messages, used: usage?.used ?? messages.filter((m) => m.role === "user").length, limit: usage?.limit ?? 15 },
      });
    } else {
      await route.fallback();
    }
  });
}

export async function mockTruncate(page: Page, resultUsed?: number) {
  await page.route("**/api/users/*/messages**", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 200, json: { deleted: 1, used: resultUsed ?? 1, limit: 15 } });
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
  await page.route("**/api/users/*", async (route) => {
    const url = route.request().url();
    if (
      route.request().method() === "GET" &&
      !url.includes("/report") &&
      !url.includes("/messages") &&
      !url.includes("/assets")
    ) {
      await route.fulfill({ status: 200, json: user });
    } else {
      await route.fallback();
    }
  });
}

export async function mockUpdateUser(page: Page) {
  await page.route("**/api/users/*", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 200, json: { ok: true } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockUpdateUserError(page: Page) {
  await page.route("**/api/users/*", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 500, json: { error: "Internal error" } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockGetReport(page: Page, report: DesignReport | null) {
  await page.route("**/api/users/*/report?*", async (route) => {
    if (route.request().method() === "GET") {
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
  await page.route("**/api/users/*/report", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 200, json: report });
    } else {
      await route.fallback();
    }
  });
}

export async function mockGenerateReportError(page: Page, status = 500) {
  await page.route("**/api/users/*/report", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status, json: { error: "Generation failed" } });
    } else {
      await route.fallback();
    }
  });
}

export async function mockShareReport(page: Page, url = "http://localhost:3000/api/report/shared/abc") {
  await page.route("**/api/users/*/report/share", async (route) => {
    await route.fulfill({ status: 200, json: { token: "abc", url } });
  });
}

export async function mockShareReportError(page: Page) {
  await page.route("**/api/users/*/report/share", async (route) => {
    await route.fulfill({ status: 500, json: { error: "Share failed" } });
  });
}

export async function mockChatStreamLimit(page: Page, used: number, limit: number) {
  await page.route("**/api/chat/stream", async (route) => {
    await route.fulfill({
      status: 403,
      json: { error: "message_limit_reached", used, limit },
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
