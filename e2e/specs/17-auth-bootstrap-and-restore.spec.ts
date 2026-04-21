import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

import {
  mockChatHistory,
  mockExtractProfile,
  mockGetUser,
  mockHealth,
  mockUpdateUser,
  mockUploadAsset,
} from "../helpers/mock-api";
import {
  FREE_REPORT,
  HD_PROFILE,
  HISTORY_MESSAGES,
  PREMIUM_REPORT,
  TEST_USER,
  TEST_USER_NO_INTAKE,
} from "../helpers/fixtures";

const CHART_FIXTURE_PATH = path.resolve("test-assets/bodygraph-sources/myhumandesign-chart.pdf");

function buildLinkedUser(plan: "free" | "basic" | "premium") {
  return {
    ...TEST_USER_NO_INTAKE,
    plan,
    role: "user" as const,
    status: "active" as const,
  };
}

async function openProfile(page: Page) {
  await page.getByRole("button", { name: "Test User" }).click();
}

async function expectPlanVisible(page: Page, planLabel: string) {
  await openProfile(page);
  await expect(page.getByText("Plan actual")).toBeVisible();
  await expect(page.getByText(planLabel)).toBeVisible();
}

test.describe("Auth — Bootstrap & Restore", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockChatHistory(page, HISTORY_MESSAGES, { used: 2, limit: 20 });
  });

  test("First linked login without Astral user completes bootstrap, lands in app, and starts as free", async ({ page }) => {
    let bootstrapped = false;

    await mockChatHistory(page, [], { used: 0, limit: 20 });
    await page.route("**/api/me", async (route) => {
      if (route.request().method() !== "GET" || new URL(route.request().url()).pathname !== "/api/me") {
        await route.fallback();
        return;
      }

      if (!bootstrapped) {
        await route.fulfill({
          status: 409,
          json: {
            error: "identity_not_linked",
            provider: "supertokens",
            subject: "st-unlinked-user",
          },
        });
        return;
      }

      await route.fulfill({
        status: 200,
        json: {
          ...buildLinkedUser("free"),
          intake: null,
        },
      });
    });
    await page.route("**/api/users", async (route) => {
      if (route.request().method() !== "POST" || new URL(route.request().url()).pathname !== "/api/users") {
        await route.fallback();
        return;
      }

      bootstrapped = true;
      await route.fulfill({ status: 201, json: { id: "test-user-123" } });
    });
    await mockUploadAsset(page);
    await mockExtractProfile(page, HD_PROFILE);
    await mockUpdateUser(page);

    await page.goto("/");

    await expect(page.getByText("Astral Guide", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "DESCUBRIR MI CARTA" }).click();
    await page.getByPlaceholder("Tu nombre").fill("Test User");
    await page.getByRole("button", { name: "CONTINUAR" }).click();
    await page.locator('input[type="file"]').setInputFiles(CHART_FIXTURE_PATH);
    await page.getByRole("button", { name: "CANALIZAR ENERGÍA" }).click();

    await expect(page.getByText("Tu Identidad Cósmica")).toBeVisible();
    await expect(page.getByText("Tipo HD")).toBeVisible();
    await expect(page.getByText("Generador")).toBeVisible();
    await page.getByRole("button", { name: "EMBARCAR" }).click();

    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
    await expectPlanVisible(page, "Free");
  });

  test("Returning linked free user restores the persisted chat history instead of treating the user as new", async ({ page }) => {
    await mockGetUser(page, buildLinkedUser("free"));
    await page.goto("/");

    await expect(page.getByPlaceholder("Preguntá al oráculo sobre tu semana...")).toBeVisible();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    await expect(page.getByText("Como afecta mi centro Sacral?")).toBeVisible();
    await expect(page.getByText("DESCUBRIR MI CARTA")).not.toBeVisible();
    await expectPlanVisible(page, "Free");
  });

  test("Returning linked basic user restores the basic plan and keeps the report as one surface with locked premium continuation", async ({ page }) => {
    let requestedTier: string | null = null;

    await mockGetUser(page, buildLinkedUser("basic"));
    await page.route("**/api/me/report**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;

      if (request.method() !== "GET" || pathname !== "/api/me/report") {
        await route.fallback();
        return;
      }

      requestedTier = new URL(request.url()).searchParams.get("tier");
      await route.fulfill({ status: 200, json: FREE_REPORT });
    });

    await page.goto("/");

    await expectPlanVisible(page, "Basic");
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByText("Tu Carta Mecánica")).toBeVisible();
    await expect(page.getByText("Cómo trabajás mejor")).toBeVisible();
    await expect(page.getByText("✦ Continuación aplicada del informe")).toBeVisible();
    await expect(page.getByRole("link", { name: "Completar mi informe" })).toBeVisible();
    expect(requestedTier).toBe("free");
  });

  test("Returning linked premium user restores the premium plan and unlocks the premium continuation in place", async ({ page, context }) => {
    let requestedTier: string | null = null;
    let sharedTier: string | null = null;

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockGetUser(page, buildLinkedUser("premium"));
    await page.route("**/api/me/report**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;

      if (request.method() !== "GET" || pathname !== "/api/me/report") {
        await route.fallback();
        return;
      }

      requestedTier = new URL(request.url()).searchParams.get("tier");
      await route.fulfill({ status: 200, json: PREMIUM_REPORT });
    });
    await page.route("**/api/me/report/share", async (route) => {
      if (route.request().method() !== "POST" || new URL(route.request().url()).pathname !== "/api/me/report/share") {
        await route.fallback();
        return;
      }

      const body = route.request().postDataJSON() as { tier?: string };
      sharedTier = body.tier ?? null;
      await route.fulfill({
        status: 200,
        json: { token: "premium-share", url: "http://localhost:3000/api/report/shared/premium-share" },
      });
    });

    await page.goto("/");

    await expectPlanVisible(page, "Premium");
    await page.getByRole("button", { name: /Generar mi informe/ }).click();

    await expect(page.getByText("Informe Personal")).toBeVisible();
    await expect(page.getByRole("button", { name: /Cómo trabajás mejor/ })).toBeVisible();
    await expect(page.getByText("Contenido premium aplicado para cómo trabajás mejor.")).toBeVisible();
    await expect(page.getByText("✦ Continuación aplicada del informe")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Completar mi informe" })).toHaveCount(0);

    const pdfLink = page.getByRole("link", { name: /Descargar PDF/ });
    await expect(pdfLink).toHaveAttribute("href", /tier=premium/);
    await page.getByRole("button", { name: /Compartir/ }).click();
    await expect(page.getByText("✓ Link copiado")).toBeVisible();

    expect(requestedTier).toBe("premium");
    expect(sharedTier).toBe("premium");
  });

  test("Anonymous boot redirects cleanly to the auth surface", async ({ page }) => {
    await page.route("**/api/me", async (route) => {
      if (route.request().method() === "GET" && new URL(route.request().url()).pathname === "/api/me") {
        await route.fulfill({ status: 401, json: { error: "authentication_required" } });
      } else {
        await route.fallback();
      }
    });

    await page.goto("/");

    await page.waitForURL("**/auth**");
    await expect(page.getByText("Sign In")).toBeVisible();
    await expect(page.getByText("Astral Guide", { exact: true })).toBeVisible();
  });

  test("Inactive boot blocks access with friendly copy instead of technical details", async ({ page }) => {
    await page.route("**/api/me", async (route) => {
      if (route.request().method() === "GET" && new URL(route.request().url()).pathname === "/api/me") {
        await route.fulfill({
          status: 403,
          json: {
            error: "account_inactive",
            status: "disabled",
            provider: "supertokens",
            subject: "st-disabled-user",
          },
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto("/");

    await expect(page.getByText("Cuenta deshabilitada")).toBeVisible();
    await expect(page.getByText("Tu cuenta está deshabilitada por ahora. Contactanos para reactivarla.")).toBeVisible();
    await expect(page.getByText("account_inactive")).not.toBeVisible();
    await expect(page.getByText("st-disabled-user")).not.toBeVisible();
  });
});
