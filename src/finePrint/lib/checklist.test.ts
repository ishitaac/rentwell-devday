import { describe, expect, test } from "vitest";
import { findOccupancyLimit, scanTopics } from "./checklist";
import { segmentLease } from "./segment";
import { loadFixture } from "./testFixtures";

const lease = loadFixture("sample-lease-juniper-row.txt");
const clauses = segmentLease(lease);
const status = (topics: ReturnType<typeof scanTopics>, id: string) => topics.find((t) => t.topic === id)!;

describe("T08 checklist", () => {
  const topics = scanTopics(clauses);

  test("pets are found at § 5.1", () => {
    expect(status(topics, "pets")).toMatchObject({ status: "found", clauseIds: ["s5.1"] });
  });

  test("furnished is not found", () => {
    expect(status(topics, "furnished")).toMatchObject({ status: "not_found", clauseIds: [] });
  });

  test("removing the pet clause flips pets to not found", () => {
    const withoutPets = segmentLease(lease.replace(/SECTION 5\. PETS[\s\S]*?(?=SECTION 6\.)/, ""));
    expect(withoutPets.some((c) => c.id === "s5.1")).toBe(false);
    expect(status(scanTopics(withoutPets), "pets").status).toBe("not_found");
  });

  test("'pest' and 'carpet' do not count as pets", () => {
    const tricky = segmentLease("SECTION 1. FEES\n\n1.1 Pest control is $8. Carpet cleaning is $150.");
    expect(status(scanTopics(tricky), "pets").status).toBe("not_found");
  });

  test("the preamble and banner never count as coverage", () => {
    const topicsFound = topics.filter((t) => t.clauseIds.includes("preamble"));
    expect(topicsFound).toEqual([]);
  });

  test("known gaps in the sample are reported", () => {
    for (const id of ["smoking", "laundry", "heating_cooling", "snow_removal"]) {
      expect(status(topics, id).status, id).toBe("not_found");
    }
    for (const id of ["parking", "guests", "subletting", "early_termination", "renewal"]) {
      expect(status(topics, id).status, id).toBe("found");
    }
  });

  test("occupancy limit is read from the lease", () => {
    expect(findOccupancyLimit(clauses)).toEqual({ max: 2, clauseId: "s1.3" });
  });
});
