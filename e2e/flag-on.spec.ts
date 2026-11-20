import { expect, test } from "@playwright/test";

import { reachJordanChat, say } from "./helpers";

const LATE = "How about quiet hours start at 11:30 PM on weeknights?";

test("full journey: flag, safeguards, onboarding, matching, simulator, then chat with a fictional AI roommate (scripted fallback)", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) apiCalls.push(r.url());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Roommate Planning" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Describe how you live/ })).toBeVisible();
  await expect(page.getByText("FICTIONAL ROOMMATES")).toBeVisible();
  const policy = page.locator('[role="note"]').filter({ hasText: "Policy check" });
  await expect(policy).toContainText("UNVERIFIED");
  await expect(policy).toContainText("RESTRICTED");
  await expect(policy).not.toContainText("gender filter — enabled");

  await reachJordanChat(page);

  // No manual "Play <name>" buttons anywhere.
  await expect(page.getByRole("button", { name: /^Play / })).toHaveCount(0);
  await expect(page.getByText(/Replies: scripted/)).toBeVisible();

  // Jordan is not a yes-man: a late quiet-hours proposal is countered, and the state machine records it.
  await say(page, LATE);
  const log = page.getByRole("log", { name: "Conversation with Jordan" });
  await expect(log).toContainText("FICTIONAL AI");
  await expect(log).toContainText("Scripted fallback");
  await expect(log).toContainText("10 PM");
  await expect(log).toContainText("Simulated: Jordan (fictional) countered");
  await expect(page.getByText("accepted by one", { exact: false }).first()).toBeVisible();

  // You decide for yourself: accept Jordan's counter -> agreed by both.
  await page.getByRole("button", { name: "I accept" }).first().click();
  await expect(page.getByText("1 of 1 terms agreed by both")).toBeVisible();

  // Summary is clearly simulated; Jordan's approval follows automatically but is labeled as simulated.
  await page.getByRole("button", { name: "Review Shared Household Expectations" }).click();
  await expect(page.getByText(/SIMULATED DEMO SUMMARY/)).toBeVisible();
  await page.getByRole("button", { name: "I approve this version" }).click();
  await expect(page.getByRole("status").filter({ hasText: "simulated" }).first()).toContainText("Both of you approved this version");

  expect(apiCalls).toEqual([]); // no presenter code: nothing is sent to any server
});

test("live AI path: presenter code enables Claude replies, labeled as AI, with the state machine in charge", async ({ page }) => {
  const seen: Array<{ code: string | undefined; body: Record<string, unknown> }> = [];
  await page.route("**/api/roommate-demo", async (route) => {
    const req = route.request();
    seen.push({ code: req.headers()["x-demo-code"], body: req.postDataJSON() });
    await route.fulfill({ json: { source: "ai", fictional: true, reply: { message: "10 PM works for me. I'm usually winding down by then.", stance: "accept", topic: "quiet-hours", proposalText: "Quiet hours start at 10 PM on weeknights.", counterText: null, overridden: false } } });
  });

  await reachJordanChat(page);
  await page.getByLabel("Presenter access code (optional)").fill("demo-access-code-123");
  await say(page, "How about quiet hours start at 10 PM on weeknights?");

  const log = page.getByRole("log", { name: "Conversation with Jordan" });
  await expect(log).toContainText("Claude");
  await expect(log).toContainText("FICTIONAL AI");
  await expect(log).toContainText("10 PM works for me");
  await expect(log).toContainText("Simulated: Jordan (fictional) accepted it. This is not real consent.");
  await expect(page.getByText("Replies: Claude (live AI)")).toBeVisible();
  await expect(page.getByText("accepted by one", { exact: false }).first()).toBeVisible();

  expect(seen).toHaveLength(1);
  expect(seen[0].code).toBe("demo-access-code-123");
  expect(seen[0].body.personaId).toBe("demo-jordan");
  expect(JSON.stringify(seen[0].body)).not.toContain("demo-access-code-123");
});

test("API outage: falls back to the scripted roommate and says so", async ({ page }) => {
  await page.route("**/api/roommate-demo", (route) => route.fulfill({ status: 500, json: { error: { code: "upstream" } } }));
  await reachJordanChat(page);
  await page.getByLabel("Presenter access code (optional)").fill("demo-access-code-123");
  await say(page, LATE);
  const log = page.getByRole("log", { name: "Conversation with Jordan" });
  await expect(log).toContainText("Scripted fallback");
  await expect(log).toContainText("10 PM");
  await expect(page.getByText("Replies: scripted fallback (live AI unavailable)")).toBeVisible();
});
