import { useState } from "react";

import type { DemoListing } from "./demoListings";
import { ListingCard } from "./Listings";
import {
  createManagerListingDraft,
  saveManagerListingDraft,
  type ManagerListingDraft,
  type ManagerListingErrors,
} from "./managerListings";

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

type ManagerEditorProps = {
  draft: ManagerListingDraft;
  errors: ManagerListingErrors;
  saveState: "unsaved" | "saved";
  onChange: (draft: ManagerListingDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onPreview: () => void;
};

function FieldError({ message }: { message?: string }) {
  return message ? <span className="manager-field-error">{message}</span> : null;
}

export function ManagerEditor({
  draft,
  errors,
  saveState,
  onChange,
  onSave,
  onCancel,
  onPreview,
}: ManagerEditorProps) {
  const feeTotal = draft.mandatoryRecurringFees.reduce((total, fee) => total + fee.amount, 0);
  const trueMonthlyCost = draft.askingRent + feeTotal;
  const update = (changes: Partial<ManagerListingDraft>) => onChange({ ...draft, ...changes });

  return (
    <form
      className="manager-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="manager-editor-header">
        <div>
          <span className="manager-demo-label">Demo listing editor</span>
          <h2>Edit listing</h2>
          <p>{draft.title}</p>
        </div>
        <span className={saveState === "saved" ? "manager-save-state saved" : "manager-save-state"}>
          {saveState === "saved" ? "Changes saved locally" : "Unsaved changes"}
        </span>
      </div>

      <section className="manager-editor-section">
        <div className="manager-section-heading">
          <span>1</span>
          <div>
            <h3>Property</h3>
            <p>Core facts shown to renters.</p>
          </div>
        </div>
        <div className="manager-form-grid">
          <label className="wide">
            <span>Listing title</span>
            <input
              value={draft.title}
              onChange={(event) => update({ title: event.target.value })}
            />
            <FieldError message={errors.title} />
          </label>
          <label>
            <span>Neighborhood</span>
            <input
              value={draft.neighborhood}
              onChange={(event) => update({ neighborhood: event.target.value })}
            />
            <FieldError message={errors.neighborhood} />
          </label>
          <label>
            <span>Property type</span>
            <input
              value={draft.propertyType}
              onChange={(event) => update({ propertyType: event.target.value })}
            />
            <FieldError message={errors.propertyType} />
          </label>
          <label>
            <span>Bedrooms</span>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.bedrooms}
              onChange={(event) => update({ bedrooms: Number(event.target.value) })}
            />
            <FieldError message={errors.bedrooms} />
          </label>
          <label>
            <span>Bathrooms</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={draft.bathrooms}
              onChange={(event) => update({ bathrooms: Number(event.target.value) })}
            />
            <FieldError message={errors.bathrooms} />
          </label>
          <label>
            <span>Square footage</span>
            <input
              type="number"
              min="0"
              value={draft.squareFootage ?? ""}
              onChange={(event) =>
                update({
                  squareFootage: event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
            <FieldError message={errors.squareFootage} />
          </label>
        </div>
      </section>

      <section className="manager-editor-section">
        <div className="manager-section-heading">
          <span>2</span>
          <div>
            <h3>Costs</h3>
            <p>Separate base rent from mandatory charges.</p>
          </div>
        </div>
        <div className="manager-form-grid">
          <label>
            <span>Base monthly rent</span>
            <input
              type="number"
              min="1"
              value={draft.askingRent}
              onChange={(event) => update({ askingRent: Number(event.target.value) })}
            />
            <FieldError message={errors.askingRent} />
          </label>
          <label>
            <span>Security deposit</span>
            <input
              type="number"
              min="0"
              value={draft.securityDeposit}
              onChange={(event) => update({ securityDeposit: Number(event.target.value) })}
            />
            <FieldError message={errors.securityDeposit} />
          </label>
        </div>

        <label className="manager-checkbox">
          <input
            type="checkbox"
            checked={draft.noMandatoryRecurringFees}
            onChange={(event) =>
              update({
                noMandatoryRecurringFees: event.target.checked,
                mandatoryRecurringFees: event.target.checked ? [] : draft.mandatoryRecurringFees,
              })
            }
          />
          <span>No mandatory recurring fees</span>
        </label>

        {!draft.noMandatoryRecurringFees && (
          <div className="manager-fees-editor">
            {draft.mandatoryRecurringFees.map((fee, index) => (
              <div className="manager-fee-row" key={fee.id || `fee-${index}`}>
                <label>
                  <span>Fee name</span>
                  <input
                    value={fee.label}
                    onChange={(event) =>
                      update({
                        mandatoryRecurringFees: draft.mandatoryRecurringFees.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  label: event.target.value,
                                  id: item.id || `manager-fee-${index + 1}`,
                                }
                              : item,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <span>Monthly amount</span>
                  <input
                    type="number"
                    min="0"
                    value={fee.amount}
                    onChange={(event) =>
                      update({
                        mandatoryRecurringFees: draft.mandatoryRecurringFees.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, amount: Number(event.target.value) }
                              : item,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${fee.label || "fee"}`}
                  onClick={() =>
                    update({
                      mandatoryRecurringFees: draft.mandatoryRecurringFees.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="manager-add-fee"
              onClick={() =>
                update({
                  mandatoryRecurringFees: [
                    ...draft.mandatoryRecurringFees,
                    {
                      id: `manager-fee-${draft.mandatoryRecurringFees.length + 1}`,
                      label: "",
                      amount: 0,
                    },
                  ],
                })
              }
            >
              + Add fee
            </button>
          </div>
        )}
        <FieldError message={errors.mandatoryRecurringFees} />

        <div className="manager-cost-preview">
          <div>
            <span>Base rent</span>
            <strong>{formatMoney(draft.askingRent)}</strong>
          </div>
          <div>
            <span>Mandatory fee total</span>
            <strong>{formatMoney(feeTotal)}</strong>
          </div>
          <div className="total">
            <span>Estimated true monthly cost</span>
            <strong>{formatMoney(trueMonthlyCost)}</strong>
          </div>
        </div>
      </section>

      <section className="manager-editor-section">
        <div className="manager-section-heading">
          <span>3</span>
          <div>
            <h3>Availability</h3>
            <p>When renters can move in.</p>
          </div>
        </div>
        <label className="manager-single-field">
          <span>Available date</span>
          <input
            type="date"
            value={draft.availableDate}
            onChange={(event) => update({ availableDate: event.target.value })}
          />
          <FieldError message={errors.availableDate} />
        </label>
      </section>

      <section className="manager-editor-section">
        <div className="manager-section-heading">
          <span>4</span>
          <div>
            <h3>Presentation</h3>
            <p>Photos and details renters use to decide.</p>
          </div>
        </div>
        <div className="manager-form-grid">
          <label className="wide">
            <span>Short description</span>
            <textarea
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
            />
            <FieldError message={errors.description} />
          </label>
          <label>
            <span>Amenities · one per line</span>
            <textarea
              value={draft.amenities.join("\n")}
              onChange={(event) => update({ amenities: event.target.value.split("\n") })}
            />
            <FieldError message={errors.amenities} />
          </label>
          <label>
            <span>Image paths · one per line</span>
            <textarea
              value={draft.images.join("\n")}
              onChange={(event) => update({ images: event.target.value.split("\n") })}
            />
            <FieldError message={errors.images} />
          </label>
        </div>
      </section>

      <div className="manager-editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={onPreview} disabled={saveState === "unsaved"}>
          {saveState === "saved" ? "Preview as renter" : "Save before renter preview"}
        </button>
        <button type="submit" className="primary">
          Save changes
        </button>
      </div>
    </form>
  );
}

export function ManagerRenterPreview({ listing }: { listing: DemoListing }) {
  return (
    <aside className="manager-renter-preview" id="manager-renter-preview">
      <div>
        <span className="manager-demo-label">Live demo</span>
        <h2>Renter preview</h2>
        <p>This card uses the same listing record renters see.</p>
      </div>
      <ListingCard listing={listing} onViewDetails={() => undefined} showAction={false} />
    </aside>
  );
}

export function PropertySoftwareImportModal({
  onLoadDemoListing,
  onCancel,
}: {
  onLoadDemoListing: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="manager-import-overlay" role="presentation">
      <section
        className="manager-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-import-title"
      >
        <div className="manager-import-icon" aria-hidden="true">
          ↔
        </div>
        <span className="manager-demo-label">Prototype connection</span>
        <h2 id="manager-import-title">Import from property software</h2>
        <p className="manager-import-lead">
          Entrata is shown as an example property-management source.
        </p>
        <div className="manager-import-notice">
          <strong>Demo connection—no live property data is transferred</strong>
          <p>
            This prototype loads an existing synthetic listing. It does not authenticate or
            synchronize with Entrata.
          </p>
        </div>
        <div className="manager-import-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onLoadDemoListing}>
            Load demo listing
          </button>
        </div>
      </section>
    </div>
  );
}

function buildDraftPreview(source: DemoListing, draft: ManagerListingDraft): DemoListing {
  const recurringFees = draft.mandatoryRecurringFees.map((fee) => ({ ...fee }));
  const recurringFeeTotal = recurringFees.reduce((total, fee) => total + fee.amount, 0);
  return {
    ...source,
    synthetic: {
      ...source.synthetic,
      title: draft.title,
      neighborhood: draft.neighborhood,
      description: draft.description,
      askingRent: draft.askingRent,
      propertyType: draft.propertyType,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      squareFootage: draft.squareFootage,
      mandatoryRecurringFees: recurringFees,
      mandatoryRecurringFeeTotal: recurringFeeTotal,
      noMandatoryRecurringFees: draft.noMandatoryRecurringFees,
      trueMonthlyCost: draft.askingRent + recurringFeeTotal,
      securityDeposit: draft.securityDeposit,
      availableDate: draft.availableDate,
      images: [...draft.images],
      amenities: [...draft.amenities],
      updatedAt: draft.updatedAt,
    },
  };
}

export function ManagerWorkspace({
  listings,
  onListingsChange,
  onPreviewListing,
}: {
  listings: DemoListing[];
  onListingsChange: (listings: DemoListing[]) => void;
  onPreviewListing: (listing: DemoListing) => void;
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ManagerListingDraft | null>(null);
  const [errors, setErrors] = useState<ManagerListingErrors>({});
  const [saveState, setSaveState] = useState<"unsaved" | "saved">("unsaved");
  const [importOpen, setImportOpen] = useState(false);
  const sourceListing = draft
    ? (listings.find((listing) => listing.synthetic.listingId === draft.listingId) ?? null)
    : null;
  const previewListing = sourceListing && draft ? buildDraftPreview(sourceListing, draft) : null;

  const openEditor = (listing: DemoListing) => {
    setDraft(createManagerListingDraft(listing));
    setErrors({});
    setSaveState("saved");
  };

  const saveDraft = () => {
    if (!draft) return;
    const timestampedDraft = { ...draft, updatedAt: "2026-11-19T08:00:00.000Z" };
    const result = saveManagerListingDraft(listings, timestampedDraft);
    setErrors(result.errors);
    if (Object.keys(result.errors).length > 0) return;
    onListingsChange(result.listings);
    const savedListing = result.listings.find(
      (listing) => listing.synthetic.listingId === draft.listingId,
    );
    if (savedListing) setDraft(createManagerListingDraft(savedListing));
    setSaveState("saved");
  };

  return (
    <>
      <ManagerDashboard
        listings={listings}
        query={query}
        onQueryChange={setQuery}
        onEdit={openEditor}
        onPreview={onPreviewListing}
        onOpenImport={() => setImportOpen(true)}
      />

      {draft && previewListing && (
        <div className="manager-editor-overlay">
          <div className="manager-editor-layout">
            <ManagerEditor
              draft={draft}
              errors={errors}
              saveState={saveState}
              onChange={(nextDraft) => {
                setDraft(nextDraft);
                setErrors({});
                setSaveState("unsaved");
              }}
              onSave={saveDraft}
              onCancel={() => {
                setDraft(null);
                setErrors({});
              }}
              onPreview={() => sourceListing && onPreviewListing(sourceListing)}
            />
            <ManagerRenterPreview listing={previewListing} />
          </div>
        </div>
      )}

      {importOpen && (
        <PropertySoftwareImportModal
          onCancel={() => setImportOpen(false)}
          onLoadDemoListing={() => {
            setImportOpen(false);
            const importFixture = listings[1] ?? listings[0];
            if (importFixture) openEditor(importFixture);
          }}
        />
      )}
    </>
  );
}
