import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow } from "../helpers/layout";

// La home de marketing es pública: la ruta /home saltea el bootstrap de auth,
// así que no necesita sesión ni mocks de API. Smoke estructural + layout +
// scroll-reveal.

const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

const SECTION_HEADINGS = [
  "Diseño Humano, pero aplicado",
  "El Sistema",
  "Creado por una mentora y un constructor",
  "Cómo funciona",
  "Informe Premium",
  "Planes",
];

test.describe("Marketing Home — Desktop", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("renders the hero and every section heading", async ({ page }) => {
    await page.goto("/home");

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
    await page.goto("/home");
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await expectNoHorizontalOverflow(page);
  });

  test("scroll-reveal brings below-the-fold sections fully into view", async ({ page }) => {
    await page.goto("/home");

    // El encabezado de Planes arranca translúcido (opacity 0) y el
    // IntersectionObserver lo lleva a opacity 1 al entrar al viewport.
    const heading = page.locator("#planes .mkt-section-head");
    await heading.scrollIntoViewIfNeeded();

    await expect(heading).toHaveCSS("opacity", "1");
  });
});
