import { test, expect } from "@playwright/test";
import { mockChatHistory, mockChatStream, mockChatStreamLimit, mockGetUser, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_NO_INTAKE, HISTORY_MESSAGES } from "../helpers/fixtures";

function buildLinkedUser(plan: "free" | "basic" | "premium") {
  return {
    ...TEST_USER_NO_INTAKE,
    plan,
    role: "user" as const,
    status: "active" as const,
  };
}

test.describe("Chat — Freemium Limits", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
  });

  test("Free user can send messages up to the limit", async ({ page }) => {
    await mockGetUser(page, buildLinkedUser("free"));
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
    await mockChatStream(page, ["Respuesta"], { userMsgId: 10, assistantMsgId: 11 });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Nuevo mensaje");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Respuesta")).toBeVisible();
  });

  test("Limit reached shows upgrade prompt", async ({ page }) => {
    await mockGetUser(page, buildLinkedUser("free"));
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 20, limit: 20 });
    await page.goto("/");

    await expect(page.getByText("Tu ventana al cosmos de este mes se ha completado")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver planes Astral ✦" })).toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
  });

  test("Chat input is replaced by upgrade CTA when limit reached", async ({ page }) => {
    await mockGetUser(page, buildLinkedUser("free"));
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 20, limit: 20 });
    await page.goto("/");

    // Input should not be visible — replaced by upgrade CTA
    await expect(page.getByPlaceholder("Preguntá al oráculo")).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Ver planes Astral ✦" })).toBeVisible();
  });

  test("Backend 403 triggers limit state", async ({ page }) => {
    await mockGetUser(page, buildLinkedUser("free"));
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 19, limit: 20 });
    await mockChatStreamLimit(page, 20, 20);
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Ultimo mensaje");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("Tu ventana al cosmos de este mes se ha completado")).toBeVisible();
  });

  test("Basic users see the current capped-state UX without losing prior history", async ({ page }) => {
    await mockGetUser(page, buildLinkedUser("basic"));
    await mockChatHistory(page, HISTORY_MESSAGES, {
      plan: "basic",
      used: 120,
      limit: 120,
    });
    await page.goto("/");

    await expect(page.getByText("Tu ventana al cosmos de este mes se ha completado")).toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Como afecta mi centro Sacral?")).toBeVisible();
    await expect(page.getByPlaceholder("Preguntá al oráculo")).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Pasarte a Premium ✦" })).toBeVisible();
  });

  test("Premium users see the capped state without upgrade CTA and without losing prior history", async ({ page }) => {
    await mockGetUser(page, buildLinkedUser("premium"));
    await mockChatHistory(page, HISTORY_MESSAGES, {
      plan: "premium",
      used: 300,
      limit: 300,
    });
    await page.goto("/");

    await expect(page.getByText("Tu cuota mensual ya está completa")).toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Como afecta mi centro Sacral?")).toBeVisible();
    await expect(page.getByPlaceholder("Preguntá al oráculo")).not.toBeVisible();
    await expect(page.getByRole("link", { name: /Premium|Astral/ })).not.toBeVisible();
  });
});
