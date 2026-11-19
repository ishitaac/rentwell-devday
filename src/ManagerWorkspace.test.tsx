import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { demoListingsDataset, getDemoListings } from "./demoListings";
import { ManagerDashboard } from "./ManagerWorkspace";

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
