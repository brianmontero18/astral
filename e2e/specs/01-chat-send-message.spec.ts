import { test, expect } from "@playwright/test";
import { mockChatStream, mockChatStreamError, mockChatFallback, mockChatHistory, mockGetUser, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_NO_INTAKE, HISTORY_MESSAGES, AGENT_RESPONSE_CHUNKS } from "../helpers/fixtures";

test.describe("Chat — Send Message", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
  });

  test("User types a message and sees the assistant reply", async ({ page }) => {
    await mockChatHistory(page, []);
    await mockChatStream(page, AGENT_RESPONSE_CHUNKS, { userMsgId: 10, assistantMsgId: 11 });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Hola, qué tránsitos tengo?");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("34-57...")).toBeVisible();
  });

  test("Empty messages are not sent", async ({ page }) => {
    await mockChatHistory(page, []);
    await page.goto("/");

    const sendBtn = page.getByRole("button", { name: "Enviar" });
    await expect(sendBtn).toBeDisabled();
  });

  test("Input clears after sending", async ({ page }) => {
    await mockChatHistory(page, []);
    await mockChatStream(page, AGENT_RESPONSE_CHUNKS, { userMsgId: 10, assistantMsgId: 11 });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Test message");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(input).toHaveValue("");
  });

  test("Previous messages load from history", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await page.goto("/");

    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Esta semana el Sol transita por tu Puerta 41...")).toBeVisible();
  });

  test("User message appears immediately while waiting for response", async ({ page }) => {
    await mockChatHistory(page, []);
    // Delay the SSE response
    await page.route("**/api/chat/stream", async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      const body =
        AGENT_RESPONSE_CHUNKS.map((c) => `data: ${JSON.stringify({ content: c })}\n\n`).join("") +
        `data: ${JSON.stringify({ done: true, transits_used: "2026-03-28T00:00:00.000Z", userMsgId: 10, assistantMsgId: 11 })}\n\n`;
      await route.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream" }, body });
    });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Mi pregunta");
    await page.getByRole("button", { name: "Enviar" }).click();

    // User message appears immediately (optimistic)
    await expect(page.getByText("Mi pregunta")).toBeVisible();
    await expect(page.getByLabel("Astral Guide está preparando la respuesta")).toBeVisible();
    await expect(page.getByText("Canalizando tu lectura...")).toBeVisible();
    // Then the assistant response appears
    await expect(page.getByText("34-57...")).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Astral Guide está preparando la respuesta")).not.toBeVisible();
  });

  test("Fallback works when streaming fails", async ({ page }) => {
    await mockChatHistory(page, []);
    await mockChatStreamError(page);
    await mockChatFallback(page, "Respuesta fallback", { userMsgId: 10, assistantMsgId: 11 });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Hola");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("Respuesta fallback")).toBeVisible();
  });

  test("Timeout-style failures keep the UI usable and hide backend details", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await mockChatStreamError(page);
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 504, json: { error: "gateway timed out" } });
      } else {
        await route.fallback();
      }
    });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Necesito contexto ya");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("La respuesta tardó demasiado. Probá de nuevo.")).toBeVisible();
    await expect(page.getByText("gateway timed out")).not.toBeVisible();
    await expect(page.getByText(/Backend error 504/)).not.toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Necesito contexto ya")).toBeVisible();
    await expect(input).toBeVisible();
  });

  test("Connectivity failures after stream abort keep the UI usable and hide transport details", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await mockChatStreamError(page);
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "POST") {
        await route.abort("failed");
      } else {
        await route.fallback();
      }
    });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Necesito una segunda mirada");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("No pudimos conectar con Astral Guide en este momento. Revisá tu conexión y reintentá.")).toBeVisible();
    await expect(page.getByText("Failed to fetch")).not.toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Necesito una segunda mirada")).toBeVisible();
    await expect(input).toBeVisible();
    await input.fill("Puedo reintentar manualmente");
    await expect(input).toHaveValue("Puedo reintentar manualmente");
  });

  test("Generic backend failures after stream abort keep the UI usable and hide provider details", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await mockChatStreamError(page);
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 500, body: "OpenAI API error 500: boom" });
      } else {
        await route.fallback();
      }
    });
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Necesito una síntesis más clara");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("No se pudo responder en este momento. Probá de nuevo.")).toBeVisible();
    await expect(page.getByText("OpenAI API error 500: boom")).not.toBeVisible();
    await expect(page.getByText(/Backend error 500/)).not.toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Necesito una síntesis más clara")).toBeVisible();
    await expect(input).toBeVisible();
    await input.fill("El chat sigue usable");
    await expect(input).toHaveValue("El chat sigue usable");
  });

  test("Quick actions send a message", async ({ page }) => {
    await mockChatHistory(page, []);
    await mockChatStream(page, ["Tus tránsitos de hoy..."], { userMsgId: 10, assistantMsgId: 11 });
    await page.goto("/");

    await page.getByRole("button", { name: "Reporte semanal completo" }).click();
    await expect(page.getByText("Tus tránsitos de hoy...")).toBeVisible();
  });

  test("Shift+Enter creates newline instead of sending", async ({ page }) => {
    await mockChatHistory(page, []);
    await page.goto("/");

    const input = page.getByPlaceholder("Preguntá al oráculo");
    await input.fill("Line one");
    await input.press("Shift+Enter");
    // Input should still have text (not cleared by a send)
    await expect(input).not.toHaveValue("");
  });
});
