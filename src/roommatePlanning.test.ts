import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Matches, Preferences } from "./App";
import { demoListingsDataset, getDemoListings, updateDemoListing } from "./demoListings";
import { createDemoRentalDecision, createExternalRentalDecision } from "./rentalDecision";
import {
  createRentalFirstRoommateContext,
  createRoommateFirstContext,
  getRoommateStages,
  type RoommatePlanningContext,
} from "./roommatePlanning";

describe("roommate planning context", () => {
  it("copies the active rental decision and derives the true monthly cost", () => {
    const decision = createExternalRentalDecision({
      label: "Campus apartment",
      neighborhood: "Central City",
      askingRent: 2100,
      bedrooms: 2,
      squareFootage: 940,
      mandatoryRecurringFeeTotal: 200,
      noMandatoryRecurringFees: false,
      moveInDate: "2027-01-05",
    });

    expect(createRentalFirstRoommateContext(decision)).toEqual({
      entryPerspective: "rental-first",
      rental: {
        decisionId: decision.decisionId,
        title: "Campus apartment",
        neighborhood: "Central City",
        advertisedRent: 2100,
        recurringFeeTotal: 200,
        trueMonthlyCost: 2300,
        bedrooms: 2,
      },
    });
  });

  it("creates a roommate-first context without a sample apartment", () => {
    expect(createRoommateFirstContext()).toEqual({
      entryPerspective: "roommate-first",
      rental: null,
    });
  });

  it("uses manager-edited rent and fees instead of the original fixture totals", () => {
    const listings = getDemoListings(demoListingsDataset);
    const source = listings[1];
    const edited = updateDemoListing(listings, source.synthetic.listingId, {
      askingRent: 1500,
      mandatoryRecurringFees: [
        { id: "technology", label: "Technology fee", amount: 50 },
        { id: "trash", label: "Trash service", amount: 25 },
      ],
      updatedAt: "2026-11-19T08:00:00.000Z",
    })[1];

    const context = createRentalFirstRoommateContext(createDemoRentalDecision(edited));

    expect(context.rental).toMatchObject({
      advertisedRent: 1500,
      recurringFeeTotal: 75,
      trueMonthlyCost: 1575,
    });
    expect(source.synthetic.askingRent).toBe(1299);
  });
});

describe("roommate planning stages", () => {
  it("includes cost split only when a rental is already selected", () => {
    const rentalFirst = createRentalFirstRoommateContext(
      createDemoRentalDecision(getDemoListings(demoListingsDataset)[1]),
    );

    expect(getRoommateStages(rentalFirst)).toEqual([
      { screen: "math", label: "Cost split" },
      { screen: "preferences", label: "Living preferences" },
      { screen: "matches", label: "Matches" },
    ]);
    expect(getRoommateStages(createRoommateFirstContext())).toEqual([
      { screen: "preferences", label: "Living preferences" },
      { screen: "matches", label: "Matches" },
    ]);
  });
});

describe("Matches context", () => {
  it("uses current move-in choices instead of expired 2025 dates", () => {
    const html = renderToStaticMarkup(
      createElement(Preferences, {
        context: createRoommateFirstContext(),
        go: () => undefined,
      }),
    );

    expect(html).toContain("December 2026");
    expect(html).toContain("January 2027");
    expect(html).toContain("Flexible");
    expect(html).not.toContain("2025");
  });

  it("keeps roommate-first matches independent from a sample apartment", () => {
    const html = renderToStaticMarkup(
      createElement(Matches, {
        context: createRoommateFirstContext(),
        go: () => undefined,
      }),
    );

    expect(html).toContain("Matches based on your living preferences");
    expect(html).not.toContain("View apartment");
    expect(html).not.toContain("See apartment split");
    expect(html).not.toContain("this apartment");
    expect(html).not.toContain("$2,300");
    expect(html).not.toContain("$1,150 each");
    expect(html).toContain("Back to home");
    expect(html).not.toContain("Back to Decision Receipt");
  });

  it("uses the exact rental title and cost supplied by the handoff", () => {
    const context: RoommatePlanningContext = {
      entryPerspective: "rental-first",
      rental: {
        decisionId: "external-demo-campus",
        title: "Campus apartment",
        neighborhood: "Central City",
        advertisedRent: 2100,
        recurringFeeTotal: 200,
        trueMonthlyCost: 2300,
        bedrooms: 2,
      },
    };

    const html = renderToStaticMarkup(createElement(Matches, { context, go: () => undefined }));

    expect(html).toContain("Campus apartment");
    expect(html).toContain("$2,300/mo total");
    expect(html).toContain("$1,150 each with two");
    expect(html).toContain("Back to Decision Receipt");
    expect(html).not.toContain("Start a new search");
  });
});
