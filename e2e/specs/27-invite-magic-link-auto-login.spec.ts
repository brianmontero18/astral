import { Buffer } from "node:buffer";

import { expect, test, type Page } from "@playwright/test";

import { mockHealth } from "../helpers/mock-api";

/**
 * UX contract for the admin-invite magic link auto-consume flow (epic
 * astral-b7u, slice astral-qhc + astral-pmk). The admin-minted magic
 * link carries an explicit `intent=invite` query param; the auth screen
 * uses it as the signal to consume the link without requiring same-
 * browser login state. A normal login link without that param still
 * gates on the stored attempt, preserving the original CSRF posture.
 */

const AUTH_CONSUME_CODE_PATHS = [
  "/auth/signinup/code/consume",
  "/auth/public/signinup/code/consume",
];

function isExactPath(url: string, pathname: string) {
  return new URL(url).pathname === pathname;
}

function matchesAnyPath(url: string, pathnames: Array<string>) {
  return pathnames.some((pathname) => isExactPath(url, pathname));
}

function buildPasswordlessConsumeOkBody(recipeUserId: string, email: string) {
  return {
    status: "OK" as const,
    createdNewRecipeUser: false,
    user: {
      id: recipeUserId,
      isPrimaryUser: true,
      tenantIds: ["public"],
      emails: [email],
      phoneNumbers: [],
      thirdParty: [],
      webauthn: { credentialIds: [] },
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
      JSON.stringify({ uid: recipeUserId, ate: Date.now(), up: {} }),
    ).toString("base64"),
    "st-access-token": `access-${recipeUserId}`,
    "st-refresh-token": `refresh-${recipeUserId}`,
  };
}

async function mockMeAsPendingInvitee(page: Page) {
  await page.route("**/api/me", async (route) => {
    if (
      route.request().method() === "GET" &&
      isExactPath(route.request().url(), "/api/me")
    ) {
      await route.fulfill({
        status: 200,
        json: {
          id: "invited-user-1",
          name: "",
          plan: "premium",
          role: "user",
          status: "active",
          email: "marina@coach.test",
          profile: {
            humanDesign: {
              type: "",
              strategy: "",
              authority: "",
              profile: "",
              definition: "",
              incarnationCross: "",
              notSelfTheme: "",
              variable: "",
              digestion: "",
              environment: "",
              strongestSense: "",
              channels: [],
              activatedGates: [],
              definedCenters: [],
              undefinedCenters: [],
            },
          },
          intake: null,
          onboarding_status: "pending",
          onboarding_step: "name",
          access_source: "manual",
          onboardingStatus: "pending",
          onboardingStep: "name",
          accessSource: "manual",
        },
      });
      return;
    }
    await route.fallback();
  });
}

test.describe("Invite magic link — auto-consume", () => {
  test.beforeEach(async ({ page }) => {
    await mockHealth(page);
  });

  test("intent=invite consumes the magic link without a stored attempt", async ({
    page,
  }) => {
    let consumePayload: Record<string, unknown> | null = null;
    let consumeCalls = 0;

    await page.route("**/auth/**", async (route) => {
      const request = route.request();
      if (
        request.method() === "POST" &&
        matchesAnyPath(request.url(), AUTH_CONSUME_CODE_PATHS)
      ) {
        consumeCalls += 1;
        consumePayload = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          headers: buildPasswordlessSessionHeaders("recipe-user-invitee-1"),
          json: buildPasswordlessConsumeOkBody(
            "recipe-user-invitee-1",
            "marina@coach.test",
          ),
        });
        return;
      }
      await route.fallback();
    });

    await mockMeAsPendingInvitee(page);

    // intent=invite ⇒ frontend auto-consumes immediately, no manual click.
    await page.goto(
      "/auth?preAuthSessionId=pre-invite-1&intent=invite#linkcode-invite-1",
    );

    // The contract: consume fires on its own AND the manual gate is never
    // shown. Asserting on the transient "Verificando" copy is flaky because
    // the auto-consume races the page navigation; the two assertions below
    // pin the behavior we actually care about.
    await expect.poll(() => consumeCalls).toBe(1);
    await expect(
      page.getByRole("button", { name: /Continuar con este enlace/i }),
    ).toHaveCount(0);
    expect(consumePayload).toMatchObject({
      preAuthSessionId: "pre-invite-1",
      linkCode: "linkcode-invite-1",
    });
  });

  test("magic link without intent and no stored attempt still requires manual confirmation", async ({
    page,
  }) => {
    let consumeCalls = 0;
    await page.route("**/auth/**", async (route) => {
      const request = route.request();
      if (
        request.method() === "POST" &&
        matchesAnyPath(request.url(), AUTH_CONSUME_CODE_PATHS)
      ) {
        consumeCalls += 1;
        await route.fulfill({
          status: 200,
          headers: buildPasswordlessSessionHeaders("recipe-user-noop-1"),
          json: buildPasswordlessConsumeOkBody(
            "recipe-user-noop-1",
            "noop@astral.test",
          ),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(
      "/auth?preAuthSessionId=pre-no-intent-1#linkcode-no-intent-1",
    );

    await expect(
      page.getByRole("button", { name: /Continuar con este enlace/i }),
    ).toBeVisible();
    expect(consumeCalls).toBe(0);
  });
});
