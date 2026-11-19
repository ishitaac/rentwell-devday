import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings } from "./demoListings";
import { ManagerDashboard, ManagerEditor, ManagerRenterPreview } from "./ManagerWorkspace";
import { createManagerListingDraft } from "./managerListings";

const callbacks = {
  onQueryChange: () => undefined,
  onEdit: () => undefined,
  onPreview: () => undefined,
  onOpenImport: () => undefined,
};

describe("ManagerDashboard", () => {
  it("shows transparent renter-facing costs and manager actions", () => {
    const listings = getDemoListings(demoListingsDataset).slice(0, 3);

    const html = renderToStaticMarkup(
      <ManagerDashboard listings={listings} query="" {...callbacks} />,
    );

    expect(html).toContain("Manager workspace");
    expect(html).toContain("3 demo listings");
    expect(html).toContain("Demo data");
    expect(html).toContain("Search listings");
    expect(html).toContain("Foothill Family Home");
    expect(html).toContain("East Bench");
    expect(html).toContain("$2,875");
    expect(html).toContain("$35");
    expect(html).toContain("$2,910");
    expect(html).toContain("Available Dec 15");
    expect(html).toContain("Complete fee disclosure");
    expect(html).toContain("Edit");
    expect(html).toContain("Preview as renter");
    expect(html).toContain("Import from property software");
  });

  it("filters by renter-visible listing information and derives the result count", () => {
    const listings = getDemoListings(demoListingsDataset).slice(0, 3);

    const html = renderToStaticMarkup(
      <ManagerDashboard listings={listings} query="Avenues" {...callbacks} />,
    );

    expect(html).toContain("1 demo listing");
    expect(html).toContain("Avenues Garden Apartment");
    expect(html).not.toContain("Foothill Family Home");
    expect(html).not.toContain("Central City Corner One-Bedroom");
  });

  it("shows a clearable no-matches state rather than an empty table", () => {
    const listings = getDemoListings(demoListingsDataset).slice(0, 3);

    const html = renderToStaticMarkup(
      <ManagerDashboard listings={listings} query="not a neighborhood" {...callbacks} />,
    );

    expect(html).toContain("No listings match your search");
    expect(html).toContain("Clear search");
    expect(html).toContain("0 demo listings");
  });
});

describe("ManagerEditor", () => {
  it("shows every editable section, derived monthly cost, and editor actions", () => {
    const listing = getDemoListings(demoListingsDataset)[1];
    const draft = createManagerListingDraft(listing);

    const html = renderToStaticMarkup(
      <ManagerEditor
        draft={draft}
        errors={{}}
        saveState="unsaved"
        onChange={() => undefined}
        onSave={() => undefined}
        onCancel={() => undefined}
        onPreview={() => undefined}
      />,
    );

    expect(html).toContain("Edit listing");
    expect(html).toContain("Unsaved changes");
    expect(html).toContain("Property");
    expect(html).toContain("Costs");
    expect(html).toContain("Availability");
    expect(html).toContain("Presentation");
    expect(html).toContain("Base monthly rent");
    expect(html).toContain("Technology fee");
    expect(html).toContain("Trash service");
    expect(html).toContain("Estimated true monthly cost");
    expect(html).toContain("$1,364");
    expect(html).toContain("Add fee");
    expect(html).toContain("Save changes");
    expect(html).toContain("Cancel");
    expect(html).toContain("Preview as renter");
  });

  it("shows field errors and saved confirmation without hiding the draft", () => {
    const listing = getDemoListings(demoListingsDataset)[1];
    const draft = { ...createManagerListingDraft(listing), askingRent: -1 };

    const html = renderToStaticMarkup(
      <ManagerEditor
        draft={draft}
        errors={{ askingRent: "Base rent must be greater than zero." }}
        saveState="saved"
        onChange={() => undefined}
        onSave={() => undefined}
        onCancel={() => undefined}
        onPreview={() => undefined}
      />,
    );

    expect(html).toContain("Changes saved locally");
    expect(html).toContain("Base rent must be greater than zero.");
    expect(html).toContain("Avenues Garden Apartment");
  });

  it("labels an explicit no-fee draft as known zero fees", () => {
    const listing = getDemoListings(demoListingsDataset).find(
      (candidate) => candidate.synthetic.noMandatoryRecurringFees,
    );
    expect(listing).toBeDefined();
    const draft = createManagerListingDraft(listing!);

    const html = renderToStaticMarkup(
      <ManagerEditor
        draft={draft}
        errors={{}}
        saveState="unsaved"
        onChange={() => undefined}
        onSave={() => undefined}
        onCancel={() => undefined}
        onPreview={() => undefined}
      />,
    );

    expect(html).toContain("No mandatory recurring fees");
    expect(html).toContain("Mandatory fee total");
    expect(html).toContain("$0");
  });
});

describe("ManagerRenterPreview", () => {
  it("reuses the renter card values for title, photo, and true monthly cost", () => {
    const listing = getDemoListings(demoListingsDataset)[1];

    const html = renderToStaticMarkup(<ManagerRenterPreview listing={listing} />);

    expect(html).toContain("Renter preview");
    expect(html).toContain("Avenues Garden Apartment");
    expect(html).toContain("/listings/interior-blue.jpg");
    expect(html).toContain("$1,364");
    expect(html).toContain("True monthly cost");
  });
});
