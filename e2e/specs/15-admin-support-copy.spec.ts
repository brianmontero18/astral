import { test, expect, type Page } from "@playwright/test";

import {
  ADMIN_USER_SESSION,
  REGULAR_USER_SESSION,
  createAdminUserDetail,
  isExactPath,
  mockCurrentUser,
} from "../helpers/admin-support";
import { mockHealth } from "../helpers/mock-api";
import { TEST_USER } from "../helpers/fixtures";

test.describe("Admin support — safe copy", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
  });

  test("Non-admin users see a safe denial state on admin routes", async ({ page }) => {
    await mockCurrentUser(page, REGULAR_USER_SESSION);

    await page.goto("/admin/users");

    await expect(page.getByText("Soporte no disponible")).toBeVisible();
    await expect(
      page.getByText("Esta sesión no tiene permisos para abrir el panel interno de usuarios."),
    ).toBeVisible();
    await expect(page.getByText("admin_required")).not.toBeVisible();
    await expect(page.getByText("/api/admin/users")).not.toBeVisible();

    await page.getByRole("button", { name: "Volver al chat" }).click();
    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
  });

  test("Admin list failures show safe copy without leaking backend details", async ({ page }) => {
    await mockCurrentUser(page, ADMIN_USER_SESSION);
    await page.route("**/api/admin/users**", async (route) => {
      await route.fulfill({ status: 403, json: { error: "admin_required" } });
    });

    await page.goto("/admin/users");

    await expect(page.getByText("No se pudo abrir soporte")).toBeVisible();
    await expect(
      page.getByText("Esta sesión dejó de tener permisos para operar el panel de soporte."),
    ).toBeVisible();
    await expect(page.getByText("admin_required")).not.toBeVisible();
    await expect(page.getByText(/Admin users error 403/)).not.toBeVisible();
    await expect(page.getByText("/api/admin/users")).not.toBeVisible();
  });

  test("Admin detail failures show safe copy without leaking backend details", async ({ page }) => {
    await mockCurrentUser(page, ADMIN_USER_SESSION);
    await page.route("**/api/users/missing-user", async (route) => {
      await route.fulfill({ status: 404, json: { error: "User not found" } });
    });

    await page.goto("/admin/users/missing-user");

    await expect(page.getByText("No se pudo abrir el detalle")).toBeVisible();
    await expect(
      page.getByText("No encontramos ese usuario en la base actual de Astral."),
    ).toBeVisible();
    await expect(page.getByText("User not found")).not.toBeVisible();
    await expect(page.getByText(/Admin user detail error 404/)).not.toBeVisible();
  });

  test("Self-mutation stays blocked with safe copy in admin detail", async ({ page }) => {
    await mockCurrentUser(page, ADMIN_USER_SESSION);
    await page.route("**/api/users/admin-user-1", async (route) => {
      await route.fulfill({
        status: 200,
        json: createAdminUserDetail({
          id: "admin-user-1",
          name: "Admin User",
          email: "admin@astral.test",
          plan: "premium",
          role: "admin",
          support: {
            messageLimit: 300,
            reportsAvailable: ["free", "premium"],
          },
        }),
      });
    });

    await page.goto("/admin/users/admin-user-1");

    await expect(
      page.getByText("Esta cuenta es tu propia sesión admin. La autoedición de permisos sigue bloqueada por seguridad."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar acceso" })).toBeDisabled();
    await expect(page.getByText("cannot_modify_self_access")).not.toBeVisible();
  });

  test("Admin access update failures keep safe copy and no raw diagnostics", async ({ page }) => {
    await mockCurrentUser(page, ADMIN_USER_SESSION);
    await page.route("**/api/users/target-user-1", async (route) => {
      await route.fulfill({
        status: 200,
        json: createAdminUserDetail({
          id: "target-user-1",
          name: "Daniela Support",
          email: "daniela@astral.test",
        }),
      });
    });
    await page.route("**/api/admin/users/target-user-1/access", async (route) => {
      await route.fulfill({ status: 403, json: { error: "admin_required" } });
    });

    await page.goto("/admin/users/target-user-1");

    await expect(page.getByText("Daniela Support")).toBeVisible();
    await page.locator("select").nth(0).selectOption("basic");
    await page.getByRole("button", { name: "Guardar acceso" }).click();

    await expect(
      page.getByText("Esta sesión dejó de tener permisos para operar el panel de soporte."),
    ).toBeVisible();
    await expect(page.getByText("admin_required")).not.toBeVisible();
    await expect(page.getByText(/Admin user access update error 403/)).not.toBeVisible();
  });
});
