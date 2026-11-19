import { useMemo, useState } from "react";

import rentSnapshotData from "./data/rentcast-slc.json";
import type { DemoListing } from "./demoListings";
import { buildListingDecisionReceipt } from "./listingDecision";
import type { RentSnapshot } from "./rentMarket";

const RENT_SNAPSHOT = rentSnapshotData as RentSnapshot;

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

export function ListingCard({
  listing,
  onViewDetails,
}: {
  listing: DemoListing;
  onViewDetails: (listing: DemoListing) => void;
}) {
  const { synthetic } = listing;
  const receipt = buildListingDecisionReceipt(listing, RENT_SNAPSHOT);

  return (
    <article className="listing-card">
      <img src={synthetic.images[0]} alt={`${synthetic.title} demo property`} />
      <div className="listing-card-body">
        <div className="listing-card-heading">
          <div>
            <span className="listing-demo-tag">SYNTHETIC DEMO</span>
            <h2>{synthetic.title}</h2>
            <p>
              {synthetic.neighborhood} · {synthetic.bedrooms} bd · {synthetic.bathrooms} ba
            </p>
          </div>
        </div>

        <div className="listing-cost-summary">
          <span>True monthly cost</span>
          <strong>{formatMoney(receipt.trueMonthlyCost)}</strong>
          <small>
            {formatMoney(receipt.advertisedRent)} rent + {formatMoney(receipt.recurringFeeTotal)}{" "}
            mandatory fees
          </small>
        </div>

        <div className="listing-card-status">
          <span>Available {formatDate(synthetic.availableDate)}</span>
          <span>Complete fee disclosure</span>
        </div>

        <button className="listing-card-action" onClick={() => onViewDetails(listing)}>
          View details <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

export function ListingsBrowser({
  listings,
  onViewDetails,
}: {
  listings: DemoListing[];
  onViewDetails: (listing: DemoListing) => void;
}) {
  const [query, setQuery] = useState("");
  const filteredListings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return listings;
    return listings.filter(({ synthetic }) =>
      [synthetic.title, synthetic.neighborhood, synthetic.propertyType]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [listings, query]);

  return (
    <main className="listings-page">
      <section className="listings-hero">
        <div>
          <p className="eyebrow">Salt Lake City rentals</p>
          <h1>Find a rental with fewer cost surprises.</h1>
          <p>
            Compare advertised rent with mandatory fees before deciding which home deserves a closer
            look.
          </p>
        </div>
        <span>{listings.length} synthetic demo listings</span>
      </section>

      <section className="listings-controls" aria-label="Rental search controls">
        <label>
          <span>Search listings</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Neighborhood, property, or type"
          />
        </label>
        <div className="listing-filter-pills" aria-label="Available filters">
          <span>Any price</span>
          <span>Any beds</span>
          <span>Any move-in date</span>
          <span>Complete fee disclosure</span>
        </div>
      </section>

      <div className="listings-results-heading">
        <div>
          <h2>{filteredListings.length} rentals match</h2>
          <p>Known mandatory fees are included in the displayed monthly cost.</p>
        </div>
        <span>Demo data only</span>
      </div>

      <section className="listings-grid" aria-label="Rental listings">
        {filteredListings.map((listing) => (
          <ListingCard
            key={listing.synthetic.listingId}
            listing={listing}
            onViewDetails={onViewDetails}
          />
        ))}
      </section>
    </main>
  );
}
