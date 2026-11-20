import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RoommateAI } from "./RoommateAI";

describe("RoommateAI entry", () => {
  it("renders the housing step with policy disclosures, fictional labeling and accessible controls", () => {
    const html = renderToStaticMarkup(<RoommateAI onExit={() => undefined} />);
    expect(html).toContain("Describe how you live");
    expect(html).toContain("FICTIONAL ROOMMATES");
    expect(html).toContain("UNVERIFIED");
    expect(html).toContain("RESTRICTED");
    expect(html).toContain("not legal certification");
    expect(html).toContain('aria-label="Find a Roommate progress"');
    expect(html).toContain('for="loc-state"');
    expect(html).not.toContain("gender filter — enabled");
  });
});

describe("navigation integration", () => {
  it("keeps the AI roommate screen under the existing Roommate Planning nav section", async () => {
    const { getNavSection } = await import("./App");
    expect(getNavSection("roommate-ai", "listings")).toBe("roommates");
    expect(getNavSection("matches", "listings")).toBe("roommates");
    expect(getNavSection("listings", "listings")).toBe("listings");
  });
});
