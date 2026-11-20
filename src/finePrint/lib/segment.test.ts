import { describe, expect, test } from "vitest";
import { isFictionalSample, segmentLease } from "./segment";
import { loadFixture } from "./testFixtures";

const lease = loadFixture("sample-lease-juniper-row.txt");

describe("T01 segment", () => {
  const clauses = segmentLease(lease);
  const byId = new Map(clauses.map((c) => [c.id, c]));

  test("gives every numbered clause an id and § label", () => {
    const expected = [
      "s1.1", "s1.2", "s1.3",
      "s2.1", "s2.2", "s2.3", "s2.4", "s2.5",
      "s3.1", "s3.2", "s3.3", "s3.4", "s3.5",
      "s4.1", "s4.2", "s4.3", "s4.4", "s4.5", "s4.6", "s4.7", "s4.8",
      "s5.1", "s6.1", "s7.1", "s7.2", "s8.1", "s9.1", "s10.1", "s10.2", "s11.1", "s12.1",
    ];
    for (const id of expected) {
      expect(byId.has(id), id).toBe(true);
      expect(byId.get(id)!.section).toBe(`§ ${id.slice(1)}`);
    }
  });

  test("keeps Exhibit A as its own clause with both rent phases", () => {
    const exhibit = byId.get("exA")!;
    expect(exhibit.section).toBe("Exhibit A");
    expect(exhibit.text).toContain("Months 1 through 6");
    expect(exhibit.text).toContain("$2,150.00 per month");
  });

  test("uses inline headings and falls back to the section heading", () => {
    expect(byId.get("s2.1")!.heading).toBe("Security Deposit");
    expect(byId.get("s5.1")!.heading).toBe("Pets");
  });

  test("clause text holds the clause body, not the number", () => {
    expect(byId.get("s3.1")!.text.startsWith("Base Rent. Base rent is $2,100.00")).toBe(true);
  });

  test("keeps the banner in the source (preamble), never deletes it", () => {
    expect(byId.get("preamble")!.text).toContain("FICTIONAL SAMPLE DOCUMENT");
    expect(isFictionalSample(lease)).toBe(true);
  });

  test("handles CRLF line endings identically", () => {
    const crlf = segmentLease(lease.replace(/\n/g, "\r\n"));
    expect(crlf.map((c) => c.id)).toEqual(clauses.map((c) => c.id));
    expect(crlf.find((c) => c.id === "s3.1")!.text).toBe(byId.get("s3.1")!.text);
  });

  test("falls back to paragraphs for unstructured text", () => {
    const loose = segmentLease("Rent is $900.\n\nParking is $40 a month.");
    expect(loose.map((c) => c.id)).toEqual(["p1", "p2"]);
    expect(loose[1].section).toBe("¶ 2");
  });
});
