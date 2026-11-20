import { expect, test, type Page } from "@playwright/test";

/** Walkthrough against the production build with no /api: proves the demo works with the network off. */

const PHOTO = "fixtures/walkthrough/e2e-interior.jpg";

async function openWalkthrough(page: Page) {
  await page.goto("/");
  const nav = page.getByRole("button", { name: "Walkthrough", exact: true });
  if (!(await nav.isVisible())) await page.getByRole("button", { name: "Open menu" }).click();
  await nav.click();
  await expect(
    page.getByRole("heading", { name: "Touring this place? Check what you can see." }),
  ).toBeVisible();
}

test("sample walkthrough shows status, caps, gaps, and questions offline", async ({
  page,
}, info) => {
  await openWalkthrough(page);
  await page.getByRole("button", { name: "See a sample" }).click();
  await expect(page.getByRole("heading", { name: "Follow-up needed" })).toBeVisible();
  await expect(page.getByRole("note").filter({ hasText: "Sample" }).first()).toBeVisible();
  await expect(page.getByText("Low confidence: needs a closer photo.")).toBeVisible();
  await expect(page.getByText("5 of 6 shots checked")).toBeVisible();
  const gaps = page.locator(".wt-gaps");
  await expect(gaps).toContainText("Kitchen appliances");
  await expect(page.getByText(/Can we add a move-in condition report/)).toBeVisible();
  await expect(page.getByText(/quiet hours/)).toBeVisible();
  await expect(
    page.getByText(/Not an inspection, diagnosis, or safety certification/),
  ).toBeVisible();
  const body = (await page.locator(".wt-results").innerText()).toLowerCase();
  expect(body).not.toMatch(/good condition|\bunsafe\b|\bpassed\b|%|★/);
  await page.screenshot({
    path: `test-results/walkthrough-sample-${info.project.name}.png`,
    fullPage: true,
  });
});

test("switching home type changes the shot list and clears slots after confirming", async ({
  page,
}) => {
  await openWalkthrough(page);
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("radio", { name: /Single-family home/ }).click();
  await page.getByRole("button", { name: "Show the shot list" }).click();
  await expect(page.getByText("Yard and ground next to the foundation")).toBeVisible();
  await expect(page.getByText("Kitchen appliances (stove, fridge)")).toHaveCount(0);

  await page.getByLabel("Photo for Front and side exterior").setInputFiles(PHOTO);
  await expect(page.getByText("1 photo ready")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Change home type" }).click();
  await page.getByRole("radio", { name: /Apartment or condo/ }).click();
  await page.getByRole("button", { name: "Show the shot list" }).click();
  await expect(page.getByText("Floor along a wall")).toBeVisible();
  await expect(page.getByText("0 photos ready")).toBeVisible();
});

test("a photo that cannot be analyzed counts as not checked, never as a pass", async ({
  page,
}, info) => {
  await openWalkthrough(page);
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Show the shot list" }).click();
  await page
    .getByLabel("Photo for Ceiling and upper wall corners in the main room")
    .setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Analyze photos" }).click();
  await expect(
    page.getByRole("heading", { name: "No walkthrough evidence recorded" }),
  ).toBeVisible();
  await expect(page.getByText(/Could not analyze/).first()).toBeVisible();
  await expect(page.getByText("No concerns visible in the photos you took.")).toHaveCount(0);
  await expect(
    page.getByText(/Can I see the kitchen sink and under-sink cabinet before I sign\?/),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/walkthrough-failed-${info.project.name}.png`,
    fullPage: true,
  });
});

test("bulk-picked photos go to a tray and are assigned one by one", async ({ page }) => {
  await openWalkthrough(page);
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Show the shot list" }).click();
  await page.locator('input[type="file"][multiple]').setInputFiles([PHOTO, PHOTO]);
  const selects = page.locator(".wt-tray-item select");
  await expect(selects).toHaveCount(2);
  await selects.first().selectOption({ label: "A window and its frame" });
  await expect(selects).toHaveCount(1);
  await expect(page.getByText("1 photo ready")).toBeVisible();
});

test("a saved walkthrough downloads as a ZIP and reopens view-only", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "download flow checked once");
  await openWalkthrough(page);
  await page.getByRole("button", { name: "See a sample" }).click();
  await expect(page.getByRole("heading", { name: "Follow-up needed" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save walkthrough (.zip)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^rentwell-walkthrough-\d{4}-\d{2}-\d{2}\.zip$/);
  const saved = test.info().outputPath("record.zip");
  await download.saveAs(saved);

  await page.getByRole("button", { name: "Start a new walkthrough" }).click();
  await page.locator('input[type="file"][accept*="zip"]').setInputFiles(saved);
  await expect(page.getByText(/Saved walkthrough/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Follow-up needed" })).toBeVisible();
  await expect(page.getByText(/Agent said the stain/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save walkthrough (.zip)" })).toHaveCount(0);
});
