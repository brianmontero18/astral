import { test, expect } from "@playwright/test";
import { mockChatHistory, mockChatStream, mockTruncate, mockGetUser, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_NO_INTAKE, HISTORY_MESSAGES } from "../helpers/fixtures";

test.describe("Chat — Edit Message", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
  });

  test("Edit button only appears on user messages", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await page.goto("/");
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();

    const editButtons = page.getByRole("button", { name: "Editar mensaje" });
    // Only 2 user messages have edit buttons
    await expect(editButtons).toHaveCount(2);
  });

  test("Clicking edit opens inline textarea with original text", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await page.goto("/");
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();

    await page.getByRole("button", { name: "Editar mensaje" }).first().click();
    const editTextarea = page.getByRole("textbox").first();
    await expect(editTextarea).toHaveValue("Que transitos tengo esta semana?");
  });

  test("Cancel edit restores original message", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await page.goto("/");
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();

    await page.getByRole("button", { name: "Editar mensaje" }).first().click();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
  });

  test("Saving edit truncates subsequent messages", async ({ page }) => {
    await mockTruncate(page);
    await mockChatHistory(page, HISTORY_MESSAGES);
    await mockChatStream(page, ["Nueva respuesta..."], { userMsgId: 20, assistantMsgId: 21 });
    await page.goto("/");
    await expect(page.getByText("Como afecta mi centro Sacral?")).toBeVisible();

    // Edit the first user message
    await page.getByRole("button", { name: "Editar mensaje" }).first().click();
    const editTextarea = page.getByRole("textbox").first();
    await editTextarea.fill("Pregunta editada");
    await page.getByRole("button", { name: "Guardar y enviar" }).click();

    // Subsequent messages should be gone, new response appears
    await expect(page.getByText("Como afecta mi centro Sacral?")).not.toBeVisible();
    await expect(page.getByText("Nueva respuesta...")).toBeVisible();
  });

  test("Edit calls truncate API before re-sending", async ({ page }) => {
    let truncateCalled = false;
    await page.route("**/api/me/messages**", async (route) => {
      if (route.request().method() === "DELETE") {
        truncateCalled = true;
        await route.fulfill({
          status: 200,
          json: {
            deleted: 2,
            plan: "free",
            used: 1,
            limit: 20,
            cycle: "2026-04",
            resetsAt: "2026-05-01T00:00:00-03:00",
          },
        });
      } else if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            messages: HISTORY_MESSAGES,
            plan: "free",
            used: 2,
            limit: 20,
            cycle: "2026-04",
            resetsAt: "2026-05-01T00:00:00-03:00",
          },
        });
      } else {
        await route.fallback();
      }
    });
    await mockChatStream(page, ["Respuesta"], { userMsgId: 20, assistantMsgId: 21 });
    await page.goto("/");
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();

    await page.getByRole("button", { name: "Editar mensaje" }).first().click();
    const editTextarea = page.getByRole("textbox").first();
    await editTextarea.fill("Editado");
    await page.getByRole("button", { name: "Guardar y enviar" }).click();

    await expect(page.getByText("Respuesta")).toBeVisible();
    expect(truncateCalled).toBe(true);
  });

  test("Empty edit text cannot be saved", async ({ page }) => {
    await mockChatHistory(page, HISTORY_MESSAGES);
    await page.goto("/");
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();

    await page.getByRole("button", { name: "Editar mensaje" }).first().click();
    const editTextarea = page.getByRole("textbox").first();
    await editTextarea.fill("");
    const saveBtn = page.getByRole("button", { name: "Guardar y enviar" });
    await expect(saveBtn).toBeDisabled();

    await expect(editTextarea).toHaveValue("");
    await expect(page.getByText("Como afecta mi centro Sacral?")).toBeVisible();
    await expect(page.getByText("Nueva respuesta...")).not.toBeVisible();
  });
});
