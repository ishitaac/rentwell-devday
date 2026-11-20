import { expect, type Page } from "@playwright/test";

/** Onboarding -> matches -> simulator (Jordan) -> "Talk to Jordan" -> consent/start -> open the quiet-hours topic. */
export async function reachJordanChat(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Roommate Planning" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Use an example" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const confirm = page.getByRole("heading", { name: "Review your preferences" });
  for (let i = 0; i < 12 && !(await confirm.isVisible()); i++) {
    const next = page.getByRole("button", { name: /I'm done|Review my profile/ });
    if (await next.count()) await next.first().click();
    else await page.waitForTimeout(200);
  }
  await expect(confirm).toBeVisible();
  await page.getByRole("button", { name: "See matches" }).click();

  await expect(page.getByRole("heading", { name: "Your matches" })).toBeVisible();
  const jordan = page.locator("article.rai-match").filter({ hasText: "Jordan (fictional)" });
  await jordan.getByRole("button", { name: "Try a day together" }).click();

  await expect(page.getByRole("heading", { name: "What living together could look like" })).toBeVisible();
  await page.getByRole("button", { name: "Talk to Jordan" }).click();

  await expect(page.getByText(/DEMO — AI-simulated fictional roommate/)).toBeVisible();
  const start = page.getByRole("button", { name: "Start Roommate Agreement" });
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox").check();
  await start.click();
  await expect(page.getByRole("heading", { name: "Chat with Jordan (fictional AI roommate)" })).toBeVisible();

  const chip = page.getByRole("button", { name: "Quiet hours", exact: true });
  if ((await chip.getAttribute("aria-pressed")) !== "true") await chip.click();
  await page.getByRole("button", { name: "Save my topics" }).click();
}

export async function say(page: Page, text: string) {
  await page.getByLabel("Message to Jordan").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}
