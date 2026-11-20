import { expect, test } from "@playwright/test";

test("Find a Roommate: onboarding, matching, simulator and fictional negotiator demo", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) apiCalls.push(r.url());
  });

  // Feature flag on: entry point appears on the Living preferences screen.
  await page.goto("/");
  await page.getByRole("button", { name: "Roommate Planning" }).click();
  await page.getByRole("button", { name: "Describe how you live (AI beta)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Describe how you live/ })).toBeVisible();
  await expect(page.getByText("FICTIONAL ROOMMATES")).toBeVisible();

  // Fair-housing safeguards are visible: restricted / unverified behaviors are disabled.
  const policy = page.getByRole("note").filter({ hasText: "Policy check" });
  await expect(policy).toContainText("UNVERIFIED");
  await expect(policy).toContainText("RESTRICTED");
  await expect(policy).not.toContainText("gender filter — enabled");

  // Onboarding.
  await page.getByLabel("State", { exact: true }).fill("UT");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Use an example" }).click();
  await page.getByRole("button", { name: "Find my preferences" }).click();

  // Follow-ups, then confirmation.
  const confirm = page.getByRole("heading", { name: "Confirm your compatibility profile" });
  for (let i = 0; i < 12 && !(await confirm.isVisible()); i++) {
    const next = page.getByRole("button", { name: /I'm done|Review my profile/ });
    if (await next.count()) await next.first().click();
    else await page.waitForTimeout(200);
  }
  await expect(confirm).toBeVisible();
  await page.getByRole("button", { name: /Confirm all/ }).click();

  // Matching (fictional candidates only).
  await expect(page.getByRole("heading", { name: "Your matches" })).toBeVisible();
  await expect(page.getByText(/fictional demo data/)).toBeVisible();

  // Simulator.
  await page.getByRole("button", { name: "See What Living Together Could Look Like" }).and(page.locator(":enabled")).first().click();
  await expect(page.getByRole("heading", { name: "What living together could look like" })).toBeVisible();
  expect(await page.getByRole("tab").count()).toBeGreaterThan(0);
  await page.getByRole("tabpanel").getByRole("button", { pressed: false }).first().click();
  await expect(page.getByRole("status").first()).toBeVisible();
  await page.getByRole("button", { name: "Mark as worth negotiating" }).click();
  await page.getByRole("button", { name: /Negotiate \d+ marked topic|Continue to roommate agreement/ }).click();

  // Fictional negotiator demo: nothing advances without an explicit "Play <name>" press.
  await expect(page.getByText(/DEMO — scripted fictional roommate/)).toBeVisible();
  const start = page.getByRole("button", { name: "Start Roommate Agreement" });
  await expect(start).toBeDisabled();
  await page.getByRole("checkbox").check();
  await start.click();
  await expect(page.getByText(/Invitation sent to/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Topics I'm comfortable discussing" })).toHaveCount(0);
  await page.getByRole("button", { name: /Play .*: accepts/ }).click();
  await expect(page.getByRole("heading", { name: "Topics I'm comfortable discussing" })).toBeVisible();

  // No server calls: Claude endpoints are not used by the UI.
  expect(apiCalls).toEqual([]);
});
