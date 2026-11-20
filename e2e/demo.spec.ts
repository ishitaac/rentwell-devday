import { expect, type Page, test } from "@playwright/test";

/** The pitch demo path (spec §2, §13): must work with the network off. */

async function openSample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Read the Fine Print" }).click();
  await page.getByRole("button", { name: "Try the sample lease" }).click();
  await expect(page.getByText("Reading the fine print...")).toBeVisible();
  await expect(page.locator("#fp-hero-title")).toHaveText("The real cost is $2,348 a month. Not $2,100.", { timeout: 8_000 });
}

async function ask(page: Page, question: string) {
  const isMobile = (page.viewportSize()?.width ?? 1280) < 1000;
  if (isMobile && !(await page.locator("#fp-ask.is-open").count())) {
    await page.getByRole("button", { name: "Ask Fine Print" }).click();
  }
  const panel = page.locator("#fp-ask");
  await panel.getByLabel("Your question about the lease").fill(question);
  await panel.getByRole("button", { name: "Ask", exact: true }).click();
  return panel.locator(".fp-answer");
}

test.describe("demo path, network off", () => {
  test.beforeEach(async ({ context }) => {
    await context.route("**/api/**", (route) => route.abort("internetdisconnected"));
  });

  test("sample loads under 8 s with the answer-key numbers", async ({ page }) => {
    await openSample(page);
    await expect(page.locator(".fp-each")).toHaveText("$1,174 each.");
    await expect(page.getByText("Rises to $2,398 in months 7–12")).toBeVisible();
    await expect(page.locator(".fp-subtotals").getByText("$3,648")).toBeVisible();
    await expect(page.locator(".fp-subtotals").getByText("$490")).toBeVisible();
    await expect(page.getByText("AI-generated. Not legal advice. Fictional sample.")).toBeVisible();
  });

  test("estimate toggle adds $70 and occupants update the split", async ({ page }) => {
    await openSample(page);
    await page.getByLabel(/estimated utilities/).check();
    await expect(page.locator("#fp-hero-title")).toContainText("$2,418");
    await page.getByRole("radio", { name: "3" }).click();
    await expect(page.locator(".fp-caution")).toContainText("allows 2 people max");
  });

  test("a § link opens the lease with the exact clause highlighted", async ({ page }) => {
    await openSample(page);
    await page.locator('[data-row]').filter({ hasText: "Reserved parking" }).getByRole("button", { name: "Show § 4.1 in the lease" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.locator(".fp-clause.is-target mark")).toContainText("$100.00");
    await expect(drawer).not.toContainText("FICTIONAL SAMPLE DOCUMENT"); // banner hidden for display
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("Ask lanes still behave offline", async ({ page }) => {
    await openSample(page);
    const pets = await ask(page, "What about pets?");
    await expect(pets).toContainText("No pets are allowed without a signed Pet Addendum.");
    await expect(pets.getByRole("button", { name: "§ 5.1" })).toBeVisible();

    const furnished = await ask(page, "Is it furnished?");
    await expect(furnished).toContainText("Furnishings aren't mentioned in this lease. Worth asking before you sign.");
    await furnished.getByRole("button", { name: "Add to landlord questions" }).click();

    const legal = await ask(page, "Is this late fee even legal?");
    await expect(legal).toContainText("not whether it's enforceable");
    await expect(legal.getByRole("button", { name: "§ 3.3" })).toBeVisible();

    const banana = await ask(page, "I like bananas");
    await expect(banana).toContainText("I only read leases though.");

    const whatIf = await ask(page, "What if we skip parking?");
    await expect(whatIf).toContainText("Without reserved parking: $2,248 a month");
    await expect(page.locator("#fp-hero-title")).toContainText("$2,248");
  });

  test("landlord question list includes questions added from Ask", async ({ page }) => {
    await openSample(page);
    const furnished = await ask(page, "Is it furnished?");
    await furnished.getByRole("button", { name: "Add to landlord questions" }).click();
    if ((page.viewportSize()?.width ?? 1280) < 1000) await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Build my landlord question list" }).click();
    await expect(page.locator(".fp-q-list")).toContainText("Is the unit furnished? What is included? Added from Ask");
  });

  test("pasted text that fails live analysis shows a retry state, not fake results", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Read the Fine Print" }).click();
    await page.getByLabel(/Paste your lease text/).fill("SECTION 1. RENT\n\n1.1 Rent is $900 per month, due on the first of each month.");
    await page.getByRole("button", { name: "Read the fine print" }).click();
    await expect(page.getByRole("alert")).toContainText("couldn't read that lease");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test("no horizontal scroll on any screen", async ({ page }) => {
  await noHorizontalScroll(page);
});

async function noHorizontalScroll(page: Page) {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  const widths: number[] = [];
  widths.push(await page.evaluate(() => document.documentElement.scrollWidth));
  await page.getByRole("button", { name: "Read the Fine Print" }).click();
  widths.push(await page.evaluate(() => document.documentElement.scrollWidth));
  await page.getByRole("button", { name: "Try the sample lease" }).click();
  await expect(page.locator("#fp-hero-title")).toBeVisible({ timeout: 8_000 });
  widths.push(await page.evaluate(() => document.documentElement.scrollWidth));
  const viewport = page.viewportSize()!.width;
  for (const w of widths) expect(w).toBeLessThanOrEqual(viewport);
}
