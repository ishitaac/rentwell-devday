import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdvisorHome, DecisionSummary, LeaseAnalysis, TrueHousingCost } from "./Advisor";
import { demoListingsDataset, getDemoListings } from "./demoListings";
import { createDemoRentalDecision, createExternalRentalDecision } from "./rentalDecision";

const decision = createDemoRentalDecision(getDemoListings(demoListingsDataset)[1]);

describe("Advisor rental context", () => {
  it("identifies the rental whose Decision Receipt opened the Advisor", () => {
    const html = renderToStaticMarkup(<AdvisorHome decision={decision} go={() => undefined} />);

    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toContain("$1,364 true monthly cost");
  });

  it("uses the shared rental costs instead of a second fictional cost calculation", () => {
    const html = renderToStaticMarkup(
      <TrueHousingCost
        decision={decision}
        go={() => undefined}
        onCompleteReview={() => undefined}
      />,
    );

    expect(html).toContain("$1,299");
    expect(html).toContain("$65");
    expect(html).toContain("$1,364");
    expect(html).toContain("$2,064");
    expect(html).not.toContain("$2,300");
  });

  it("keeps the fictional sample lease current and tied to the selected rent", () => {
    const html = renderToStaticMarkup(<LeaseAnalysis decision={decision} go={() => undefined} />);

    expect(html).toContain("$1,299 / month");
    expect(html).toContain("Jan 1, 2027 through Dec 31, 2027");
    expect(html).not.toContain("2025");
  });

  it("returns the Advisor summary to the shared decision workflow", () => {
    const html = renderToStaticMarkup(
      <DecisionSummary
        decision={decision}
        go={() => undefined}
        onBackToDecision={() => undefined}
        onPlanWithRoommates={() => undefined}
        onAddToPlan={() => undefined}
      />,
    );

    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toContain("6 comparable rentals");
    expect(html).toContain("$1,364");
    expect(html).toContain("Back to Decision Receipt");
    expect(html).toContain("Plan with roommates");
    expect(html).toContain("Add Advisor findings to My Rental Plan");
    expect(html).not.toContain("24 sample listings");
    expect(html).not.toContain("View fictional roommate matches");
  });

  it("preserves cents and marks unknown external-rental evidence as missing", () => {
    const externalDecision = createExternalRentalDecision({
      label: "Three-bedroom rental",
      neighborhood: "Central City",
      askingRent: 1750.49,
      bedrooms: 3,
      squareFootage: 1200,
      mandatoryRecurringFeeTotal: 10.5,
      noMandatoryRecurringFees: false,
      moveInDate: "2027-01-15",
    });
    const costs = renderToStaticMarkup(
      <TrueHousingCost
        decision={externalDecision}
        go={() => undefined}
        onCompleteReview={() => undefined}
      />,
    );
    const summary = renderToStaticMarkup(
      <DecisionSummary
        decision={externalDecision}
        go={() => undefined}
        onBackToDecision={() => undefined}
        onPlanWithRoommates={() => undefined}
        onAddToPlan={() => undefined}
      />,
    );

    expect(costs).toContain("$1,760.99");
    expect(costs).not.toContain("$1,761");
    expect(summary).not.toContain("4 of 7 topics supported");
    expect(summary).toMatch(/Refundable deposit<\/span><em class="missing">Missing/);
  });

  it("marks Advisor review complete only when the summary is reached", () => {
    const html = renderToStaticMarkup(
      <TrueHousingCost
        decision={decision}
        go={() => undefined}
        onCompleteReview={() => undefined}
      />,
    );

    expect(html).toContain("Complete review and view summary");
    expect(html).not.toContain("Advisor review complete");
  });

  it("describes the guided Advisor as a fictional sample instead of uploaded-file analysis", () => {
    const html = renderToStaticMarkup(<AdvisorHome decision={decision} go={() => undefined} />);

    expect(html).toContain("fictional sample lease and the active Decision Receipt");
    expect(html).not.toContain("grounded only in the document you provide");
  });
});
