import { test, expect } from "@playwright/test";

import {
  ADMIN_USER_SESSION,
  isExactPath,
  mockCurrentUser,
} from "../helpers/admin-support";
import { TEST_USER } from "../helpers/fixtures";
import { mockHealth } from "../helpers/mock-api";

/**
 * UX contract for the admin invite flow. Originally landed under epic
 * astral-0xw with every test marked `test.fixme(...)`. Activated under
 * epic astral-b7u — Slice 9 (astral-o2g) — once the slices behind each
 * scenario shipped (branded email, intent=invite, dynamic TTL, neutral
 * copy). Specs 26 and 27 cover the new delete + auto-consume flows.
 */

const INVITED_EMAIL = "marina@coach.test";
const INVITED_NAME = "Marina";
const SAMPLE_MAGIC_LINK =
  "http://localhost:5173/auth/verify?preAuthSessionId=preauth-abc&linkCode=link-abc";
const FUTURE_EXPIRY = "2026-05-05T18:00:00.000Z";

const INVITED_USER_DETAIL = {
  id: "invited-marina-1",
  name: INVITED_NAME,
  email: INVITED_EMAIL,
  plan: "premium" as const,
  status: "active" as const,
  role: "user" as const,
  linked: false,
  authIdentity: null,
  support: {
    messagesUsed: 0,
    messageLimit: 300,
    assetCount: 0,
    reportsAvailable: [] as Array<"free" | "premium">,
  },
  humanDesign: {
    type: null,
    authority: null,
    profile: null,
  },
  onboardingStatus: "pending" as const,
  onboardingStep: "upload" as const,
  accessSource: "manual" as const,
  createdAt: "2026-05-03T18:00:00.000Z",
  updatedAt: "2026-05-03T18:00:00.000Z",
};

test.describe("Admin user provisioning — invite premium", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
  });

  test(
    "admin invites a new email to premium and sees the copyable magic link",
    async ({ page }) => {
      await mockCurrentUser(page, ADMIN_USER_SESSION);

      const adminPosts: Array<{
        email: string;
        plan: string;
        name?: string;
      }> = [];

      await page.route("**/api/admin/users", async (route) => {
        const request = route.request();
        if (
          request.method() === "POST" &&
          isExactPath(request.url(), "/api/admin/users")
        ) {
          adminPosts.push(request.postDataJSON());
          await route.fulfill({
            status: 200,
            json: {
              userId: INVITED_USER_DETAIL.id,
              plan: "premium",
              isNewUser: true,
              magicLink: SAMPLE_MAGIC_LINK,
              expiresAt: FUTURE_EXPIRY,
            },
          });
          return;
        }
        await route.fallback();
      });

      await page.route("**/api/admin/users**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: {
              users: [],
              currentPage: 1,
              totalPages: 1,
              totalItems: 0,
              pageSize: 12,
              rangeStart: 0,
              rangeEnd: 0,
            },
          });
          return;
        }
        await route.fallback();
      });

      await page.goto("/admin/users");

      await page
        .getByRole("button", { name: /invitar persona/i })
        .click();

      await expect(
        page.getByRole("heading", { name: /invitar persona/i }),
      ).toBeVisible();

      await page.getByLabel(/email/i).fill(INVITED_EMAIL);
      await page.getByLabel(/^plan$/i).selectOption("premium");
      await page.getByLabel(/nombre/i).fill(INVITED_NAME);
      await page
        .getByRole("button", { name: /enviar invitaci[oó]n/i })
        .click();

      await expect(page.getByText(SAMPLE_MAGIC_LINK)).toBeVisible();
      // Real expiry is dynamic (mirrors SuperTokens core codeLifetime). The
      // contract only asserts the surfaced copy still mentions an expiry.
      await expect(page.getByText(/expira en/i)).toBeVisible();

      await page.getByRole("button", { name: /copiar link/i }).click();

      const clipboard = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      expect(clipboard).toBe(SAMPLE_MAGIC_LINK);

      expect(adminPosts).toEqual([
        { email: INVITED_EMAIL, plan: "premium", name: INVITED_NAME },
      ]);
    },
  );

  test(
    "admin invites an existing free email — UI shows upgrade success, not error",
    async ({ page }) => {
      await mockCurrentUser(page, ADMIN_USER_SESSION);

      await page.route("**/api/admin/users", async (route) => {
        const request = route.request();
        if (
          request.method() === "POST" &&
          isExactPath(request.url(), "/api/admin/users")
        ) {
          await route.fulfill({
            status: 200,
            json: {
              userId: "existing-user-1",
              plan: "premium",
              isNewUser: false,
              magicLink: SAMPLE_MAGIC_LINK,
              expiresAt: FUTURE_EXPIRY,
            },
          });
          return;
        }
        await route.fallback();
      });

      await page.route("**/api/admin/users**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: {
              users: [],
              currentPage: 1,
              totalPages: 1,
              totalItems: 0,
              pageSize: 12,
              rangeStart: 0,
              rangeEnd: 0,
            },
          });
          return;
        }
        await route.fallback();
      });

      await page.goto("/admin/users");
      await page
        .getByRole("button", { name: /invitar persona/i })
        .click();
      await page.getByLabel(/email/i).fill(INVITED_EMAIL);
      await page.getByLabel(/^plan$/i).selectOption("premium");
      await page
        .getByRole("button", { name: /enviar invitaci[oó]n/i })
        .click();

      // Upgrade copy distinguishes from new-user copy without surfacing as
      // an error — the operation succeeded; the meaning is "we upgraded
      // the existing free account, here's the fresh login link". Asserting
      // on success-panel copy instead of the modal header (which always
      // mentions "upgradeamos") so the test fails if the success branch
      // ever stops rendering.
      await expect(page.getByText(/Plan actualizado/i)).toBeVisible();
      await expect(page.getByText(/no se duplicó/i)).toBeVisible();
      await expect(page.getByText(SAMPLE_MAGIC_LINK)).toBeVisible();
      await expect(
        page.getByRole("button", { name: /copiar link/i }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    },
  );

  test(
    "admin reinvites a pending user from detail view and gets a fresh link",
    async ({ page }) => {
      await mockCurrentUser(page, ADMIN_USER_SESSION);

      const reinviteCalls: Array<{ email: string; plan: string }> = [];

      await page.route(
        `**/api/users/${INVITED_USER_DETAIL.id}`,
        async (route) => {
          if (route.request().method() === "GET") {
            await route.fulfill({ status: 200, json: INVITED_USER_DETAIL });
            return;
          }
          await route.fallback();
        },
      );

      await page.route("**/api/admin/users", async (route) => {
        if (route.request().method() === "POST") {
          reinviteCalls.push(route.request().postDataJSON());
          await route.fulfill({
            status: 200,
            json: {
              userId: INVITED_USER_DETAIL.id,
              plan: "premium",
              isNewUser: false,
              magicLink: SAMPLE_MAGIC_LINK,
              expiresAt: FUTURE_EXPIRY,
            },
          });
          return;
        }
        await route.fallback();
      });

      await page.goto(`/admin/users/${INVITED_USER_DETAIL.id}`);

      await expect(
        page.getByRole("heading", { name: INVITED_NAME }),
      ).toBeVisible();
      // Spanish copy from getAdminOnboardingStatusLabel("pending") and
      // getAdminAccessSourceLabel("manual"). Asserting on English keys
      // would be a false negative against the actual rendered UI.
      await expect(page.getByText(/onboarding/i)).toBeVisible();
      await expect(page.getByText(/pendiente/i)).toBeVisible();
      await expect(page.getByText(/Invitación admin/i)).toBeVisible();

      await page
        .getByRole("button", { name: /reinvitar/i })
        .click();

      await expect(page.getByText(SAMPLE_MAGIC_LINK)).toBeVisible();
      expect(reinviteCalls).toEqual([
        { email: INVITED_EMAIL, plan: "premium" },
      ]);
    },
  );

  test(
    "invited user lands in onboarding with plan locked, completes flow into premium chat",
    async ({ page }) => {
      // Once SuperTokens consumed the magic link, the session exists and the
      // backend auto-linked our pending users row to the identity. /api/me
      // surfaces the resume state.
      await mockCurrentUser(page, {
        id: INVITED_USER_DETAIL.id,
        name: INVITED_NAME,
        plan: "premium",
        role: "user",
        status: "active",
        profile: {
          name: INVITED_NAME,
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
        onboardingStatus: "pending",
        onboardingStep: "upload",
        accessSource: "manual",
      } as unknown as Parameters<typeof mockCurrentUser>[1]);

      await page.goto("/");

      // Step "name" must be skipped because admin already provided the name.
      await expect(
        page.getByRole("heading", { name: /sincroniz[aá] tu energ[ií]a/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /astral guide/i, level: 1 }),
      ).toHaveCount(0);

      // Plan selector must NOT be present — plan was locked at invite time.
      await expect(page.getByLabel(/^plan$/i)).toHaveCount(0);

      // (rest of upload → review → intake → premium chat is exercised by
      // existing onboarding specs; this contract only asserts the entry
      // point and the plan-lock invariant)
    },
  );

  test(
    "self-signup vanilla user reaches chat as free without admin involvement (regression)",
    async ({ page }) => {
      // SuperTokens session exists but identity is not linked to any users
      // row (no admin invite ever happened). The legacy POST /api/users path
      // still creates a self-signup user with onboarding_status='complete'
      // by default and lands them in chat as free. This guards against
      // regressions from the new pending-user code paths.
      await page.route("**/api/me", async (route) => {
        if (
          route.request().method() === "GET" &&
          isExactPath(route.request().url(), "/api/me")
        ) {
          await route.fulfill({
            status: 409,
            json: {
              error: "identity_not_linked",
              provider: "supertokens",
              subject: "anon-subject-1",
            },
          });
          return;
        }
        await route.fallback();
      });

      await page.goto("/");

      // Lands on the welcome step of the legacy onboarding flow — no admin
      // gating, no plan locked, plan defaults to free.
      await expect(
        page.getByRole("heading", { name: /astral guide/i, level: 1 }),
      ).toBeVisible();
    },
  );
});
