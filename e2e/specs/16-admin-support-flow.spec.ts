import { test, expect } from "@playwright/test";

import {
  ADMIN_USER_SESSION,
  createAdminUserDetail,
  createAdminUserListResponse,
  createAdminUserSummary,
  isExactPath,
  mockCurrentUser,
} from "../helpers/admin-support";
import { TEST_USER } from "../helpers/fixtures";
import { mockHealth } from "../helpers/mock-api";

const MESSAGE_LIMIT_BY_PLAN = {
  free: 20,
  basic: 120,
  premium: 300,
} as const;

type AdminAccessPatch = {
  plan?: "free" | "basic" | "premium";
  status?: "active" | "disabled" | "banned";
  role?: "user" | "admin";
};

const PAGE_ONE_USERS = Array.from({ length: 12 }, (_, index) => createAdminUserSummary({
  id: `page-one-user-${index + 1}`,
  name: `Support User ${index + 1}`,
  email: `support-${index + 1}@astral.test`,
  plan: index % 3 === 0 ? "premium" : index % 2 === 0 ? "basic" : "free",
}));

const TARGET_USER_SUMMARY = createAdminUserSummary({
  id: "target-user-1",
  name: "Daniela Support",
  email: "daniela@astral.test",
  plan: "free",
});

const ALL_USERS = [...PAGE_ONE_USERS, TARGET_USER_SUMMARY];

test.describe("Admin support — happy path", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
  });

  test("Support entrypoint stays hidden for non-admin sessions and visible for admins", async ({ page }) => {
    await mockCurrentUser(page, ADMIN_USER_SESSION);
    await page.route("**/api/admin/users**", async (route) => {
      if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/admin/users")) {
        await route.fulfill({
          status: 200,
          json: createAdminUserListResponse([], {
            currentPage: 1,
            pageSize: 12,
            totalItems: 0,
          }),
        });
        return;
      }

      await route.fallback();
    });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Usuarios" })).toBeVisible();

    await page.getByRole("button", { name: "Usuarios" }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { name: "Personas" })).toBeVisible();

    await page.unroute("**/api/me");
    await mockCurrentUser(page, {
      ...ADMIN_USER_SESSION,
      id: "regular-user-1",
      name: "Regular User",
      plan: "free",
      role: "user",
    });

    await page.goto("/");

    await expect(page.getByRole("button", { name: "Usuarios" })).toHaveCount(0);
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
  });

  test("Admin can paginate, search, inspect detail, and save access for another user", async ({ page }) => {
    await mockCurrentUser(page, ADMIN_USER_SESSION);

    const adminListRequests: string[] = [];
    const accessPatches: AdminAccessPatch[] = [];
    let detailLoads = 0;
    let currentDetail = createAdminUserDetail({
      id: "target-user-1",
      name: "Daniela Support",
      email: "daniela@astral.test",
      plan: "free",
      status: "active",
      role: "user",
      support: {
        messagesUsed: 8,
        messageLimit: 20,
        assetCount: 1,
        reportsAvailable: ["free"],
      },
    });

    await page.route("**/api/admin/users**", async (route) => {
      const request = route.request();

      if (request.method() !== "GET" || !isExactPath(request.url(), "/api/admin/users")) {
        await route.fallback();
        return;
      }

      const url = new URL(request.url());
      const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
      const currentPage = Number(url.searchParams.get("page") ?? "1");
      const pageSize = Number(url.searchParams.get("pageSize") ?? "12");
      adminListRequests.push(url.search);

      if (query) {
        const filteredUsers = ALL_USERS.filter((user) =>
          user.name.toLowerCase().includes(query) ||
          (user.email ?? "").toLowerCase().includes(query)
        );

        await route.fulfill({
          status: 200,
          json: createAdminUserListResponse(filteredUsers, {
            currentPage: 1,
            pageSize,
            totalItems: filteredUsers.length,
          }),
        });
        return;
      }

      if (currentPage === 2) {
        await route.fulfill({
          status: 200,
          json: createAdminUserListResponse([TARGET_USER_SUMMARY], {
            currentPage,
            pageSize,
            totalItems: ALL_USERS.length,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        json: createAdminUserListResponse(PAGE_ONE_USERS, {
          currentPage: 1,
          pageSize,
          totalItems: ALL_USERS.length,
        }),
      });
    });

    await page.route("**/api/users/target-user-1", async (route) => {
      if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/users/target-user-1")) {
        detailLoads += 1;
        await route.fulfill({ status: 200, json: currentDetail });
        return;
      }

      await route.fallback();
    });

    await page.route("**/api/admin/users/target-user-1/access", async (route) => {
      if (
        route.request().method() === "PATCH" &&
        isExactPath(route.request().url(), "/api/admin/users/target-user-1/access")
      ) {
        const patch = route.request().postDataJSON() as AdminAccessPatch;
        accessPatches.push(patch);

        const nextPlan = patch.plan ?? currentDetail.plan;

        currentDetail = createAdminUserDetail({
          ...currentDetail,
          ...patch,
          support: {
            ...currentDetail.support,
            messageLimit: MESSAGE_LIMIT_BY_PLAN[nextPlan],
            reportsAvailable: nextPlan === "premium" ? ["free", "premium"] : ["free"],
          },
          updatedAt: "2026-04-20T16:30:00.000Z",
        });

        await route.fulfill({ status: 204 });
        return;
      }

      await route.fallback();
    });

    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "Personas" })).toBeVisible();
    await expect(page.getByText("Mostrando 1-12 de 13 personas")).toBeVisible();
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await expect(page.getByText("Daniela Support")).not.toBeVisible();

    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByText("Mostrando 13-13 de 13 personas")).toBeVisible();
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await expect(page.getByText("Daniela Support")).toBeVisible();
    await expect(page.getByText("daniela@astral.test")).toBeVisible();

    await page.getByLabel("Buscar personas").fill("daniela@astral.test");

    await expect(page.getByText("Mostrando 1-1 de 1 personas")).toBeVisible();
    await expect(page.getByText("Página 2 de 2")).not.toBeVisible();
    await expect(page.getByText("Daniela Support")).toBeVisible();

    await page.getByText("Daniela Support").click();

    await expect(page).toHaveURL(/\/admin\/users\/target-user-1$/);
    await expect(page.getByRole("heading", { name: "Daniela Support" })).toBeVisible();
    await expect(page.getByText("daniela@astral.test")).toBeVisible();
    await expect(page.getByText(/^20$/)).toBeVisible();

    await page.getByLabel("Plan").selectOption("basic");
    await page.getByLabel("Estado").selectOption("disabled");
    await page.getByLabel("Permiso interno").selectOption("admin");

    await expect(page.getByText("Hay cambios listos para guardar")).toBeVisible();

    await page.getByRole("button", { name: "Guardar acceso" }).click();

    await expect(
      page.getByText("Cambios guardados y recargados desde la base actual de Astral."),
    ).toBeVisible();
    await expect(page.getByText("Sin cambios pendientes")).toBeVisible();
    await expect(page.getByText("Acceso pausado")).toBeVisible();
    await expect(page.getByLabel("Plan")).toHaveValue("basic");
    await expect(page.getByLabel("Estado")).toHaveValue("disabled");
    await expect(page.getByLabel("Permiso interno")).toHaveValue("admin");
    await expect(page.getByText(/^120$/)).toBeVisible();

    expect(accessPatches).toEqual([
      {
        plan: "basic",
        status: "disabled",
        role: "admin",
      },
    ]);
    expect(detailLoads).toBeGreaterThanOrEqual(2);
    expect(adminListRequests.some((search) => search.includes("page=2"))).toBe(true);
    expect(adminListRequests.some((search) => search.includes("pageSize=12"))).toBe(true);
    expect(
      adminListRequests.some((search) => search.includes("q=daniela%40astral.test")),
    ).toBe(true);
  });
});
