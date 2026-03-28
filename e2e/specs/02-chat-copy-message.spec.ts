import { test, expect } from "@playwright/test";
import { mockChatHistory, mockGetUser, mockHealth } from "../helpers/mock-api";
import { TEST_USER, TEST_USER_NO_INTAKE, HISTORY_MESSAGES } from "../helpers/fixtures";

test.describe("Chat — Copy Message", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript((user) => {
      localStorage.setItem("astral_user", JSON.stringify(user));
    }, TEST_USER);
    await mockHealth(page);
    await mockGetUser(page, TEST_USER_NO_INTAKE);
    await mockChatHistory(page, HISTORY_MESSAGES);
  });

  test("Copy button appears on all messages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    const copyButtons = page.getByRole("button", { name: "Copiar mensaje" });
    await expect(copyButtons).toHaveCount(4);
  });

  test("Clicking copy shows 'Copiado' feedback", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    const firstCopy = page.getByRole("button", { name: "Copiar mensaje" }).first();
    await firstCopy.click();
    await expect(page.getByText("Copiado")).toBeVisible();
  });

  test("Clipboard contains the message text", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    const firstCopy = page.getByRole("button", { name: "Copiar mensaje" }).first();
    await firstCopy.click();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe("Que transitos tengo esta semana?");
  });

  test("Feedback reverts after timeout", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Que transitos tengo esta semana?")).toBeVisible();
    const firstCopy = page.getByRole("button", { name: "Copiar mensaje" }).first();
    await firstCopy.click();
    await expect(page.getByText("Copiado")).toBeVisible();
    await expect(page.getByText("Copiado")).not.toBeVisible({ timeout: 3000 });
  });
});
