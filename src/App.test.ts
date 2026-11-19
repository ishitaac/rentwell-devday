import { describe, expect, it } from "vitest";

import { APARTMENT_IMAGE, HERO_IMAGE, canAnalyzeRental } from "./App";

describe("presentation assets", () => {
  it("uses bundled listing images for visible demo screens", () => {
    expect(HERO_IMAGE).toMatch(/^\/listings\/.+\.jpg$/);
    expect(APARTMENT_IMAGE).toMatch(/^\/listings\/.+\.jpg$/);
    expect(HERO_IMAGE).not.toContain("://");
    expect(APARTMENT_IMAGE).not.toContain("://");
  });
});

describe("canAnalyzeRental", () => {
  it.each([0, -1, Number.NaN])("rejects an invalid asking rent of %s", (rent) => {
    expect(
      canAnalyzeRental({
        neighborhood: "The Avenues",
        rent,
        bedrooms: 2,
        sqft: 900,
        fees: 50,
        date: "2026-12-01",
      }),
    ).toBe(false);
  });

  it("accepts a positive asking rent", () => {
    expect(
      canAnalyzeRental({
        neighborhood: "The Avenues",
        rent: 1500,
        bedrooms: 2,
        sqft: 900,
        fees: 50,
        date: "2026-12-01",
      }),
    ).toBe(true);
  });
});
