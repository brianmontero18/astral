import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow } from "../helpers/layout";

// La landing es pública: la ruta /landing saltea el bootstrap de auth, así que
// no necesita sesión ni mocks de API. Smoke estructural + layout + scroll-reveal.

const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

const SECTION_HEADINGS = [
  "Diseño Humano, pero aplicado",
  "El Sistema",
  "Creado por una mentora y un constructor",
  "Cómo funciona",
  "Informe Premium",
  "Planes",
];

test.describe("Landing — Desktop", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("renders the hero and every section heading", async ({ page }) => {
    await page.goto("/landing");

    await expect(
      page.getByRole("heading", { level: 1, name: "Astral Guide" }),
    ).toBeVisible();

    for (const heading of SECTION_HEADINGS) {
      // level 2 evita ambigüedad con títulos h3 (p. ej. "Informe Premium"
      // existe como feature del Sistema y como encabezado de sección).
      await expect(
        page.getByRole("heading", { level: 2, name: heading }),
      ).toBeVisible();
    }

    await expect(
      page.getByRole("button", { name: "Empezar mi lectura" }),
    ).toBeEnabled();
    await expect(page.getByRole("button", { name: "Acceso" })).toBeEnabled();
  });

  test("has no horizontal overflow at desktop and mobile widths", async ({ page }) => {
    await page.goto("/landing");
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoHorizontalOverflow(page);
  });

  test("scroll-reveal marks sections visible as they enter the viewport", async ({ page }) => {
    await page.goto("/landing");

    const heading = page.locator("#planes .lp-section-head");
    await heading.scrollIntoViewIfNeeded();

    // El IntersectionObserver agrega .lp-in → translate a 0 y opacity a 1.
    await expect(heading).toHaveClass(/lp-in/);
    await expect(heading).toHaveCSS("opacity", "1");
  });
});
