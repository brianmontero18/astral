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

  test("Edited branches accept a new follow-up and persist only the rewritten conversation after reload", async ({ page }) => {
    type PersistedMessage = {
      id: number;
      role: "user" | "assistant";
      content: string;
      created_at: string;
    };

    let historyState: PersistedMessage[] = HISTORY_MESSAGES.map((message) => ({
      ...message,
      role: message.role as "user" | "assistant",
    }));
    let usageState = {
      plan: "free" as const,
      used: 2,
      limit: 20,
      cycle: "2026-04",
      resetsAt: "2026-05-01T00:00:00-03:00",
    };
    let streamCallCount = 0;

    await page.route("**/api/me/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            messages: historyState,
            ...usageState,
          },
        });
        return;
      }

      if (route.request().method() === "DELETE") {
        expect(new URL(route.request().url()).searchParams.get("fromId")).toBe("1");
        historyState = [];
        usageState = {
          ...usageState,
          used: 0,
        };
        await route.fulfill({
          status: 200,
          json: {
            deleted: 4,
            ...usageState,
          },
        });
        return;
      }

      await route.fallback();
    });

    await page.route("**/api/chat/stream", async (route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        messages: Array<{ role: string; content: string }>;
      };
      const normalizedMessages = payload.messages.map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));

      if (streamCallCount === 0) {
        expect(normalizedMessages).toEqual([
          { role: "user", content: "Pregunta editada persistida" },
        ]);
        historyState = [
          {
            id: 20,
            role: "user",
            content: "Pregunta editada persistida",
            created_at: "2026-03-28T10:02:00.000Z",
          },
          {
            id: 21,
            role: "assistant",
            content: "Respuesta editada",
            created_at: "2026-03-28T10:02:01.000Z",
          },
        ];
      } else {
        expect(normalizedMessages).toEqual([
          { role: "user", content: "Pregunta editada persistida" },
          { role: "assistant", content: "Respuesta editada" },
          { role: "user", content: "Necesito un siguiente paso concreto" },
        ]);
        historyState = [
          ...historyState,
          {
            id: 22,
            role: "user",
            content: "Necesito un siguiente paso concreto",
            created_at: "2026-03-28T10:03:00.000Z",
          },
          {
            id: 23,
            role: "assistant",
            content: "Tu siguiente paso es sostener una sola prioridad esta semana.",
            created_at: "2026-03-28T10:03:01.000Z",
          },
        ];
      }

      usageState = {
        ...usageState,
        used: usageState.used + 1,
      };
      const responseChunks = streamCallCount === 0
        ? "Respuesta editada"
        : "Tu siguiente paso es sostener una sola prioridad esta semana.";
      const userMsgId = streamCallCount === 0 ? 20 : 22;
      const assistantMsgId = streamCallCount === 0 ? 21 : 23;
      streamCallCount += 1;

      const body =
        responseChunks
          .split(" ")
          .map((chunk) => `data: ${JSON.stringify({ content: `${chunk} ` })}\n\n`)
          .join("") +
        `data: ${JSON.stringify({
          done: true,
          transits_used: "2026-03-28T00:00:00.000Z",
          userMsgId,
          assistantMsgId,
        })}\n\n`;

      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await page.goto("/");

    await page.getByRole("button", { name: "Editar mensaje" }).first().click();
    await page.getByRole("textbox").first().fill("Pregunta editada persistida");
    await page.getByRole("button", { name: "Guardar y enviar" }).click();

    await expect(page.getByText("Respuesta editada")).toBeVisible();
    await expect(page.getByText("Como afecta mi centro Sacral?")).not.toBeVisible();

    const input = page.getByPlaceholder("Preguntá al oráculo sobre tu semana...");
    await input.fill("Necesito un siguiente paso concreto");
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("Necesito un siguiente paso concreto")).toBeVisible();
    await expect(
      page.getByText("Tu siguiente paso es sostener una sola prioridad esta semana."),
    ).toBeVisible();

    await page.reload();

    await expect(page.getByText("Pregunta editada persistida")).toBeVisible();
    await expect(page.getByText("Respuesta editada")).toBeVisible();
    await expect(page.getByText("Necesito un siguiente paso concreto")).toBeVisible();
    await expect(
      page.getByText("Tu siguiente paso es sostener una sola prioridad esta semana."),
    ).toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).not.toBeVisible();
    await expect(page.getByText("Como afecta mi centro Sacral?")).not.toBeVisible();
  });

  test("Chat history order matches send order", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await page.goto("/");

    const transcript = await page.locator("main").textContent();
    expect(transcript).toBeTruthy();

    const firstQuestionIndex = transcript!.indexOf("Que transitos tengo esta semana?");
    const firstAnswerIndex = transcript!.indexOf("Esta semana el Sol transita por tu Puerta 41...");
    const secondQuestionIndex = transcript!.indexOf("Como afecta mi centro Sacral?");
    const secondAnswerIndex = transcript!.indexOf("Tu centro Sacral definido recibe energia del transito...");

    expect(firstQuestionIndex).toBeGreaterThanOrEqual(0);
    expect(firstAnswerIndex).toBeGreaterThan(firstQuestionIndex);
    expect(secondQuestionIndex).toBeGreaterThan(firstAnswerIndex);
    expect(secondAnswerIndex).toBeGreaterThan(secondQuestionIndex);
  });

  test("Quick action, typed follow-up, stream, and reload preserve one continuous conversation loop", async ({ page }) => {
    type PersistedMessage = {
      id: number;
      role: "user" | "assistant";
      content: string;
      created_at: string;
    };

    const prompts = [
      {
        user: "Reporte semanal completo",
        assistant: "Resumen semanal aplicado para empezar la conversación.",
        createdAt: ["2026-03-28T10:00:00.000Z", "2026-03-28T10:00:01.000Z"],
      },
      {
        user: "Necesito foco laboral para esta semana",
        assistant: "Esta semana te conviene priorizar una sola decisión laboral clara.",
        createdAt: ["2026-03-28T10:01:00.000Z", "2026-03-28T10:01:01.000Z"],
      },
    ] as const;

    let historyState: PersistedMessage[] = [];
    let nextMessageId = 10;
    let streamCallCount = 0;
    let usageState = {
      plan: "free" as const,
      used: 0,
      limit: 20,
      cycle: "2026-04",
      resetsAt: "2026-05-01T00:00:00-03:00",
    };

    await page.route("**/api/me/messages**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            messages: historyState,
            ...usageState,
          },
        });
        return;
      }

      await route.fallback();
    });

    await page.route("**/api/chat/stream", async (route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}") as {
        messages: Array<{ role: string; content: string }>;
      };
      const normalizedMessages = payload.messages.map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));
      const scenario = prompts[streamCallCount];

      expect(scenario).toBeDefined();

      if (streamCallCount === 0) {
        expect(normalizedMessages).toEqual([
          { role: "user", content: scenario.user },
        ]);
      } else {
        expect(normalizedMessages).toEqual([
          { role: "user", content: prompts[0].user },
          { role: "assistant", content: prompts[0].assistant },
          { role: "user", content: scenario.user },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      const userMsgId = nextMessageId++;
      const assistantMsgId = nextMessageId++;
      historyState = [
        ...historyState,
        {
          id: userMsgId,
          role: "user",
          content: scenario.user,
          created_at: scenario.createdAt[0],
        },
        {
          id: assistantMsgId,
          role: "assistant",
          content: scenario.assistant,
          created_at: scenario.createdAt[1],
        },
      ];
      usageState = {
        ...usageState,
        used: usageState.used + 1,
      };
      streamCallCount += 1;

      const body =
        scenario.assistant
          .split(" ")
          .map((chunk) => `data: ${JSON.stringify({ content: `${chunk} ` })}\n\n`)
          .join("") +
        `data: ${JSON.stringify({
          done: true,
          transits_used: "2026-03-28T00:00:00.000Z",
          userMsgId,
          assistantMsgId,
        })}\n\n`;

      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body,
      });
    });

    await page.goto("/");

    await expect(page.getByRole("button", { name: prompts[0].user })).toBeVisible();
    await page.getByRole("button", { name: prompts[0].user }).click();

    await expect(page.getByText(prompts[0].user)).toBeVisible();
    await expect(page.getByText(prompts[0].assistant)).toBeVisible();

    const input = page.getByPlaceholder("Preguntá al oráculo sobre tu semana...");
    await input.fill(prompts[1].user);
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText(prompts[1].user)).toBeVisible();
    await expect(page.getByText(prompts[1].assistant)).toBeVisible();

    await page.reload();

    for (const prompt of prompts) {
      await expect(page.getByText(prompt.user)).toBeVisible();
      await expect(page.getByText(prompt.assistant)).toBeVisible();
    }

    const transcript = await page.locator("main").textContent();
    expect(transcript).toBeTruthy();

    const firstQuickActionIndex = transcript!.indexOf(prompts[0].user);
    const firstReplyIndex = transcript!.indexOf(prompts[0].assistant);
    const secondQuestionIndex = transcript!.indexOf(prompts[1].user);
    const secondReplyIndex = transcript!.indexOf(prompts[1].assistant);

    expect(firstQuickActionIndex).toBeGreaterThanOrEqual(0);
    expect(firstReplyIndex).toBeGreaterThan(firstQuickActionIndex);
    expect(secondQuestionIndex).toBeGreaterThan(firstReplyIndex);
    expect(secondReplyIndex).toBeGreaterThan(secondQuestionIndex);
  });
});
