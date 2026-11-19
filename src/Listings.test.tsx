import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings } from "./demoListings";
import { ListingCard, ListingsBrowser } from "./Listings";

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
