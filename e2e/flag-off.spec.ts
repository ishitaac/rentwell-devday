import { expect, test } from "@playwright/test";

test("without VITE_ROOMMATE_AI the AI entry point is absent and existing flow works", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Roommate Planning" }).click();
  await expect(page.getByRole("button", { name: /Find my matches/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Describe how you live/ })).toHaveCount(0);
});
