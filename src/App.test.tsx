import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import App, {
  canViewSavedPlan,
  getAdvisorEntryScreen,
  getAdvisorPlanStatus,
  getDecisionBackScreen,
  getNavSection,
  getPlanSaveDestination,
  getPlanSaveState,
  refreshActiveDecisionFromListings,
} from "./App";
import { demoListingsDataset, getDemoListings, updateDemoListing } from "./demoListings";
import { createDemoRentalDecision } from "./rentalDecision";
import { createDemoSession, type SavedRentalPlan } from "./demoAccount";

describe("unified App navigation", () => {
  it("requires a rental decision before opening the Advisor", () => {
    expect(getAdvisorEntryScreen(null)).toBe("rental-entry");
    expect(getAdvisorEntryScreen({ decisionId: "selected" })).toBe("advisor");
  });

  it("refreshes an active rental decision after a manager saves that listing", () => {
    const listings = getDemoListings(demoListingsDataset);
    const original = listings[1];
    const active = createDemoRentalDecision(original);
    const updated = updateDemoListing(listings, original.synthetic.listingId, {
      askingRent: 1500,
    });

    expect(refreshActiveDecisionFromListings(active, updated)?.askingRent).toBe(1500);
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

  it("opens the property-manager role as a separate app in a new tab", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('class="btn-secondary manager-role-entry"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("returns each Decision Receipt to the entrance that opened it", () => {
    expect(getDecisionBackScreen("listings")).toBe("listings");
    expect(getDecisionBackScreen("rental-entry")).toBe("rental-entry");
  });

  it("keeps the roommate section active throughout cost split and matching", () => {
    expect(getNavSection("math", "listings")).toBe("roommates");
    expect(getNavSection("preferences", "rental-entry")).toBe("roommates");
    expect(getNavSection("matches", "listings")).toBe("roommates");
  });

  it("does not highlight a second renter section on My Plan", () => {
    expect(getNavSection("plan-summary", "listings")).toBe("");
  });

  it("clears reviewed status when the active rental changes", () => {
    expect(getAdvisorPlanStatus("rental-one", "rental-one", null)).toBe("reviewed");
    expect(getAdvisorPlanStatus("rental-two", "rental-one", null)).toBe("not-started");
    expect(getAdvisorPlanStatus("rental-two", null, "rental-two")).toBe("skipped");
  });

  it("save while signed out opens renter access", () => {
    expect(getPlanSaveDestination(null)).toBe("renter-account");
  });

  it("matching demo email saves and restores its plan", () => {
    const plan = makeSavedPlan("renter@example.com");
    const session = createDemoSession("renter@example.com", "renter");

    expect(canViewSavedPlan(session, plan)).toBe(true);
  });

  it("different email cannot view saved details", () => {
    const plan = makeSavedPlan("first@example.com");
    const session = createDemoSession("second@example.com", "renter");

    expect(canViewSavedPlan(session, plan)).toBe(false);
  });

  it("sign out hides plan details without deleting the plan", () => {
    const plan = makeSavedPlan("renter@example.com");

    expect(canViewSavedPlan(null, plan)).toBe(false);
    expect(plan.ownerEmail).toBe("renter@example.com");
  });

  it("storage failure keeps the plan visible with an error", () => {
    expect(getPlanSaveState({ ok: false, error: "Browser storage is unavailable." })).toBe("error");
  });
});

function makeSavedPlan(ownerEmail: string): SavedRentalPlan {
  return {
    version: 1,
    ownerEmail,
    decision: createDemoRentalDecision(getDemoListings(demoListingsDataset)[1]),
    decisionOrigin: "listings",
    roommate: null,
    roommateStatus: "not-started",
    advisorReviewedDecisionId: null,
    advisorStatus: "not-started",
    savedAt: "2026-11-19T18:30:00.000Z",
  };
}
