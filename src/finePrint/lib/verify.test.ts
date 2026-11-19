import { describe, expect, test } from "vitest";
import type { Clause } from "./types";
import { findQuote, normalizeForMatch, quoteInClause, verifyFinding, verifyQuoteRef } from "./verify";
import { verifyPhases } from "./verifyExtraction";

const clauses: Clause[] = [
  {
    id: "s4.1",
    section: "§ 4.1",
    text: "Reserved Parking. Resident must lease one (1) reserved parking space at $100.00 per month. A second space, if available, is $75.00 per month.",
  },
  {
    id: "s1.3",
    section: "§ 1.3",
    text: "Occupancy. A guest may stay no more than 14 days in any 6-month period without Landlord's written consent.",
  },
];
const byId = new Map(clauses.map((c) => [c.id, c]));

const base = {
  id: "f1",
  label: "Reserved parking",
  clauseId: "s4.1",
  quote: "reserved parking space at $100.00 per month",
  type: "mandatory" as const,
  frequency: "monthly" as const,
  kind: "fee" as const,
  amount: 100,
  perPerson: false,
  isRequired: true,
  paidEarlier: false,
};

describe("T02 verify", () => {
  test("exact quote passes", () => {
    expect(verifyFinding(base, byId).verified).toBe(true);
  });

  test("altered quote fails", () => {
    const altered = verifyFinding({ ...base, quote: "reserved parking space at $90.00 per month" }, byId);
    expect(altered.verified).toBe(false);
    expect(altered.verifyFailure).toMatch(/not found/);
  });

  test("quote from the wrong clause fails", () => {
    expect(verifyFinding({ ...base, clauseId: "s1.3" }, byId).verified).toBe(false);
  });

  test("whitespace and curly quotes are normalized", () => {
    const ref = { clauseId: "s1.3", quote: "without  Landlord’s\n written consent" };
    expect(verifyQuoteRef(ref, byId)).toBe(true);
    expect(normalizeForMatch("“a”  ‘b’\r\n c")).toBe("\"a\" 'b' c");
  });

  test("a real quote with an invented amount fails", () => {
    const wrongAmount = verifyFinding({ ...base, amount: 120 }, byId);
    expect(wrongAmount.verified).toBe(false);
    expect(wrongAmount.verifyFailure).toMatch(/amount/);
  });

  test("number words count: 'one (1)' supports quantity 1", () => {
    const withQty = verifyFinding(
      { ...base, quote: "lease one (1) reserved parking space at $100.00 per month", quantity: 1 },
      byId,
    );
    expect(withQty.verified).toBe(true);
  });

  test("empty or tiny quotes never verify", () => {
    expect(quoteInClause("", clauses[0].text)).toBe(false);
    expect(quoteInClause("$1", clauses[0].text)).toBe(false);
  });

  test("unknown clause id fails", () => {
    expect(verifyFinding({ ...base, clauseId: "s99.1" }, byId).verified).toBe(false);
  });

  test("a case-only difference verifies, and the displayed quote is the lease's own text", () => {
    const f = verifyFinding({ ...base, quote: "RESERVED parking space at $100.00 per month" }, byId);
    expect(f.verified).toBe(true);
    expect(f.quote).toBe("reserved parking space at $100.00 per month");
  });

  test("findQuote maps back to exact original offsets across odd whitespace", () => {
    const text = "Pets.  No pets\n are allowed without a “Pet Addendum.”";
    const span = findQuote('no pets are allowed without a "Pet Addendum', text)!;
    expect(text.slice(span.start, span.end)).toBe("No pets\n are allowed without a “Pet Addendum");
  });

  test("rent phases verify their months and amount, and dedupe", () => {
    const exhibit: Clause = { id: "exA", section: "Exhibit A", text: "Months 7 through 12: $2,150.00 per month" };
    const map = new Map([["exA", exhibit]]);
    const phase = { fromMonth: 7, toMonth: 12, amount: 2150, clauseId: "exA", quote: "Months 7 through 12: $2,150.00 per month" };
    expect(verifyPhases([phase, phase], map)).toHaveLength(1);
    expect(verifyPhases([{ ...phase, amount: 2100 }], map)).toHaveLength(0);
  });
});
