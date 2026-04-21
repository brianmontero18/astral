import { Buffer } from "node:buffer";

import { expect, test, type Page } from "@playwright/test";

import { mockChatHistory, mockGetUser, mockHealth } from "../helpers/mock-api";
import { HISTORY_MESSAGES, TEST_USER_NO_INTAKE } from "../helpers/fixtures";

const PASSWORDLESS_STORAGE_KEY = "supertokens-passwordless-loginAttemptInfo";
const AUTH_CREATE_CODE_PATHS = [
  "/auth/signinup/code",
  "/auth/public/signinup/code",
];
const AUTH_RESEND_CODE_PATHS = [
  "/auth/signinup/code/resend",
  "/auth/public/signinup/code/resend",
];
const AUTH_CONSUME_CODE_PATHS = [
  "/auth/signinup/code/consume",
  "/auth/public/signinup/code/consume",
];

const LINKED_FREE_USER = {
  ...TEST_USER_NO_INTAKE,
  plan: "free" as const,
  role: "user" as const,
  status: "active" as const,
};

function isExactPath(url: string, pathname: string) {
  return new URL(url).pathname === pathname;
}

function matchesAnyPath(url: string, pathnames: Array<string>) {
  return pathnames.some((pathname) => isExactPath(url, pathname));
}

function buildPasswordlessConsumeOkBody(recipeUserId: string, email: string) {
  return {
    status: "OK",
    createdNewRecipeUser: false,
    user: {
      id: recipeUserId,
      isPrimaryUser: true,
      tenantIds: ["public"],
      emails: [email],
      phoneNumbers: [],
      thirdParty: [],
      webauthn: {
        credentialIds: [],
      },
      loginMethods: [
        {
          recipeId: "passwordless" as const,
          recipeUserId,
          tenantIds: ["public"],
          timeJoined: 1711600000000,
          email,
          verified: true,
        },
      ],
      timeJoined: 1711600000000,
    },
  };
}

function buildPasswordlessSessionHeaders(recipeUserId: string) {
  return {
    "access-control-expose-headers":
      "front-token, st-access-token, st-refresh-token, anti-csrf",
    "anti-csrf": `anti-csrf-${recipeUserId}`,
    "content-type": "application/json",
    "front-token": Buffer.from(
      JSON.stringify({
        uid: recipeUserId,
        ate: Date.now(),
        up: {},
      }),
    ).toString("base64"),
    "st-access-token": `access-${recipeUserId}`,
    "st-refresh-token": `refresh-${recipeUserId}`,
  };
}

async function seedPasswordlessAttempt(
  page: Page,
  attempt: {
    contactInfo?: string;
    deviceId: string;
    flowType: "MAGIC_LINK" | "USER_INPUT_CODE" | "USER_INPUT_CODE_AND_MAGIC_LINK";
    preAuthSessionId: string;
    redirectToPath?: string;
  },
) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: PASSWORDLESS_STORAGE_KEY,
      value: {
        version: 1,
        tenantId: "public",
        ...attempt,
      },
    },
  );
}

async function mockSuccessfulAppBootstrap(
  page: Page,
) {
  await mockHealth(page);
  await mockGetUser(page, LINKED_FREE_USER);
  await mockChatHistory(page, HISTORY_MESSAGES, { plan: "free", used: 2, limit: 20 });
}

test.describe("Auth — Passwordless flow", () => {
  test("Email submit enters the code flow cleanly and resend keeps the user on a safe path", async ({
    page,
  }) => {
    let createPayload: Record<string, unknown> | null = null;

    let releaseCreateCode: (() => void) | null = null;
    const createCodeReady = new Promise<void>((resolve) => {
      releaseCreateCode = resolve;
    });

    await page.route("**/auth/**", async (route) => {
      const request = route.request();

      if (request.method() === "POST" && matchesAnyPath(request.url(), AUTH_CREATE_CODE_PATHS)) {
        createPayload = request.postDataJSON() as Record<string, unknown>;
        await createCodeReady;
        await route.fulfill({
          status: 200,
          json: {
            status: "OK",
            deviceId: "device-auth-1",
            preAuthSessionId: "pre-auth-1",
            flowType: "USER_INPUT_CODE_AND_MAGIC_LINK",
          },
        });
        return;
      }

      if (request.method() === "POST" && matchesAnyPath(request.url(), AUTH_RESEND_CODE_PATHS)) {
        await route.fulfill({
          status: 200,
          json: { status: "OK" },
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/auth?redirectToPath=%2F");

    await page.getByLabel("Email").fill("daniela@astral.test");
    await page.getByRole("button", { name: "Enviar enlace mágico" }).click();

    await expect(page.getByRole("button", { name: "Enviando..." })).toBeDisabled();

    releaseCreateCode?.();

    await expect(page.getByLabel("Código de acceso")).toBeVisible();
    await expect(page.getByText("Te enviamos un código y un enlace mágico a daniela@astral.test.")).toBeVisible();
    await expect(page.getByText("Destino")).toBeVisible();
    await expect(page.getByText("daniela@astral.test", { exact: true })).toBeVisible();
    expect(createPayload).toEqual({
      email: "daniela@astral.test",
      shouldTryLinkingWithSessionUser: false,
    });

    await page.getByRole("button", { name: "Reenviar acceso" }).click();

    await expect(page.getByText("Reenviamos el acceso a daniela@astral.test.")).toBeVisible();

    await page.getByRole("button", { name: "Usar otro correo" }).click();

    await expect(page.getByRole("button", { name: "Enviar enlace mágico" })).toBeVisible();
    await expect(page.getByLabel("Código de acceso")).toHaveCount(0);
  });

  test("Invalid code shows friendly copy and preserves a clean retry path", async ({
    page,
  }) => {
    let consumePayload: Record<string, unknown> | null = null;

    let releaseConsume: (() => void) | null = null;
    const consumeReady = new Promise<void>((resolve) => {
      releaseConsume = resolve;
    });

    await seedPasswordlessAttempt(page, {
      contactInfo: "daniela@astral.test",
      deviceId: "device-auth-2",
      flowType: "USER_INPUT_CODE_AND_MAGIC_LINK",
      preAuthSessionId: "pre-auth-2",
      redirectToPath: "/",
    });

    await page.route("**/auth/**", async (route) => {
      const request = route.request();

      if (request.method() === "POST" && matchesAnyPath(request.url(), AUTH_CONSUME_CODE_PATHS)) {
        consumePayload = request.postDataJSON() as Record<string, unknown>;
        await consumeReady;
        await route.fulfill({
          status: 200,
          json: {
            status: "INCORRECT_USER_INPUT_CODE_ERROR",
            failedCodeInputAttemptCount: 2,
            maximumCodeInputAttempts: 5,
          },
        });
        return;
      }

      if (request.method() === "POST" && matchesAnyPath(request.url(), AUTH_RESEND_CODE_PATHS)) {
        await route.fulfill({
          status: 200,
          json: { status: "OK" },
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/auth?redirectToPath=%2F");

    await expect(page.getByLabel("Código de acceso")).toBeVisible();

    await page.getByLabel("Código de acceso").fill("123 456");
    await page.getByRole("button", { name: "Entrar a mi espacio" }).click();

    await expect(page.getByRole("button", { name: "Validando..." })).toBeDisabled();

    releaseConsume?.();

    await expect(page.getByText("Ese codigo no coincide. Intento 2 de 5.")).toBeVisible();
    await expect(page.getByText("INCORRECT_USER_INPUT_CODE_ERROR")).not.toBeVisible();
    expect(consumePayload).toEqual({
      deviceId: "device-auth-2",
      preAuthSessionId: "pre-auth-2",
      shouldTryLinkingWithSessionUser: false,
      userInputCode: "123 456",
    });

    await page.getByRole("button", { name: "Reenviar acceso" }).click();

    await expect(page.getByText("Reenviamos el acceso a daniela@astral.test.")).toBeVisible();
    await expect(page.getByLabel("Código de acceso")).toBeVisible();
  });

  test("Magic-link return without a matching stored attempt waits for manual confirmation and then redirects", async ({
    page,
  }) => {
    let consumePayload: Record<string, unknown> | null = null;

    let releaseConsume: (() => void) | null = null;
    const consumeReady = new Promise<void>((resolve) => {
      releaseConsume = resolve;
    });

    await mockSuccessfulAppBootstrap(page);
    await page.route("**/auth/**", async (route) => {
      const request = route.request();

      if (request.method() === "POST" && matchesAnyPath(request.url(), AUTH_CONSUME_CODE_PATHS)) {
        consumePayload = request.postDataJSON() as Record<string, unknown>;
        await consumeReady;
        await route.fulfill({
          status: 200,
          headers: buildPasswordlessSessionHeaders("recipe-user-1"),
          json: buildPasswordlessConsumeOkBody("recipe-user-1", "daniela@astral.test"),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/auth?redirectToPath=%2F&preAuthSessionId=pre-manual#magic-link-123");

    await expect(page.getByRole("button", { name: "Continuar con este enlace" })).toBeVisible();

    await page.getByRole("button", { name: "Continuar con este enlace" }).click();

    await expect(page.getByText("Verificando tu enlace para abrir Astral Guide.")).toBeVisible();

    releaseConsume?.();

    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    expect(consumePayload).toEqual({
      linkCode: "magic-link-123",
      preAuthSessionId: "pre-manual",
      shouldTryLinkingWithSessionUser: false,
    });
  });

  test("Matching magic-link return auto-consumes on boot and lands inside the app", async ({
    page,
  }) => {
    let consumeCalls = 0;

    await seedPasswordlessAttempt(page, {
      contactInfo: "daniela@astral.test",
      deviceId: "device-auth-3",
      flowType: "MAGIC_LINK",
      preAuthSessionId: "pre-auto",
      redirectToPath: "/",
    });
    await mockSuccessfulAppBootstrap(page);
    await page.route("**/auth/**", async (route) => {
      const request = route.request();

      if (request.method() === "POST" && matchesAnyPath(request.url(), AUTH_CONSUME_CODE_PATHS)) {
        consumeCalls += 1;
        await route.fulfill({
          status: 200,
          headers: buildPasswordlessSessionHeaders("recipe-user-2"),
          json: buildPasswordlessConsumeOkBody("recipe-user-2", "daniela@astral.test"),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/auth?redirectToPath=%2F&preAuthSessionId=pre-auto#magic-link-456");

    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar con este enlace" })).toHaveCount(0);
    expect(consumeCalls).toBe(1);
  });
});
