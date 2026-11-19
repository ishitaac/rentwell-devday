import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings } from "./demoListings";
import {
  ListingCard,
  ListingDetails,
  ListingsBrowser,
  RentalDecisionDetails,
} from "./Listings";
import {
  createDemoRentalDecision,
  createExternalRentalDecision,
} from "./rentalDecision";

describe("ListingCard", () => {
  it("shows the renter-facing cost and disclosure facts", () => {
    const listing = getDemoListings(demoListingsDataset)[1];

    const html = renderToStaticMarkup(
      <ListingCard listing={listing} onViewDetails={() => undefined} />,
    );

    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toContain("/listings/interior-blue.jpg");
    expect(html).toContain("$1,364");
    expect(html).toContain("True monthly cost");
    expect(html).toContain("Complete fee disclosure");
    expect(html).toContain("View details");
  });
});

describe("ListingsBrowser", () => {
  it("renders different property photos and details through one reusable card", () => {
    const listings = getDemoListings(demoListingsDataset).slice(0, 3);

    const html = renderToStaticMarkup(
      <ListingsBrowser listings={listings} onViewDetails={() => undefined} />,
    );

    expect(html).toContain("Foothill Family Home");
    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toContain("Central City Corner One-Bedroom");
    expect(html).toContain("/listings/townhouse-exterior.jpg");
    expect(html).toContain("/listings/interior-blue.jpg");
    expect(html).toContain("/listings/interior-warm.jpg");
    expect(html.match(/View details/g)).toHaveLength(3);
  });
});

describe("ListingDetails", () => {
  it("shows property facts, the decision receipt, and renter actions", () => {
    const listing = getDemoListings(demoListingsDataset)[1];

    const html = renderToStaticMarkup(
      <ListingDetails
        listing={listing}
        saved={false}
        showCalculation={true}
        onBack={() => undefined}
        onToggleSaved={() => undefined}
        onToggleCalculation={() => undefined}
      />,
    );

    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toMatch(/<strong>1<\/strong> bedroom/);
    expect(html).toMatch(/<strong>550<\/strong> sq ft/);
    expect(html).toContain("Decision Receipt");
    expect(html).toContain("$1,364");
    expect(html).toContain("$2,064");
    expect(html).toContain("Dated RentCast snapshot");
    expect(html).toContain("Pet fee information is not included");
    expect(html).toContain("How we calculated this");
    expect(html).toContain("Save listing");
    expect(html).toContain("Request a tour");
    expect(html).toContain("Back to listings");
  });

  it("changes the disclosure and saved labels from App-owned state", () => {
    const listing = getDemoListings(demoListingsDataset)[1];

    const html = renderToStaticMarkup(
      <ListingDetails
        listing={listing}
        saved
        showCalculation={false}
        onBack={() => undefined}
        onToggleSaved={() => undefined}
        onToggleCalculation={() => undefined}
      />,
    );

    expect(html).toContain("Saved");
    expect(html).toContain("Show calculation");
    expect(html).not.toContain("Advertised rent + mandatory recurring fees");
  });

  it("uses the manager return label when details were opened from the manager workspace", () => {
    const listing = getDemoListings(demoListingsDataset)[1];

    const html = renderToStaticMarkup(
      <ListingDetails
        listing={listing}
        saved={false}
        showCalculation={false}
        backLabel="Back to manager workspace"
        onBack={() => undefined}
        onToggleSaved={() => undefined}
        onToggleCalculation={() => undefined}
      />,
    );

    expect(html).toContain("Back to manager workspace");
    expect(html).not.toContain("Back to listings");
  });
});

describe("RentalDecisionDetails", () => {
  it("keeps full listing details and adds the optional roommate action", () => {
    const listing = getDemoListings(demoListingsDataset)[1];
    const decision = createDemoRentalDecision(listing);

    const html = renderToStaticMarkup(
      <RentalDecisionDetails
        decision={decision}
        saved={false}
        compared={false}
        tourRequested={false}
        showCalculation
        backLabel="Back to listings"
        onBack={() => undefined}
        onToggleSaved={() => undefined}
        onToggleCompared={() => undefined}
        onRequestTour={() => undefined}
        onPlanWithRoommates={() => undefined}
        onToggleCalculation={() => undefined}
      />,
    );

    expect(html).toContain("/listings/interior-blue.jpg");
    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toMatch(/<strong>1<\/strong> bedroom/);
    expect(html).toContain("Amenities");
    expect(html).toContain("Technology fee");
    expect(html).toContain("Within the expected snapshot range");
    expect(html).toContain("Save listing");
    expect(html).toContain("Add to compare");
    expect(html).toContain("Request a tour");
    expect(html).toContain("Plan costs with roommates");
  });

  it("shows an entered rental honestly without unsupported listing details", () => {
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

    const html = renderToStaticMarkup(
      <RentalDecisionDetails
        decision={decision}
        saved={false}
        compared={false}
        tourRequested={false}
        showCalculation={false}
        backLabel="Back to rental entry"
        onBack={() => undefined}
        onToggleSaved={() => undefined}
        onToggleCompared={() => undefined}
        onRequestTour={() => undefined}
        onPlanWithRoommates={() => undefined}
        onToggleCalculation={() => undefined}
      />,
    );

    expect(html).toContain("Rental you entered · Demo analysis");
    expect(html).toContain("Campus apartment");
    expect(html).toContain("Central City");
    expect(html).toMatch(/<strong>2<\/strong> bedrooms/);
    expect(html).toMatch(/<strong>940<\/strong> sq ft/);
    expect(html).toContain("$2,300");
    expect(html).toContain("Move-in cost unavailable");
    expect(html).toContain("Security deposit has not been provided.");
    expect(html).toContain("Save evaluation");
    expect(html).toContain("Plan costs with roommates");
    expect(html).not.toContain("Request a tour");
    expect(html).not.toContain("Add to compare");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("Amenities");
    expect(html).not.toContain("Available ");
  });
});
