import { useState } from "react";

import type { ExternalRentalEntry } from "./rentalDecision";

export type ExternalRentalEntryErrors = Record<string, string>;

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateExternalRentalEntry(
  entry: ExternalRentalEntry,
): ExternalRentalEntryErrors {
  const errors: ExternalRentalEntryErrors = {};

  if (!entry.label.trim()) errors.label = "Enter a rental name or short label.";
  if (!entry.neighborhood.trim()) errors.neighborhood = "Enter a neighborhood.";
  if (!Number.isFinite(entry.askingRent) || entry.askingRent <= 0) {
    errors.askingRent = "Monthly rent must be greater than zero.";
  }
  if (!Number.isFinite(entry.bedrooms) || entry.bedrooms < 0) {
    errors.bedrooms = "Bedrooms cannot be negative.";
  }
  if (
    entry.squareFootage !== null &&
    (!Number.isFinite(entry.squareFootage) || entry.squareFootage <= 0)
  ) {
    errors.squareFootage = "Square footage must be greater than zero when provided.";
  }
  if (
    !Number.isFinite(entry.mandatoryRecurringFeeTotal) ||
    entry.mandatoryRecurringFeeTotal < 0 ||
    (!entry.noMandatoryRecurringFees && entry.mandatoryRecurringFeeTotal === 0) ||
    (entry.noMandatoryRecurringFees && entry.mandatoryRecurringFeeTotal !== 0)
  ) {
    errors.mandatoryRecurringFees =
      "Enter the fee total or explicitly select no mandatory recurring fees.";
  }
  if (!isValidCalendarDate(entry.moveInDate)) {
    errors.moveInDate = "Enter a valid move-in date.";
  }

  return errors;
}

const SIMULATED_ENTRY: ExternalRentalEntry = {
  label: "Avenues two-bedroom",
  neighborhood: "The Avenues",
  askingRent: 2100,
  bedrooms: 2,
  squareFootage: 940,
  mandatoryRecurringFeeTotal: 200,
  noMandatoryRecurringFees: false,
  moveInDate: "2027-01-05",
};

export function RentalEntry({
  initialEntry,
  onEntryChange,
  onSubmit,
}: {
  initialEntry: ExternalRentalEntry;
  onEntryChange: (entry: ExternalRentalEntry) => void;
  onSubmit: (entry: ExternalRentalEntry) => void;
}) {
  const [entry, setEntry] = useState(initialEntry);
  const [errors, setErrors] = useState<ExternalRentalEntryErrors>({});
  const [extracted, setExtracted] = useState(false);

  const update = (changes: Partial<ExternalRentalEntry>) => {
    const next = { ...entry, ...changes };
    setEntry(next);
    onEntryChange(next);
  };
  const simulateExtraction = () => {
    setEntry(SIMULATED_ENTRY);
    onEntryChange(SIMULATED_ENTRY);
    setErrors({});
    setExtracted(true);
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateExternalRentalEntry(entry);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(entry);
  };

  return (
    <main className="rental-entry-page">
      <div className="rental-entry-heading">
        <p className="eyebrow">Check Your Rental</p>
        <h1>Check a rental you found</h1>
        <p>
          Bring a rental from another site and see its rent, mandatory fees, and dated market
          comparison in one Decision Receipt.
        </p>
      </div>

      <form className="rental-entry-form" onSubmit={submit} noValidate>
        <section className="rental-entry-extract">
          <div>
            <span className="demo-tag">DEMO TOOL</span>
            <h2>Start with a listing</h2>
            <p>Extraction is simulated for this prototype; every field remains editable.</p>
          </div>
          <button type="button" onClick={simulateExtraction}>
            Simulate listing extraction
          </button>
        </section>
        {extracted && (
          <p className="rental-entry-success" role="status">
            Demo details extracted. Review the supported fields below.
          </p>
        )}

        <div className="rental-entry-grid">
          <label>
            <span>Rental name or short label</span>
            <input
              value={entry.label}
              onChange={(event) => update({ label: event.target.value })}
            />
            {errors.label && <small>{errors.label}</small>}
          </label>
          <label>
            <span>Neighborhood</span>
            <input
              value={entry.neighborhood}
              onChange={(event) => update({ neighborhood: event.target.value })}
            />
            {errors.neighborhood && <small>{errors.neighborhood}</small>}
          </label>
          <label>
            <span>Monthly rent</span>
            <input
              type="number"
              min="1"
              value={entry.askingRent}
              onChange={(event) => update({ askingRent: Number(event.target.value) })}
            />
            {errors.askingRent && <small>{errors.askingRent}</small>}
          </label>
          <label>
            <span>Bedrooms</span>
            <input
              type="number"
              min="0"
              value={entry.bedrooms}
              onChange={(event) => update({ bedrooms: Number(event.target.value) })}
            />
            {errors.bedrooms && <small>{errors.bedrooms}</small>}
          </label>
          <label>
            <span>Square footage (optional)</span>
            <input
              type="number"
              min="1"
              value={entry.squareFootage ?? ""}
              onChange={(event) =>
                update({
                  squareFootage: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
            {errors.squareFootage && <small>{errors.squareFootage}</small>}
          </label>
          <label>
            <span>Move-in date</span>
            <input
              type="date"
              value={entry.moveInDate}
              onChange={(event) => update({ moveInDate: event.target.value })}
            />
            {errors.moveInDate && <small>{errors.moveInDate}</small>}
          </label>
          <label className="rental-entry-fees">
            <span>Mandatory recurring fees</span>
            <input
              type="number"
              min="0"
              value={entry.mandatoryRecurringFeeTotal}
              disabled={entry.noMandatoryRecurringFees}
              onChange={(event) =>
                update({ mandatoryRecurringFeeTotal: Number(event.target.value) })
              }
            />
            {errors.mandatoryRecurringFees && (
              <small>{errors.mandatoryRecurringFees}</small>
            )}
          </label>
          <label className="rental-entry-checkbox">
            <input
              type="checkbox"
              checked={entry.noMandatoryRecurringFees}
              onChange={(event) =>
                update({
                  noMandatoryRecurringFees: event.target.checked,
                  mandatoryRecurringFeeTotal: event.target.checked
                    ? 0
                    : entry.mandatoryRecurringFeeTotal,
                })
              }
            />
            <span>No mandatory recurring fees</span>
          </label>
        </div>

        <button className="rental-entry-submit" type="submit">
          Create Decision Receipt
        </button>
      </form>
    </main>
  );
}
