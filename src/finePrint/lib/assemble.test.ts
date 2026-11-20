import { describe, expect, test } from "vitest";
import { assembleAnalysis, withScenario } from "./assemble";
import { segmentLease } from "./segment";
import { sampleFindings, sampleSchedule } from "./sampleFindings.testdata";
import { loadFixture } from "./testFixtures";
import { questionsAsEmail } from "./questions";

const lease = loadFixture("sample-lease-juniper-row.txt");
const clauses = segmentLease(lease);
const text = (id: string) => clauses.find((c) => c.id === id)!.text;

// Quotes must be real for the derived-conflict sentence lookup; use clause text.
const findings = sampleFindings().map((f) => ({ ...f, quote: text(f.clauseId) }));
const schedule = sampleSchedule.map((p, i) => ({ ...p, quote: text("exA").split("\n")[i] }));

const analysis = assembleAnalysis(
  { clauses, findings, rentSchedule: schedule, conflicts: [], clarifications: [] },
  lease,
  { model: "test", source: "live", ms: 0 },
);

describe("assembled analysis (traps code must flag on its own)", () => {
  test("headline and occupancy limit", () => {
    expect(analysis.costs.headlineCents).toBe(234_800);
    expect(analysis.costs.occupancyLimit).toEqual({ max: 2, clauseId: "s1.3" });
    expect(analysis.isFictionalSample).toBe(true);
  });

  test("fixed rent vs Exhibit A is flagged as a conflict", () => {
    expect(analysis.conflicts).toHaveLength(1);
    expect(analysis.conflicts[0].clauseIds).toEqual(["s3.1", "exA"]);
    expect(analysis.conflicts[0].refs[0].quote).toBe("Rent will remain fixed for the Term.");
  });

  test("late fee with no cap is flagged", () => {
    expect(analysis.clarifications.some((c) => /\$15 a day with no stated cap/.test(c.text))).toBe(true);
  });

  test("model clarifications that repeat a derived flag are dropped", () => {
    const withModel = assembleAnalysis(
      {
        clauses, findings, rentSchedule: schedule, conflicts: [],
        clarifications: [
          { text: "Late fees have no stated cap.", refs: [], clauseIds: ["s3.3"] },
          { text: "Landlord can add fees on 30 days' notice.", refs: [], clauseIds: ["s4.8"] },
        ],
      },
      lease,
      { model: "test", source: "live", ms: 0 },
    );
    const texts = withModel.clarifications.map((c) => c.text);
    expect(texts.filter((t) => /late fee/i.test(t))).toHaveLength(1);
    expect(texts).toContain("Landlord can add fees on 30 days' notice.");
  });

  test("early termination ambiguity shows both amounts", () => {
    expect(analysis.clarifications.some((c) => /\$4,200 or \$4,300/.test(c.text))).toBe(true);
  });

  test("questions cover the conflict, unknowns and missing topics", () => {
    expect(analysis.questions[0]).toMatch(/disagree \(§ 3\.1, Exhibit A\)/);
    expect(analysis.questions.some((q) => q.startsWith("Electricity and natural gas isn't priced"))).toBe(true);
    expect(analysis.questions).toContain("What is the smoking and vaping policy?");
    expect(questionsAsEmail(analysis.questions.slice(0, 2))).toMatch(/^Subject: .*\n\nHi,[\s\S]*1\. [\s\S]*2\. /);
  });

  test("scenario changes recompute without touching findings", () => {
    const three = withScenario(analysis, { occupants: 3, includeEstimates: true, excludedFindingIds: [] });
    expect(three.costs.displayedMonthlyCents).toBe(241_800);
    expect(three.costs.perPersonDollars).toEqual([806, 806, 806]);
    expect(three.findings).toBe(analysis.findings);
  });
});
