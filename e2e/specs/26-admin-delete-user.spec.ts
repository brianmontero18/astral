import { expect, test } from "@playwright/test";

import {
  ADMIN_USER_SESSION,
  isExactPath,
  mockCurrentUser,
} from "../helpers/admin-support";
import { TEST_USER } from "../helpers/fixtures";
import { mockHealth } from "../helpers/mock-api";

/**
 * UX contract for admin user deletion (bead astral-cwh + astral-whd under
 * epic astral-b7u). The flow:
 *  1. Admin opens user detail.
 *  2. Clicks "Eliminar cuenta" in the "Zona de cuidado" section.
 *  3. Confirmation modal names the user/email and the data that will be
 *     dropped.
 *  4. Confirms → DELETE /api/admin/users/:id → returns to user list.
 *  5. Self-delete is blocked at the UI boundary.
 */

const TARGET = {
  id: "doomed-user-1",
  name: "Marina",
  email: "marina@coach.test",
  plan: "premium" as const,
  status: "active" as const,
  role: "user" as const,
  linked: true,
  authIdentity: { provider: "supertokens" as const, subject: "st-marina" },
  support: {
    messagesUsed: 4,
    messageLimit: 300,
    assetCount: 2,
    reportsAvailable: ["premium"] as Array<"free" | "premium">,
  },
  humanDesign: { type: null, authority: null, profile: null },
  onboardingStatus: "complete" as const,
  onboardingStep: null,
  accessSource: "manual" as const,
  createdAt: "2026-04-10T10:00:00.000Z",
  updatedAt: "2026-05-01T18:00:00.000Z",
};

test.describe("Admin user deletion", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockCurrentUser(page, ADMIN_USER_SESSION);
  });

  test("admin deletes a user from detail and returns to the user list", async ({
    page,
  }) => {
    const deleteCalls: Array<string> = [];

    await page.route(`**/api/users/${TARGET.id}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: TARGET });
        return;
      }
      await route.fallback();
    });

    await page.route(`**/api/admin/users/${TARGET.id}/llm-usage**`, async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          days: 7,
          since: "2026-04-27T00:00:00.000Z",
          totalCallCount: 0,
          totalTokensIn: 0,
          totalTokensOut: 0,
          totalCostUsd: 0,
          byRoute: [],
          byModel: [],
        },
      });
    });

    await page.route("**/api/admin/users**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());

      if (
        req.method() === "DELETE" &&
        url.pathname === `/api/admin/users/${TARGET.id}`
      ) {
        deleteCalls.push(url.pathname);
        await route.fulfill({
          status: 200,
          json: { ok: true, deletedAssets: 2, r2Errors: [] },
        });
        return;
      }

      if (req.method() === "GET" && isExactPath(req.url(), "/api/admin/users")) {
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

    await page.goto(`/admin/users/${TARGET.id}`);

    await expect(
      page.getByRole("heading", { name: TARGET.name }),
    ).toBeVisible();

    await page.getByRole("button", { name: /eliminar cuenta/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // toContainText avoids strict-mode collisions with overlapping
    // substrings (e.g. "Marina" appears both as the name and inside
    // "marina@coach.test").
    await expect(dialog).toContainText(TARGET.name);
    await expect(dialog).toContainText(TARGET.email);
    await expect(dialog).toContainText(/assets en R2/i);
    await expect(dialog).toContainText(/irreversible/i);

    await dialog.getByRole("button", { name: /eliminar/i }).click();

    await expect(page).toHaveURL(/\/admin\/users(?:$|\?)/);
    expect(deleteCalls).toEqual([`/api/admin/users/${TARGET.id}`]);
  });

  test("self-delete button is disabled for the active admin", async ({ page }) => {
    const adminId = ADMIN_USER_SESSION.id;
    const ADMIN_AS_TARGET = { ...TARGET, id: adminId };

    await page.route(`**/api/users/${adminId}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: ADMIN_AS_TARGET });
        return;
      }
      await route.fallback();
    });

    await page.route(`**/api/admin/users/${adminId}/llm-usage**`, async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          days: 7,
          since: "2026-04-27T00:00:00.000Z",
          totalCallCount: 0,
          totalTokensIn: 0,
          totalTokensOut: 0,
          totalCostUsd: 0,
          byRoute: [],
          byModel: [],
        },
      });
    });

    await page.goto(`/admin/users/${adminId}`);

    const deleteButton = page.getByRole("button", { name: /eliminar cuenta/i });
    await expect(deleteButton).toBeDisabled();
    await expect(
      page.getByText(/auto-eliminaci[oó]n.*admin/i),
    ).toBeVisible();
  });
});
