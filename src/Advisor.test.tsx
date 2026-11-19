import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdvisorHome, DecisionSummary, LeaseAnalysis, TrueHousingCost } from "./Advisor";
import { demoListingsDataset, getDemoListings } from "./demoListings";
import { createDemoRentalDecision } from "./rentalDecision";

const decision = createDemoRentalDecision(getDemoListings(demoListingsDataset)[1]);

describe("Advisor rental context", () => {
  it("identifies the rental whose Decision Receipt opened the Advisor", () => {
    const html = renderToStaticMarkup(<AdvisorHome decision={decision} go={() => undefined} />);

    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toContain("$1,364 true monthly cost");
  });

  it("uses the shared rental costs instead of a second fictional cost calculation", () => {
    const html = renderToStaticMarkup(
      <TrueHousingCost decision={decision} go={() => undefined} />,
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
      />,
    );

    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toContain("6 comparable rentals");
    expect(html).toContain("$1,364");
    expect(html).toContain("Back to Decision Receipt");
    expect(html).toContain("Plan with roommates");
    expect(html).not.toContain("24 sample listings");
    expect(html).not.toContain("View fictional roommate matches");
  });
});
