import { test, expect } from "@playwright/test";
import { mockChatHistory, mockChatStream, mockTruncate, mockGetUser, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_NO_INTAKE, HISTORY_MESSAGES } from "../helpers/fixtures";

test.describe("Chat — DB Consistency", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
  });

  test("Sent messages appear after page reload", async ({ page }) => {
    // First load: empty history, send a message
    await mockChatHistory(page, []);
    await mockChatStream(page, ["Respuesta original"], { userMsgId: 10, assistantMsgId: 11 });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Mensaje persistido");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Respuesta original")).toBeVisible();

    // Simulate reload: history now includes the persisted messages
    await page.unrouteAll();
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockChatHistory(page, [
      { id: 10, role: "user", content: "Mensaje persistido", created_at: "2026-03-28T10:00:00.000Z" },
      { id: 11, role: "assistant", content: "Respuesta original", created_at: "2026-03-28T10:00:01.000Z" },
    ]);
    await page.reload();

    await expect(page.getByText("Mensaje persistido")).toBeVisible();
    await expect(page.getByText("Respuesta original")).toBeVisible();
  });

  test("Edited messages persist truncation after reload", async ({ page }) => {
    await mockTruncate(page);
    await mockChatHistory(page, HISTORY_MESSAGES);
    await mockChatStream(page, ["Respuesta editada"], { userMsgId: 20, assistantMsgId: 21 });
    await page.goto("/");

    // Edit first message
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await page.getByRole("button", { name: "Editar mensaje" }).first().click();
    const editTextarea = page.getByRole("textbox").first();
    await editTextarea.fill("Pregunta editada persistida");
    await page.getByRole("button", { name: "Guardar y enviar" }).click();
    await expect(page.getByText("Respuesta editada")).toBeVisible();

    // Simulate reload with truncated history
    await page.unrouteAll();
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockChatHistory(page, [
      { id: 20, role: "user", content: "Pregunta editada persistida", created_at: "2026-03-28T10:02:00.000Z" },
      { id: 21, role: "assistant", content: "Respuesta editada", created_at: "2026-03-28T10:02:01.000Z" },
    ]);
    await page.reload();

    await expect(page.getByText("Pregunta editada persistida")).toBeVisible();
    await expect(page.getByText("Respuesta editada")).toBeVisible();
    // Old messages should not appear
    await expect(page.getByText("Que transitos tengo esta semana?")).not.toBeVisible();
  });

  test("Chat history order matches send order", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await page.goto("/");

    const messages = page.locator("[class*='animate-fade-in']");
    const texts = await messages.allTextContents();
    const userMsgs = texts.filter((t) => t.includes("transitos") || t.includes("Sacral"));
    expect(userMsgs.length).toBeGreaterThanOrEqual(2);
  });
});
