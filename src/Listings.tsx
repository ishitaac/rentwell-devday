import { useEffect, useMemo, useState } from "react";

import rentSnapshotData from "./data/rentcast-slc.json";
import type { DemoListing } from "./demoListings";
import {
  DEFAULT_LISTING_FILTERS,
  filterListings,
  hasActiveListingFilters,
  type ListingBedroomFilter,
  type ListingFilters,
  type ListingPriceFilter,
} from "./listingFilters";
import { buildListingDecisionReceipt, buildRentalDecisionReceipt } from "./listingDecision";
import { createDemoRentalDecision, type RentalDecisionRecord } from "./rentalDecision";
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
  showAction = true,
}: {
  listing: DemoListing;
  onViewDetails: (listing: DemoListing) => void;
  showAction?: boolean;
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

        {showAction && (
          <button className="listing-card-action" onClick={() => onViewDetails(listing)}>
            View details <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function ListingsBrowser({
  listings,
  onViewDetails,
  query: controlledQuery,
  onQueryChange,
  filters: controlledFilters,
  onFiltersChange,
}: {
  listings: DemoListing[];
  onViewDetails: (listing: DemoListing) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  filters?: ListingFilters;
  onFiltersChange?: (filters: ListingFilters) => void;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [localFilters, setLocalFilters] = useState<ListingFilters>(DEFAULT_LISTING_FILTERS);
  const [visibleCount, setVisibleCount] = useState(6);
  const query = controlledQuery ?? localQuery;
  const setQuery = onQueryChange ?? setLocalQuery;
  const filters = controlledFilters ?? localFilters;
  const setFilters = onFiltersChange ?? setLocalFilters;
  const filteredListings = useMemo(
    () => filterListings(listings, query, filters),
    [filters, listings, query],
  );
  const visibleListings = filteredListings.slice(0, visibleCount);
  const hasMoreListings = visibleCount < filteredListings.length;
  const filtersAreActive = hasActiveListingFilters(query, filters);
  const updateFilter = <Key extends keyof ListingFilters>(key: Key, value: ListingFilters[Key]) =>
    setFilters({ ...filters, [key]: value });
  const clearFilters = () => {
    setQuery("");
    setFilters({ ...DEFAULT_LISTING_FILTERS });
  };

  useEffect(() => {
    setVisibleCount(6);
  }, [filters, query]);

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
        <label className="listing-search-field">
          <span>Search listings</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Neighborhood, property, or type"
          />
        </label>
        <div className="listing-filter-fields" aria-label="Available filters">
          <label>
            <span>True monthly cost</span>
            <select
              value={filters.price}
              onChange={(event) => updateFilter("price", event.target.value as ListingPriceFilter)}
            >
              <option value="any">Any price</option>
              <option value="under-1200">Under $1,200</option>
              <option value="1200-1600">$1,200–$1,600</option>
              <option value="over-1600">Over $1,600</option>
            </select>
          </label>
          <label>
            <span>Bedrooms</span>
            <select
              value={filters.bedrooms}
              onChange={(event) =>
                updateFilter("bedrooms", event.target.value as ListingBedroomFilter)
              }
            >
              <option value="any">Any beds</option>
              <option value="studio">Studio</option>
              <option value="1">1 bedroom</option>
              <option value="2">2 bedrooms</option>
              <option value="3-plus">3+ bedrooms</option>
            </select>
          </label>
          <label>
            <span>Move in by</span>
            <input
              type="date"
              value={filters.moveInBy}
              onChange={(event) => updateFilter("moveInBy", event.target.value)}
            />
          </label>
          <label className="listing-checkbox-filter">
            <input
              type="checkbox"
              checked={filters.noMandatoryFees}
              onChange={(event) => updateFilter("noMandatoryFees", event.target.checked)}
            />
            <span>No mandatory recurring fees</span>
          </label>
        </div>
        <div className="listing-filter-meta">
          <span className="listing-disclosure-badge">Complete fee disclosure</span>
          {filtersAreActive && (
            <button type="button" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
      </section>

      <div className="listings-results-heading">
        <div>
          <h2>
            {filtersAreActive
              ? `${filteredListings.length} ${filteredListings.length === 1 ? "rental" : "rentals"} match`
              : "Available rentals"}
          </h2>
          <p>Known mandatory fees are included in the displayed monthly cost.</p>
        </div>
        <span>Demo data only</span>
      </div>

      {filteredListings.length > 0 ? (
        <section className="listings-grid" aria-label="Rental listings">
          {visibleListings.map((listing) => (
            <ListingCard
              key={listing.synthetic.listingId}
              listing={listing}
              onViewDetails={onViewDetails}
            />
          ))}
        </section>
      ) : (
        <section className="listings-empty-state" aria-live="polite">
          <h2>No rentals match those filters</h2>
          <p>Try a different price, bedroom count, move-in date, or search.</p>
          <button type="button" onClick={clearFilters}>
            Clear all filters
          </button>
        </section>
      )}
      {hasMoreListings && (
        <div className="listings-show-more">
          <button type="button" onClick={() => setVisibleCount((count) => count + 6)}>
            Show more rentals
          </button>
        </div>
      )}
    </main>
  );
}

export function RentalDecisionDetails({
  decision,
  saved,
  compared = false,
  tourRequested = false,
  showCalculation,
  backLabel = "Back to listings",
  onBack,
  onToggleSaved,
  onToggleCompared = () => undefined,
  onRequestTour = () => undefined,
  onPlanWithRoommates,
  onOpenAdvisor,
  onOpenPlan = () => undefined,
  onToggleCalculation,
}: {
  decision: RentalDecisionRecord;
  saved: boolean;
  compared?: boolean;
  tourRequested?: boolean;
  showCalculation: boolean;
  backLabel?: string;
  onBack: () => void;
  onToggleSaved: () => void;
  onToggleCompared?: () => void;
  onRequestTour?: () => void;
  onPlanWithRoommates: () => void;
  onOpenAdvisor: () => void;
  onOpenPlan?: () => void;
  onToggleCalculation: () => void;
}) {
  const receipt = buildRentalDecisionReceipt(decision, RENT_SNAPSHOT);
  const isDemoListing = decision.source === "synthetic-demo-listing";
  const updatedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(receipt.updatedAt));

  return (
    <main className="listing-details-page">
      <button className="listing-back" onClick={onBack}>
        <span aria-hidden="true">←</span> {backLabel}
      </button>

      <div className="listing-details-layout">
        <div className="listing-details-main">
          {decision.images.length > 0 ? (
            <img
              className="listing-details-image"
              src={decision.images[0]}
              alt={`${decision.title} demo property`}
            />
          ) : (
            <div className="entered-rental-summary">
              <span>Rental you entered · Demo analysis</span>
              <strong>No listing image was provided</strong>
              <p>RentWell is evaluating only the facts entered below.</p>
            </div>
          )}

          <section className="listing-overview">
            <div className="listing-title-row">
              <div>
                <span className="listing-demo-tag">
                  {isDemoListing ? "SYNTHETIC DEMO LISTING" : "Rental you entered · Demo analysis"}
                </span>
                <h1>{decision.title}</h1>
                <p>
                  {decision.neighborhood}, {decision.city}
                </p>
              </div>
              {isDemoListing && decision.availableDate && (
                <span className="listing-available">
                  Available {formatDate(decision.availableDate)}
                </span>
              )}
            </div>

            <div className="listing-facts" aria-label="Property facts">
              <span>
                <strong>{decision.bedrooms}</strong>{" "}
                {decision.bedrooms === 1 ? "bedroom" : "bedrooms"}
              </span>
              {decision.bathrooms !== null && (
                <span>
                  <strong>{decision.bathrooms}</strong>{" "}
                  {decision.bathrooms === 1 ? "bathroom" : "bathrooms"}
                </span>
              )}
              {decision.squareFootage !== null && (
                <span>
                  <strong>{decision.squareFootage.toLocaleString("en-US")}</strong> sq ft
                </span>
              )}
              {decision.propertyType && (
                <span>
                  <strong>{decision.propertyType}</strong> type
                </span>
              )}
              {!isDemoListing && decision.availableDate && (
                <span>
                  <strong>{formatDate(decision.availableDate)}</strong> move-in
                </span>
              )}
            </div>

            {decision.description && <p className="listing-description">{decision.description}</p>}

            {isDemoListing && (
              <div className="listing-info-grid">
                <section>
                  <h2>Amenities</h2>
                  <ul>
                    {decision.amenities.map((amenity) => (
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
            )}
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
            {decision.recurringFees.map((fee) => (
              <div key={fee.id}>
                <dt>{fee.label}</dt>
                <dd>{formatMoney(fee.amount)}</dd>
              </div>
            ))}
            {decision.noMandatoryRecurringFees && (
              <div>
                <dt>Mandatory recurring fees</dt>
                <dd>$0</dd>
              </div>
            )}
            <div className="receipt-total">
              {receipt.estimatedMoveInCost === null ? (
                <>
                  <dt>Move-in cost unavailable</dt>
                  <dd>Confirm deposit</dd>
                </>
              ) : (
                <>
                  <dt>Estimated move-in cost</dt>
                  <dd>{formatMoney(receipt.estimatedMoveInCost)}</dd>
                </>
              )}
            </div>
          </dl>

          <section className="fair-rent-result">
            <span>Fair Rent result</span>
            <strong>{receipt.fairRentResult}</strong>
            <small>Compares advertised rent before mandatory fees</small>
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
              {saved ? "Saved" : isDemoListing ? "Save listing" : "Save evaluation"}
            </button>
            {decision.capabilities.canCompare && (
              <button className={compared ? "is-active" : ""} onClick={onToggleCompared}>
                {compared ? "Added to compare" : "Add to compare"}
              </button>
            )}
            {decision.capabilities.canRequestTour && (
              <button className="primary" onClick={onRequestTour}>
                {tourRequested ? "Tour request noted" : "Request a tour"}
              </button>
            )}
            <button className="roommate-plan-action" onClick={onPlanWithRoommates}>
              Plan costs with roommates
            </button>
            <button className="advisor-review-action" onClick={onOpenAdvisor}>
              Review sample lease with Advisor
            </button>
            <button className="view-plan-action" onClick={onOpenPlan}>
              View my rental plan
            </button>
          </div>
          {decision.capabilities.canRequestTour && tourRequested && (
            <p className="tour-feedback">Demo only: a manager would receive your tour request.</p>
          )}
        </aside>
      </div>
    </main>
  );
}

export function ListingDetails({
  listing,
  saved,
  compared = false,
  tourRequested = false,
  showCalculation,
  backLabel = "Back to listings",
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
  backLabel?: string;
  onBack: () => void;
  onToggleSaved: () => void;
  onToggleCompared?: () => void;
  onRequestTour?: () => void;
  onToggleCalculation: () => void;
}) {
  return (
    <RentalDecisionDetails
      decision={createDemoRentalDecision(listing)}
      saved={saved}
      compared={compared}
      tourRequested={tourRequested}
      showCalculation={showCalculation}
      backLabel={backLabel}
      onBack={onBack}
      onToggleSaved={onToggleSaved}
      onToggleCompared={onToggleCompared}
      onRequestTour={onRequestTour}
      onPlanWithRoommates={() => undefined}
      onOpenAdvisor={() => undefined}
      onToggleCalculation={onToggleCalculation}
    />
  );
}
