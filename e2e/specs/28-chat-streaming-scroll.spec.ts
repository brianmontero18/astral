import { test, expect, Page } from "@playwright/test";
import { mockChatHistory, mockGetUser, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_NO_INTAKE } from "../helpers/fixtures";

const LONG_HISTORY = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  role: i % 2 === 0 ? "user" : "assistant",
  content:
    i % 2 === 0
      ? `Pregunta número ${i + 1} sobre mis tránsitos y energía sacral.`
      : `Respuesta detallada número ${i + 1}. Tu energía esta semana se mueve por canales específicos que vale la pena observar con detenimiento. ${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6)}`,
  created_at: `2026-04-01T10:${String(i).padStart(2, "0")}:00.000Z`,
}));

const STREAM_CHUNKS = Array.from({ length: 20 }, (_, i) => `chunk-${i} `);

async function mockSlowStream(page: Page) {
  await page.route("**/api/chat/stream", async (route) => {
    const body =
      STREAM_CHUNKS.map((c) => `data: ${JSON.stringify({ content: c })}\n\n`).join("") +
      `data: ${JSON.stringify({ done: true, transits_used: "2026-03-28T00:00:00.000Z", userMsgId: 999, assistantMsgId: 1000 })}\n\n`;
    await new Promise((r) => setTimeout(r, 500));
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body,
    });
  });
}

async function waitForChatReady(page: Page) {
  await page.locator(".chat-main").waitFor({ state: "attached" });
  // Last message in history is "Respuesta detallada número 30" — unique anchor
  await expect(page.locator(".chat-bubble-user").last()).toBeVisible();
}

async function scrollMainTo(page: Page, top: number) {
  await page.evaluate((target) => {
    const el = document.querySelector(".chat-main") as HTMLElement | null;
    if (!el) throw new Error(".chat-main not found");
    el.scrollTop = target;
    el.dispatchEvent(new Event("scroll"));
  }, top);
}

async function getMainScroll(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector(".chat-main") as HTMLElement | null;
    if (!el) return null;
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      distanceFromBottom: el.scrollHeight - el.scrollTop - el.clientHeight,
    };
  });
}

test.describe("Chat — Streaming scroll respects user", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockChatHistory(page, LONG_HISTORY);
  });

  test("Does not force scroll to bottom while user scrolled up during streaming", async ({ page }) => {
    await mockSlowStream(page);
    await page.goto("/");
    await waitForChatReady(page);

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Nueva pregunta");
    await page.getByRole("button", { name: "Enviar" }).click();

    // Immediately scroll back up while streaming is about to start
    await scrollMainTo(page, 0);

    // Let streaming complete
    await expect(page.getByText("chunk-19")).toBeAttached();
    await page.waitForTimeout(300);

    const after = await getMainScroll(page);
    expect(after).not.toBeNull();
    expect(after!.distanceFromBottom).toBeGreaterThan(100);
  });

  test("Sending a user message forces scroll to bottom even if scrolled up", async ({ page }) => {
    await mockSlowStream(page);
    await page.goto("/");
    await waitForChatReady(page);

    await scrollMainTo(page, 0);

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Forzá el scroll");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("Forzá el scroll")).toBeVisible();

    await page.waitForFunction(() => {
      const el = document.querySelector(".chat-main") as HTMLElement | null;
      if (!el) return false;
      return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    });
  });

  test("Jump-to-bottom button appears when scrolled up and restores auto-scroll on click", async ({ page }) => {
    await page.goto("/");
    await waitForChatReady(page);

    const button = page.getByRole("button", { name: "Ir al final del chat" });
    await expect(button).not.toBeVisible();

    await scrollMainTo(page, 0);
    await expect(button).toBeVisible();

    await button.click();
    await expect(button).not.toBeVisible();

    const after = await getMainScroll(page);
    expect(after!.distanceFromBottom).toBeLessThan(100);
  });
});
