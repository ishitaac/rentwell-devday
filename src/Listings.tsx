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
  query: controlledQuery,
  onQueryChange,
}: {
  listings: DemoListing[];
  onViewDetails: (listing: DemoListing) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const query = controlledQuery ?? localQuery;
  const setQuery = onQueryChange ?? setLocalQuery;
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

export function ListingDetails({
  listing,
  saved,
  compared = false,
  tourRequested = false,
  showCalculation,
  onBack,
  onToggleSaved,
  onToggleCompared = () => undefined,
  onRequestTour = () => undefined,
  onToggleCalculation,
}: {
  listing: DemoListing;
  saved: boolean;
  compared?: boolean;
  tourRequested?: boolean;
  showCalculation: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
  onToggleCompared?: () => void;
  onRequestTour?: () => void;
  onToggleCalculation: () => void;
}) {
  const { synthetic } = listing;
  const receipt = buildListingDecisionReceipt(listing, RENT_SNAPSHOT);
  const updatedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(receipt.updatedAt));

  return (
    <main className="listing-details-page">
      <button className="listing-back" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to listings
      </button>

      <div className="listing-details-layout">
        <div className="listing-details-main">
          <img
            className="listing-details-image"
            src={synthetic.images[0]}
            alt={`${synthetic.title} demo property`}
          />

          <section className="listing-overview">
            <div className="listing-title-row">
              <div>
                <span className="listing-demo-tag">SYNTHETIC DEMO LISTING</span>
                <h1>{synthetic.title}</h1>
                <p>{synthetic.neighborhood}, Salt Lake City</p>
              </div>
              <span className="listing-available">
                Available {formatDate(synthetic.availableDate)}
              </span>
            </div>

            <div className="listing-facts" aria-label="Property facts">
              <span>
                <strong>{synthetic.bedrooms}</strong>{" "}
                {synthetic.bedrooms === 1 ? "bedroom" : "bedrooms"}
              </span>
              <span>
                <strong>{synthetic.bathrooms}</strong>{" "}
                {synthetic.bathrooms === 1 ? "bathroom" : "bathrooms"}
              </span>
              <span>
                <strong>{synthetic.squareFootage?.toLocaleString("en-US") ?? "—"}</strong> sq ft
              </span>
              <span>
                <strong>{synthetic.propertyType}</strong> type
              </span>
            </div>

            <p className="listing-description">{synthetic.description}</p>

            <div className="listing-info-grid">
              <section>
                <h2>Amenities</h2>
                <ul>
                  {synthetic.amenities.map((amenity) => (
                    <li key={amenity}>{amenity}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h2>Before you tour</h2>
                <dl>
                  <div>
                    <dt>Parking</dt>
                    <dd>Ask manager</dd>
                  </div>
                  <div>
                    <dt>Pet policy</dt>
                    <dd>Not provided</dd>
                  </div>
                  <div>
                    <dt>Utilities</dt>
                    <dd>Confirm included services</dd>
                  </div>
                </dl>
              </section>
            </div>
          </section>
        </div>

        <aside className="decision-receipt" aria-label="Decision Receipt">
          <div className="receipt-heading">
            <div>
              <p className="eyebrow">RentWell analysis</p>
              <h2>Decision Receipt</h2>
            </div>
            <span>{receipt.confidence} confidence</span>
          </div>

          <div className="receipt-primary-cost">
            <span>True monthly cost</span>
            <strong>{formatMoney(receipt.trueMonthlyCost)}</strong>
            <small>Advertised rent plus known mandatory recurring fees</small>
          </div>

          <dl className="receipt-cost-lines">
            <div>
              <dt>Advertised rent</dt>
              <dd>{formatMoney(receipt.advertisedRent)}</dd>
            </div>
            {synthetic.mandatoryRecurringFees.map((fee) => (
              <div key={fee.id}>
                <dt>{fee.label}</dt>
                <dd>{formatMoney(fee.amount)}</dd>
              </div>
            ))}
            {synthetic.noMandatoryRecurringFees && (
              <div>
                <dt>Mandatory recurring fees</dt>
                <dd>$0</dd>
              </div>
            )}
            <div className="receipt-total">
              <dt>Estimated move-in cost</dt>
              <dd>{formatMoney(receipt.estimatedMoveInCost)}</dd>
            </div>
          </dl>

          <section className="fair-rent-result">
            <span>Fair Rent result</span>
            <strong>{receipt.fairRentResult}</strong>
            {receipt.comparison ? (
              <p>
                Snapshot range {formatMoney(receipt.comparison.lower)}–
                {formatMoney(receipt.comparison.upper)} · {receipt.comparison.count} comparable
                rentals
              </p>
            ) : (
              <p>There is not enough snapshot evidence for a numeric comparison.</p>
            )}
          </section>

          <button
            className="calculation-toggle"
            onClick={onToggleCalculation}
            aria-expanded={showCalculation}
          >
            {showCalculation ? "Hide calculation" : "Show calculation"}
            <span aria-hidden="true">{showCalculation ? "−" : "+"}</span>
          </button>
          {showCalculation && (
            <div className="calculation-disclosure">
              <strong>How we calculated this</strong>
              <p>Advertised rent + mandatory recurring fees = true monthly cost.</p>
              <p>{receipt.explanation}</p>
              <small>
                {receipt.sourceLabel} · Updated {updatedDate}
              </small>
            </div>
          )}

          <div className="missing-information" role="note">
            <strong>Information to confirm</strong>
            {receipt.missingInformation.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>

          <div className="listing-detail-actions">
            <button className={saved ? "is-active" : ""} onClick={onToggleSaved}>
              {saved ? "Saved" : "Save listing"}
            </button>
            <button className={compared ? "is-active" : ""} onClick={onToggleCompared}>
              {compared ? "Added to compare" : "Add to compare"}
            </button>
            <button className="primary" onClick={onRequestTour}>
              {tourRequested ? "Tour request noted" : "Request a tour"}
            </button>
          </div>
          {tourRequested && (
            <p className="tour-feedback">Demo only: a manager would receive your tour request.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
