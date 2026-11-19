import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import App, { getAdvisorEntryScreen, getDecisionBackScreen, getNavSection } from "./App";

describe("unified App navigation", () => {
  it("requires a rental decision before opening the Advisor", () => {
    expect(getAdvisorEntryScreen(null)).toBe("rental-entry");
    expect(getAdvisorEntryScreen({ decisionId: "selected" })).toBe("advisor");
  });

  it("exposes renter choices and separates the property-manager role", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Browse Rentals");
    expect(html).toContain("Check Your Rental");
    expect(html).toContain("Roommate Planning");
    expect(html).toContain("AI Advisor");
    expect(html).toContain("How It Works");
    expect(html).toContain("For property managers");
    expect(html).not.toContain("Rental check · Step 1 of 5");
    expect(html).not.toContain("Fair rent analysis · Step 2 of 5");
  });

  it("returns each Decision Receipt to the entrance that opened it", () => {
    expect(getDecisionBackScreen("listings")).toBe("listings");
    expect(getDecisionBackScreen("rental-entry")).toBe("rental-entry");
    expect(getDecisionBackScreen("manager")).toBe("manager");
  });

  it("keeps the roommate section active throughout cost split and matching", () => {
    expect(getNavSection("math", "listings")).toBe("roommates");
    expect(getNavSection("preferences", "rental-entry")).toBe("roommates");
    expect(getNavSection("matches", "manager")).toBe("roommates");
  });
});
