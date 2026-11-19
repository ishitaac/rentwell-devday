import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RentalEntry, validateExternalRentalEntry } from "./RentalEntry";
import type { ExternalRentalEntry } from "./rentalDecision";

const validEntry: ExternalRentalEntry = {
  label: "Campus apartment",
  neighborhood: "Central City",
  askingRent: 2100,
  bedrooms: 2,
  squareFootage: 940,
  mandatoryRecurringFeeTotal: 200,
  noMandatoryRecurringFees: false,
  moveInDate: "2027-01-05",
};

describe("RentalEntry", () => {
  it("shows every supported external-rental input and labels extraction as simulated", () => {
    const html = renderToStaticMarkup(
      <RentalEntry
        initialEntry={validEntry}
        onEntryChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(html).toContain("Check a rental you found");
    expect(html).toContain("Rental name or short label");
    expect(html).toContain("Neighborhood");
    expect(html).toContain("Monthly rent");
    expect(html).toContain("Bedrooms");
    expect(html).toContain("Square footage (optional)");
    expect(html).toContain("Mandatory recurring fees");
    expect(html).toContain("No mandatory recurring fees");
    expect(html).toContain("Move-in date");
    expect(html).toContain("Simulate listing extraction");
  });
});

describe("validateExternalRentalEntry", () => {
  it("requires a positive rent", () => {
    expect(
      validateExternalRentalEntry({ ...validEntry, askingRent: 0 }),
    ).toMatchObject({ askingRent: expect.any(String) });
  });

  it("does not treat an unconfirmed zero fee as complete disclosure", () => {
    expect(
      validateExternalRentalEntry({
        ...validEntry,
        mandatoryRecurringFeeTotal: 0,
        noMandatoryRecurringFees: false,
      }),
    ).toMatchObject({ mandatoryRecurringFees: expect.any(String) });
  });

  it("rejects fees when no mandatory recurring fees is selected", () => {
    expect(
      validateExternalRentalEntry({
        ...validEntry,
        mandatoryRecurringFeeTotal: 25,
        noMandatoryRecurringFees: true,
      }),
    ).toMatchObject({ mandatoryRecurringFees: expect.any(String) });
  });

  it("accepts an explicit no-fee disclosure", () => {
    expect(
      validateExternalRentalEntry({
        ...validEntry,
        mandatoryRecurringFeeTotal: 0,
        noMandatoryRecurringFees: true,
      }),
    ).toEqual({});
  });
});
