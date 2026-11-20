import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings } from "./demoListings";
import { ListingCard, ListingDetails, ListingsBrowser } from "./Listings";

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
});
