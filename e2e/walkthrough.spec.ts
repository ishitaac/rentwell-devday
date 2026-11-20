import { expect, test, type Page } from "@playwright/test";

/** Walkthrough against the production build with no /api: proves the demo works with the network off. */

const PHOTO = "fixtures/walkthrough/e2e-interior.jpg";

async function openWalkthrough(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "RentWell home" })).toBeVisible();
  const nav = page.getByRole("button", { name: "Walkthrough", exact: true });
  if (!(await nav.isVisible())) await page.getByRole("button", { name: "Open menu" }).click();
  await nav.click();
  await expect(
    page.getByRole("heading", { name: "Touring this place? Check what you can see." }),
  ).toBeVisible();
}

async function startTour(page: Page, demo: boolean, type = /Apartment or condo/) {
  await page.getByRole("button", { name: demo ? "Try the demo tour" : "Start the tour" }).click();
  await page.getByRole("radio", { name: type }).click();
  await page.getByRole("button", { name: "Start the tour" }).click();
}

test("demo tour: sample photo at every stop, quick checks, then condensed results", async ({
  page,
}, info) => {
  await openWalkthrough(page);
  await startTour(page, true);

  await expect(page.getByRole("heading", { name: "Kitchen sink" })).toBeVisible();
  await expect(page.getByText("Water marks or drips")).toBeVisible();
  await page.screenshot({
    path: `test-results/walkthrough-tour-${info.project.name}.png`,
    fullPage: true,
  });

  for (let stop = 0; stop < 6; stop += 1) {
    await page.getByRole("button", { name: "Use sample photo (demo)" }).click();
    const isWindow = await page.getByRole("heading", { name: "Window" }).isVisible();
    await page
      .getByRole("group", { name: /^Quick check/ })
      .getByRole("button", { name: isWindow ? "No" : "Yes", exact: true })
      .click();
    await page.getByRole("button", { name: "Next stop" }).click();
  }
  await expect(page.getByRole("heading", { name: "Anything else?" })).toBeVisible();
  await page
    .getByLabel("What caught your eye? (optional)")
    .fill("Is this outlet cover discolored?");
  await page.getByRole("button", { name: "Use sample photo (demo)" }).click();
  await page.getByRole("button", { name: "See results" }).click();

  await expect(page.getByRole("heading", { name: "Follow-up needed" })).toBeVisible();
  await expect(page.getByRole("note").filter({ hasText: "Sample" }).first()).toBeVisible();
  await expect(page.getByText("1 you noticed")).toBeVisible();
  await expect(page.getByText("Discolored outlet cover")).toBeVisible();
  await expect(page.locator(".wt-compact").first()).toContainText("Window opens and locks");
  const gaps = page.getByRole("heading", { name: /Gaps/ }).locator("..");
  await expect(gaps).toContainText("Appliances");

  const results = (await page.locator(".wt-results").innerText()).toLowerCase();
  expect(results).not.toMatch(/good condition|\bunsafe\b|\bpassed\b|%|★/);
  await page.screenshot({
    path: `test-results/walkthrough-results-${info.project.name}.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: /Ceiling and corners: Priority/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Use your eyes on this box")).toBeVisible();
  await expect(sheet.getByText(/Can't tell from photo/).first()).toBeVisible();
  await page.screenshot({ path: `test-results/walkthrough-sheet-${info.project.name}.png` });
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("see sample results opens instantly with short questions", async ({ page }) => {
  await openWalkthrough(page);
  await page.getByRole("button", { name: "See sample results" }).click();
  await expect(page.getByRole("heading", { name: "Follow-up needed" })).toBeVisible();
  await expect(page.getByText(/Repaint upper right ceiling corner before move-in\?/)).toBeVisible();
  await page.getByRole("button", { name: /standard questions for this type of home/ }).click();
  await expect(page.getByText(/quiet hours/)).toBeVisible();
  await expect(
    page.getByText(/Not an inspection, diagnosis, or safety certification/),
  ).toBeVisible();
});

test("single-family tour starts outside with its own look-fors", async ({ page }) => {
  await openWalkthrough(page);
  await startTour(page, true, /Single-family home/);
  await expect(page.getByRole("heading", { name: "Exterior" })).toBeVisible();
  await expect(page.getByText("Sagging gutters")).toBeVisible();
  await expect(page.getByText("Stop 1 of 7")).toBeVisible();
});

test("a skipped stop shows as a gap with the reason", async ({ page }) => {
  await openWalkthrough(page);
  await startTour(page, true);
  await page.getByRole("button", { name: "Can't access this?" }).click();
  await page.getByRole("button", { name: "Locked" }).click();
  await expect(page.getByRole("heading", { name: "Appliances" })).toBeVisible();
  await page.getByRole("button", { name: "Use sample photo (demo)" }).click();
  for (let i = 0; i < 5; i += 1)
    await page.getByRole("button", { name: /Next stop|Skip for now/ }).click();
  await page.getByRole("button", { name: "See results" }).click();
  await expect(page.getByText("Skipped: Locked")).toBeVisible();
});

test("a real photo that can't be analyzed counts as not checked, never as a pass", async ({
  page,
}) => {
  await openWalkthrough(page);
  await startTour(page, false);
  await page.getByLabel("Take photo").setInputFiles(PHOTO);
  // A real JPEG's base64 starts with "/9j/"; it must still render as an image, not a broken link.
  const thumb = page.locator(".wt-stop-figure img");
  await expect(thumb).toHaveAttribute("src", /^data:image\/jpeg;base64,\/9j\//);
  await expect
    .poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByText(/Couldn't read/)).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 6; i += 1)
    await page.getByRole("button", { name: /Next stop|Skip for now/ }).click();
  await page.getByRole("button", { name: "See results" }).click();
  await expect(
    page.getByRole("heading", { name: "No walkthrough evidence recorded" }),
  ).toBeVisible();
  await expect(page.getByText("No concerns visible in the photos you took.")).toHaveCount(0);
});

test("upload fallback: bulk-picked photos go to a tray and are assigned one by one", async ({
  page,
}) => {
  await openWalkthrough(page);
  await startTour(page, false);
  await page.getByRole("button", { name: "Already toured? Upload photos" }).click();
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
  await page.getByRole("button", { name: "See sample results" }).click();
  await expect(page.getByRole("heading", { name: "Follow-up needed" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ZIP" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^rentwell-walkthrough-\d{4}-\d{2}-\d{2}\.zip$/);
  const saved = test.info().outputPath("record.zip");
  await download.saveAs(saved);

  await page.getByRole("button", { name: "Start a new walkthrough" }).click();
  await page.locator('input[type="file"][accept*="zip"]').setInputFiles(saved);
  await expect(page.getByText(/Saved walkthrough/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Follow-up needed" })).toBeVisible();
  await expect(page.getByText("1 you noticed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download ZIP" })).toHaveCount(0);
});

test("save to profile when signed out: sign in, land on My Plan with it saved, no redo", async ({
  page,
}, info) => {
  await openWalkthrough(page);
  await page.getByRole("button", { name: "See sample results" }).click();
  await expect(page.getByRole("heading", { name: "Follow-up needed" })).toBeVisible();
  await page.getByRole("button", { name: "Save to my profile" }).click();

  await page.getByLabel("Email").fill("renter@example.com");
  await page.getByRole("button", { name: "Continue to demo" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Walkthrough saved to your profile." }),
  ).toBeVisible();
  const card = page.locator(".wt-saved");
  await expect(card).toContainText("Follow-up needed");
  await expect(card).toContainText("Ceiling stain");
  await expect(card).toContainText("Spacious kitchen");
  await page.screenshot({
    path: `test-results/walkthrough-myplan-${info.project.name}.png`,
    fullPage: true,
  });

  // Back in Walkthrough the results are still there, and a signed-in save goes straight through.
  await card.getByRole("button", { name: "Open Walkthrough" }).click();
  await expect(page.getByRole("heading", { name: "Follow-up needed" })).toBeVisible();
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page.locator(".wt-saved")).toContainText("1 earlier walkthrough also saved");
});

test("must-haves: chosen on the picker, reminded at the right stop, shown in results", async ({
  page,
}) => {
  await openWalkthrough(page);
  await startTour(page, true);
  await expect(page.getByText("Your must-have: Spacious kitchen")).toBeVisible();
  await page
    .getByRole("group", { name: "Your must-have: Spacious kitchen" })
    .getByRole("button", { name: "No", exact: true })
    .click();
  for (let i = 0; i < 6; i += 1)
    await page.getByRole("button", { name: /Next stop|Skip for now/ }).click();
  await page.getByRole("button", { name: "See results" }).click();
  const panel = page.getByRole("heading", { name: /Your must-haves/ }).locator("..");
  await expect(panel).toContainText("Spacious kitchen: No");
  await expect(panel).toContainText("Lots of natural light: Not checked");
});
