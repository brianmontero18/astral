import { Buffer } from "node:buffer";
import path from "node:path";

import { test, expect } from "@playwright/test";

import { mockChatHistory, mockGetUser, mockHealth } from "../helpers/mock-api";
import { HD_PROFILE, TEST_USER, TEST_USER_WITH_INTAKE } from "../helpers/fixtures";

const CHART_FIXTURE_PATH = path.resolve("test-assets/bodygraph-sources/myhumandesign-chart.pdf");

const LINKED_USER = {
  ...TEST_USER_WITH_INTAKE,
  plan: "free" as const,
  role: "user" as const,
  status: "active" as const,
};

test.describe("Onboarding & Assets resilience", () => {
  test("Extraction failure shows safe retry copy and lets the user retry cleanly", async ({ page }) => {
    let bootstrapped = false;
    let bootstrapCalls = 0;
    let extractAttempts = 0;

    await mockHealth(page);
    await page.route("**/api/me", async (route) => {
      const pathname = new URL(route.request().url()).pathname;

      if (pathname !== "/api/me") {
        await route.fallback();
        return;
      }

      if (route.request().method() === "PUT") {
        await route.fulfill({ status: 200, json: { ok: true } });
        return;
      }

      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      if (!bootstrapped) {
        await route.fulfill({
          status: 409,
          json: {
            error: "identity_not_linked",
            provider: "supertokens",
            subject: "st-onboarding-retry",
          },
        });
        return;
      }

      await route.fulfill({
        status: 200,
        json: {
          ...LINKED_USER,
          intake: null,
        },
      });
    });
    await page.route("**/api/users", async (route) => {
      if (route.request().method() !== "POST" || new URL(route.request().url()).pathname !== "/api/users") {
        await route.fallback();
        return;
      }

      bootstrapCalls += 1;
      bootstrapped = true;

      if (bootstrapCalls === 1) {
        await route.fulfill({ status: 201, json: { id: "test-user-123" } });
        return;
      }

      await route.fulfill({
        status: 409,
        json: { error: "identity_already_linked", userId: "test-user-123" },
      });
    });
    await page.route("**/api/me/bodygraph", async (route) => {
      if (route.request().method() !== "POST" || new URL(route.request().url()).pathname !== "/api/me/bodygraph") {
        await route.fallback();
        return;
      }

      extractAttempts += 1;

      if (extractAttempts === 1) {
        await route.fulfill({
          status: 502,
          json: { error: "vector store timeout on worker 3" },
        });
        return;
      }

      await route.fulfill({
        status: 201,
        json: {
          user: {
            ...LINKED_USER,
            profile: HD_PROFILE,
            intake: null,
          },
          profile: HD_PROFILE,
          asset: {
            id: "asset-hd-1",
            filename: "chart.pdf",
            mimeType: "application/pdf",
            fileType: "hd",
            sizeBytes: 1024,
            createdAt: "2026-03-28T09:00:00.000Z",
            isActive: true,
          },
        },
      });
    });
    await page.goto("/");

    await page.getByRole("button", { name: "DESCUBRIR MI CARTA" }).click();
    await page.getByPlaceholder("Tu nombre").fill("Test User");
    await page.getByRole("button", { name: "CONTINUAR" }).click();
    await page.locator('input[type="file"]').setInputFiles(CHART_FIXTURE_PATH);
    await page.getByRole("button", { name: "CANALIZAR ENERGÍA" }).click();

    await expect(page.getByText("No pudimos leer tu carta ahora. Reintentá con otro PDF o probá de nuevo.")).toBeVisible();
    await expect(page.getByText("vector store timeout on worker 3")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Sincronizá tu energía" })).toBeVisible();
    await expect(page.getByText("chart.pdf")).toBeVisible();

    await page.getByRole("button", { name: "CANALIZAR ENERGÍA" }).click();

    await expect(page.getByText("Esto es lo que leímos")).toBeVisible();
    await expect(page.getByText("No pudimos leer tu carta ahora. Reintentá con otro PDF o probá de nuevo.")).toHaveCount(0);
  });

  test.describe("Assets", () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((user) => {
        localStorage.setItem("astral_user", JSON.stringify(user));
      }, TEST_USER);
      await mockHealth(page);
      await mockChatHistory(page, []);
      await mockGetUser(page, LINKED_USER);
    });

    test("Bodygraph replacement flow covers empty state, upload, active marker, preview, close and delete", async ({ page }) => {
      const state = {
        assets: [] as Array<{
          id: string;
          filename: string;
          mimeType: string;
          fileType: string;
          sizeBytes: number;
          createdAt: string;
          isActive?: boolean;
        }>,
      };

      await page.route("**/api/me/assets", async (route) => {
        const pathname = new URL(route.request().url()).pathname;

        if (pathname !== "/api/me/assets") {
          await route.fallback();
          return;
        }

        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { assets: state.assets } });
          return;
        }
        await route.fallback();
      });
      await page.route("**/api/me/bodygraph", async (route) => {
        if (route.request().method() !== "POST" || new URL(route.request().url()).pathname !== "/api/me/bodygraph") {
          await route.fallback();
          return;
        }

        const createdAsset = {
          id: "asset-1",
          filename: "mi-carta.pdf",
          mimeType: "application/pdf",
          fileType: "hd",
          sizeBytes: 1024,
          createdAt: "2026-03-28T09:00:00.000Z",
          isActive: true,
        };
        state.assets = [createdAsset];
        await route.fulfill({
          status: 201,
          json: {
            user: {
              ...LINKED_USER,
              profile: HD_PROFILE,
            },
            profile: HD_PROFILE,
            asset: createdAsset,
          },
        });
      });
      await page.route("**/api/assets/asset-1", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/pdf",
            body: "%PDF-1.4 test",
          });
          return;
        }

        if (route.request().method() === "DELETE") {
          state.assets = [];
          await route.fulfill({ status: 200, json: { ok: true } });
          return;
        }

        await route.fallback();
      });
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });

      await page.goto("/");
      await page.getByRole("button", { name: "Mis Cartas" }).click();

      await expect(page.getByText("Tu biblioteca está vacía")).toBeVisible();

      await page.locator('input[type="file"]').setInputFiles({
        name: "mi-carta.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 test"),
      });

      await expect(page.getByText("mi-carta.pdf")).toBeVisible();
      await expect(page.getByText("En uso")).toBeVisible();
      await page.getByRole("button", { name: /^Abrir/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog").getByText("mi-carta.pdf")).toBeVisible();

      await page.getByLabel("Cerrar vista previa").click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.getByRole("button", { name: /^Quitar/ }).click();
      // The delete confirm modal frames the action positively (\"¿Quitar este
      // archivo?\") with a permanence cue — checking both ensures the copy
      // doesn't accidentally regress to the old \"No se puede deshacer\"
      // language that read like the operation was unavailable.
      await expect(page.getByRole("dialog")).toContainText("¿Quitar este archivo?");
      await expect(page.getByRole("dialog")).toContainText("Esta acción es permanente");
      await page.getByRole("button", { name: /Sí, quitar/ }).click();
      await expect(page.getByText("Tu biblioteca está vacía")).toBeVisible();
    });

    test("Validation failures keep the asset surface usable", async ({ page }) => {
      let uploadAttempt = 0;

      await page.route("**/api/me/assets", async (route) => {
        if (route.request().method() === "GET" && new URL(route.request().url()).pathname === "/api/me/assets") {
          await route.fulfill({ status: 200, json: { assets: [] } });
          return;
        }

        await route.fallback();
      });
      await page.route("**/api/me/bodygraph", async (route) => {
        if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/api/me/bodygraph") {
          uploadAttempt += 1;

          if (uploadAttempt === 1) {
            await route.fulfill({
              status: 400,
              json: { error: "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas." },
            });
            return;
          }

          await route.fulfill({
            status: 400,
            json: { error: "File exceeds 10MB limit" },
          });
          return;
        }

        await route.fallback();
      });

      await page.goto("/");
      await page.getByRole("button", { name: "Mis Cartas" }).click();

      await page.locator('input[type="file"]').setInputFiles({
        name: "mi-carta.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("bad"),
      });
      await expect(page.getByText("Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas.")).toBeVisible();
      await expect(page.getByRole("button", { name: /Reemplazar carta activa/i })).toBeVisible();

      await page.locator('input[type="file"]').setInputFiles({
        name: "mi-carta-grande.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF"),
      });
      await expect(page.getByText("El archivo supera el límite de 10 MB.")).toBeVisible();
      await expect(page.getByText("Tu biblioteca está vacía")).toBeVisible();
    });

    test("Preview, forbidden and missing failures stay friendly and keep the surface usable", async ({ page }) => {
      let deleteAttempt = 0;

      await page.route("**/api/me/assets", async (route) => {
        if (route.request().method() === "GET" && new URL(route.request().url()).pathname === "/api/me/assets") {
          await route.fulfill({
            status: 200,
            json: {
              assets: [
                {
                  id: "asset-problem",
                  filename: "bloqueada.txt",
                  mimeType: "text/plain",
                  fileType: "natal",
                  sizeBytes: 12,
                  createdAt: "2026-03-28T09:00:00.000Z",
                },
              ],
            },
          });
          return;
        }

        await route.fallback();
      });
      await page.route("**/api/assets/asset-problem", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 404,
            json: { error: "Asset not found" },
          });
          return;
        }

        if (route.request().method() === "DELETE") {
          deleteAttempt += 1;

          if (deleteAttempt === 1) {
            await route.fulfill({
              status: 403,
              json: { error: "asset_forbidden" },
            });
            return;
          }

          await route.fulfill({
            status: 404,
            json: { error: "Asset not found" },
          });
          return;
        }

        await route.fallback();
      });
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });

      await page.goto("/");
      await page.getByRole("button", { name: "Mis Cartas" }).click();

      await page.getByRole("button", { name: /^Abrir/ }).click();
      await expect(page.getByText("No pudimos mostrar este archivo ahora.")).toBeVisible();
      await page.getByLabel("Cerrar vista previa").click();

      await page.getByRole("button", { name: /^Quitar/ }).click();
      await page.getByRole("button", { name: /Sí, quitar/ }).click();
      await expect(page.getByText("No tenés acceso a este archivo.")).toBeVisible();
      await expect(page.getByText("asset_forbidden")).not.toBeVisible();

      await page.getByRole("button", { name: /^Quitar/ }).click();
      await page.getByRole("button", { name: /Sí, quitar/ }).click();
      await expect(page.getByText("Ese archivo ya no está disponible.")).toBeVisible();
      await expect(page.getByText("Asset not found")).not.toBeVisible();
      await expect(page.getByRole("button", { name: /Reemplazar carta activa/i })).toBeVisible();
    });
  });
});
