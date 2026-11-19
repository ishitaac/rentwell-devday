import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RentalPlanSummary, type RentalPlanSummaryProps } from "./RentalPlan";
import type { RoommateSelection } from "./demoAccount";
import { demoListingsDataset, getDemoListings } from "./demoListings";
import { createDemoRentalDecision, createExternalRentalDecision } from "./rentalDecision";

const decision = createDemoRentalDecision(getDemoListings(demoListingsDataset)[1]);
const roommate: RoommateSelection = {
  profileId: "maya-chen",
  displayName: "Maya Chen",
  compatibilityScore: 92,
  decisionId: decision.decisionId,
};

const baseProps: RentalPlanSummaryProps = {
  decision,
  roommate,
  roommateStatus: "selected",
  advisorStatus: "reviewed",
  savedAt: "2026-11-19T18:30:00.000Z",
  saveState: "saved",
  onViewReceipt: () => undefined,
  onChangeRental: () => undefined,
  onExploreRoommates: () => undefined,
  onChangeRoommate: () => undefined,
  onReviewAdvisor: () => undefined,
  onViewAdvisor: () => undefined,
  onSkipRoommate: () => undefined,
  onSkipAdvisor: () => undefined,
  onSave: () => undefined,
  onContinueWithoutSaving: () => undefined,
};

function render(overrides: Partial<RentalPlanSummaryProps> = {}) {
  return renderToStaticMarkup(<RentalPlanSummary {...baseProps} {...overrides} />);
}

describe("RentalPlanSummary", () => {
  it("shows one apartment roommate and advisor decision summary", () => {
    const html = render();

    expect(html).toContain("My Rental Plan");
    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toContain("Maya Chen");
    expect(html).toContain("Advisor review complete");
    expect(html).toContain("Saved in this browser");
  });

  it("derives the roommate share from the active receipt", () => {
    const html = render();

    expect(html).toContain("$682");
    expect(html).toContain("Estimated monthly share each");
    expect(html).not.toContain("$700 each");
  });

  it("shows useful actions when optional steps are not started", () => {
    const html = render({
      roommate: null,
      roommateStatus: "not-started",
      advisorStatus: "not-started",
      savedAt: null,
      saveState: "idle",
    });

    expect(html).toContain("Explore roommate matches");
    expect(html).toContain("Review with Advisor");
    expect(html).toContain("Skip roommate step");
    expect(html).toContain("Skip Advisor step");
    expect(html).toContain("Save my plan");
  });

  it("distinguishes skipped steps from completed steps", () => {
    const html = render({
      roommate: null,
      roommateStatus: "skipped",
      advisorStatus: "skipped",
      savedAt: null,
      saveState: "idle",
    });

    expect(html).toContain("Roommate step skipped");
    expect(html).toContain("Advisor step skipped");
    expect(html).not.toContain("Advisor review complete");
  });

  it("keeps an unknown external deposit unconfirmed", () => {
    const externalDecision = createExternalRentalDecision({
      label: "Campus apartment",
      neighborhood: "Central City",
      askingRent: 1500,
      bedrooms: 2,
      squareFootage: 900,
      mandatoryRecurringFeeTotal: 45,
      noMandatoryRecurringFees: false,
      moveInDate: "2027-01-15",
    });
    const html = render({
      decision: externalDecision,
      roommate: null,
      roommateStatus: "not-started",
    });

    expect(html).toContain("Move-in cost needs confirmation");
    expect(html).toContain("Deposit not provided");
    expect(html).not.toContain("$3,045");
  });
});
