import { expect, Page } from "@playwright/test";
import { TEST_USER } from "./fixtures";
import { mockChatHistory, mockHealth } from "./mock-api";

export async function seedAuthenticatedReportShell(page: Page, user = TEST_USER) {
  await page.addInitScript((currentUser) => {
    localStorage.setItem("astral_user", JSON.stringify(currentUser));
  }, user);
  await mockHealth(page);
  await mockChatHistory(page, []);
}

export async function openReportEntryPoint(page: Page, userName = TEST_USER.name) {
  await page.goto("/");
  await page.getByRole("button", { name: userName }).click();
  await page.getByRole("button", { name: /Generar mi informe/ }).click();
}

export async function openFreshReportIntake(page: Page, userName = TEST_USER.name) {
  await openReportEntryPoint(page, userName);
  await expect(page.getByText("Personalizá tu informe")).toBeVisible();
}

export async function openCachedReport(page: Page, userName = TEST_USER.name) {
  await openReportEntryPoint(page, userName);
  await expect(page.getByText("Informe Personal")).toBeVisible();
}

export async function openReportEditor(page: Page, userName = TEST_USER.name) {
  await openCachedReport(page, userName);
  await page.getByRole("button", { name: /Editar mis respuestas/ }).click();
  await expect(page.getByText("Personalizá tu informe")).toBeVisible();
}

export function acceptNextDialog(page: Page) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

export function dismissNextDialog(page: Page) {
  page.once("dialog", async (dialog) => {
    await dialog.dismiss();
  });
}
