import { test, expect, type Page } from "@playwright/test";
import { mockHealth, mockTransits } from "../helpers/mock-api";
import { HISTORY_MESSAGES, TEST_USER, TEST_USER_NO_INTAKE } from "../helpers/fixtures";

type Plan = "free" | "basic" | "premium";

type UsageState = {
  plan: Plan;
  used: number;
  limit: number;
  cycle: string;
  resetsAt: string;
};

type LinkedUserState = typeof TEST_USER_NO_INTAKE & {
  plan: Plan;
  role: "user";
  status: "active";
};

function isExactPath(url: string, pathname: string) {
  return new URL(url).pathname === pathname;
}

type PersistedMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

async function mockLiveSessionState(
  page: Page,
  state: { user: LinkedUserState; usage: UsageState; history: PersistedMessage[] },
) {
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me")) {
      await route.fulfill({ status: 200, json: state.user });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/me/messages**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        json: {
          messages: state.history,
          ...state.usage,
        },
      });
      return;
    }

    await route.fallback();
  });
}

const UPGRADE_CASES = [
  {
    from: "free" as const,
    to: "basic" as const,
    usedBeforeUpgrade: 20,
    previousLimit: 20,
    nextLimit: 120,
    blockedCta: "Ver planes Astral ✦",
    successReply: "Acceso basic activo sin perder el hilo.",
  },
  {
    from: "basic" as const,
    to: "premium" as const,
    usedBeforeUpgrade: 120,
    previousLimit: 120,
    nextLimit: 300,
    blockedCta: "Pasarte a Premium ✦",
    successReply: "Acceso premium activo con el historial intacto.",
  },
];

test.describe("Chat — Plan upgrades", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
  });

  for (const upgradeCase of UPGRADE_CASES) {
    test(`${upgradeCase.from} -> ${upgradeCase.to} preserves history and unlocks chat in the same browser session`, async ({ page }) => {
      const state = {
        user: {
          ...TEST_USER_NO_INTAKE,
          plan: upgradeCase.from,
          role: "user" as const,
          status: "active" as const,
        },
        usage: {
          plan: upgradeCase.from,
          used: upgradeCase.usedBeforeUpgrade,
          limit: upgradeCase.previousLimit,
          cycle: "2026-04",
          resetsAt: "2026-05-01T00:00:00-03:00",
        },
        history: HISTORY_MESSAGES.map((message) => ({
          ...message,
          role: message.role as "user" | "assistant",
        })),
      };

      await mockLiveSessionState(page, state);
      await mockTransits(page);
      let nextMessageId = 20;

      await page.route("**/api/chat/stream", async (route) => {
        const payload = JSON.parse(route.request().postData() ?? "{}") as {
          messages: Array<{ role: string; content: string }>;
        };
        const newPrompt = `Seguimos despues del upgrade a ${upgradeCase.to}`;

        expect(payload.messages.map((message) => ({
          role: message.role,
          content: message.content,
        }))).toEqual([
          { role: "user", content: HISTORY_MESSAGES[0].content },
          { role: "assistant", content: HISTORY_MESSAGES[1].content },
          { role: "user", content: HISTORY_MESSAGES[2].content },
          { role: "assistant", content: HISTORY_MESSAGES[3].content },
          { role: "user", content: newPrompt },
        ]);

        const userMsgId = nextMessageId++;
        const assistantMsgId = nextMessageId++;
        state.history = [
          ...state.history,
          {
            id: userMsgId,
            role: "user",
            content: newPrompt,
            created_at: "2026-04-20T10:05:00.000Z",
          },
          {
            id: assistantMsgId,
            role: "assistant",
            content: upgradeCase.successReply,
            created_at: "2026-04-20T10:05:01.000Z",
          },
        ];
        state.usage = {
          ...state.usage,
          used: upgradeCase.usedBeforeUpgrade + 1,
        };

        const body =
          upgradeCase.successReply
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

      await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
      await expect(page.getByText("Tu ventana al cosmos de este mes se ha completado")).toBeVisible();
      await expect(page.getByRole("link", { name: upgradeCase.blockedCta })).toBeVisible();
      await expect(page.getByPlaceholder("Preguntá al oráculo")).not.toBeVisible();

      state.user = { ...state.user, plan: upgradeCase.to };
      state.usage = {
        ...state.usage,
        plan: upgradeCase.to,
        limit: upgradeCase.nextLimit,
      };

      await page.reload();

      await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
      await expect(page.getByText("Tu ventana al cosmos de este mes se ha completado")).not.toBeVisible();
      await expect(page.getByRole("link", { name: upgradeCase.blockedCta })).not.toBeVisible();

      const input = page.getByPlaceholder("Preguntá al oráculo");
      await expect(input).toBeVisible();
      await input.fill(`Seguimos despues del upgrade a ${upgradeCase.to}`);
      await page.getByRole("button", { name: "Enviar" }).click();

      await expect(page.getByText(upgradeCase.successReply)).toBeVisible();
      await expect(page.getByText(`Seguimos despues del upgrade a ${upgradeCase.to}`)).toBeVisible();

      await page.getByRole("button", { name: "Tránsitos" }).click();
      await expect(page.getByText("Tránsitos de la Semana")).toBeVisible();

      await page.getByRole("button", { name: "Chat" }).click();
      await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
      await expect(page.getByText(`Seguimos despues del upgrade a ${upgradeCase.to}`)).toBeVisible();
      await expect(page.getByText(upgradeCase.successReply)).toBeVisible();

      await page.reload();
      await expect(page.getByText(`Seguimos despues del upgrade a ${upgradeCase.to}`)).toBeVisible();
      await expect(page.getByText(upgradeCase.successReply)).toBeVisible();
    });
  }
});
