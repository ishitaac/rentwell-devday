import type { DemoListing } from "./demoListings";

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function filterManagerListings(listings: DemoListing[], query: string): DemoListing[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return listings;
  return listings.filter(({ market, synthetic }) =>
    [synthetic.title, synthetic.neighborhood, synthetic.propertyType, market.zipCode]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

type ManagerDashboardProps = {
  listings: DemoListing[];
  query: string;
  onQueryChange: (query: string) => void;
  onEdit: (listing: DemoListing) => void;
  onPreview: (listing: DemoListing) => void;
  onOpenImport: () => void;
};

export function ManagerDashboard({
  listings,
  query,
  onQueryChange,
  onEdit,
  onPreview,
  onOpenImport,
}: ManagerDashboardProps) {
  const filteredListings = filterManagerListings(listings, query);
  const countLabel = `${filteredListings.length} demo ${filteredListings.length === 1 ? "listing" : "listings"}`;

  return (
    <main className="manager-page">
      <section className="manager-hero">
        <div>
          <div className="manager-kicker">
            <span>Manager workspace</span>
            <span>Demo data</span>
          </div>
          <h1>Keep renter-facing costs clear and current.</h1>
          <p>Select a listing to edit its details, fees, availability, and renter preview.</p>
        </div>
        <button className="manager-import-button" onClick={onOpenImport}>
          Import from property software <span>Demo</span>
        </button>
      </section>

      <section className="manager-summary" aria-label="Manager listing summary">
        <div>
          <strong>{listings.length}</strong>
          <span>Total demo listings</span>
        </div>
        <div>
          <strong>
            {
              listings.filter((listing) => listing.synthetic.feeDisclosureState === "complete")
                .length
            }
          </strong>
          <span>Complete fee disclosures</span>
        </div>
        <div>
          <strong>{listings.filter((listing) => listing.synthetic.availableDate).length}</strong>
          <span>Availability dates</span>
        </div>
      </section>

      <section className="manager-listings-panel">
        <div className="manager-toolbar">
          <label>
            <span>Search listings</span>
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Title, neighborhood, ZIP, or type"
            />
          </label>
          <div>
            <strong>{countLabel}</strong>
            <small>Local competition fixtures</small>
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <div className="manager-empty-state">
            <span aria-hidden="true">⌕</span>
            <h2>No listings match your search</h2>
            <p>Try another neighborhood, property type, title, or ZIP code.</p>
            <button onClick={() => onQueryChange("")}>Clear search</button>
          </div>
        ) : (
          <>
            <div className="manager-table-wrap">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Base rent</th>
                    <th>Mandatory fees</th>
                    <th>True monthly cost</th>
                    <th>Availability</th>
                    <th>Disclosure</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.map((listing) => {
                    const { synthetic } = listing;
                    return (
                      <tr key={synthetic.listingId}>
                        <td>
                          <div className="manager-property-cell">
                            <img src={synthetic.images[0]} alt="" />
                            <div>
                              <strong>{synthetic.title}</strong>
                              <span>{synthetic.neighborhood}</span>
                            </div>
                          </div>
                        </td>
                        <td>{formatMoney(synthetic.askingRent)}</td>
                        <td>{formatMoney(synthetic.mandatoryRecurringFeeTotal)}</td>
                        <td>
                          <strong>{formatMoney(synthetic.trueMonthlyCost)}</strong>
                        </td>
                        <td>Available {formatDate(synthetic.availableDate)}</td>
                        <td>
                          <span className="manager-status">Complete fee disclosure</span>
                        </td>
                        <td>
                          <div className="manager-row-actions">
                            <button onClick={() => onPreview(listing)}>Preview as renter</button>
                            <button className="primary" onClick={() => onEdit(listing)}>
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="manager-mobile-list" aria-label="Manager listing cards">
              {filteredListings.map((listing) => {
                const { synthetic } = listing;
                return (
                  <article className="manager-mobile-card" key={synthetic.listingId}>
                    <div className="manager-mobile-heading">
                      <img src={synthetic.images[0]} alt="" />
                      <div>
                        <strong>{synthetic.title}</strong>
                        <span>{synthetic.neighborhood}</span>
                      </div>
                    </div>
                    <dl>
                      <div>
                        <dt>Base rent</dt>
                        <dd>{formatMoney(synthetic.askingRent)}</dd>
                      </div>
                      <div>
                        <dt>Mandatory fees</dt>
                        <dd>{formatMoney(synthetic.mandatoryRecurringFeeTotal)}</dd>
                      </div>
                      <div>
                        <dt>True monthly cost</dt>
                        <dd>{formatMoney(synthetic.trueMonthlyCost)}</dd>
                      </div>
                    </dl>
                    <p>Available {formatDate(synthetic.availableDate)} · Complete fee disclosure</p>
                    <div className="manager-row-actions">
                      <button onClick={() => onPreview(listing)}>Preview as renter</button>
                      <button className="primary" onClick={() => onEdit(listing)}>
                        Edit
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
