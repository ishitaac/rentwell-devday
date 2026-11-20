import { describe, expect, test } from "vitest";
import sample from "../data/sample-analysis.json";
import { withScenario } from "./assemble";
import { buildGroups, rowKeyForTopic } from "./groups";
import type { AnalysisResult } from "./types";

const analysis = sample as unknown as AnalysisResult;
const groups = buildGroups(analysis);
const group = (id: string) => groups.find((g) => g.id === id)!;

describe("display groups (cached sample)", () => {
  test("all six groups render in spec order", () => {
    expect(groups.map((g) => g.id)).toEqual(["monthly", "conditional", "signing", "estimates", "clarify", "missing"]);
  });

  test("an estimate is never badged Stated", () => {
    const estimateIds = new Set(analysis.findings.filter((f) => f.type === "estimate").map((f) => f.id));
    const rows = groups.flatMap((g) => g.rows).filter((r) => estimateIds.has(r.key));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.badge).toBe("Estimate");
  });

  test("subtotals match the answer key", () => {
    expect(group("monthly").subtotals).toEqual([{ label: "Real monthly cost", value: "$2,348" }]);
    expect(group("signing").subtotals).toEqual([
      { label: "Due at signing", value: "$3,648" },
      { label: "Non-refundable", value: "$490" },
    ]);
  });

  test("unknown costs say 'Not stated in lease', never $0", () => {
    for (const row of group("missing").rows) expect(row.amount).not.toMatch(/\$0\b/);
    expect(group("missing").rows.some((r) => r.amount === "Not stated in lease")).toBe(true);
  });

  test("application fee scales with occupants and shows as paid earlier", () => {
    const three = buildGroups(withScenario(analysis, { occupants: 3, includeEstimates: false, excludedFindingIds: [] }));
    const app = three.find((g) => g.id === "signing")!.rows.find((r) => /application/i.test(r.label))!;
    expect(app.amount).toBe("$135 paid earlier");
  });

  test("pets topic maps to its finding row; furnished maps to a not-found row", () => {
    expect(rowKeyForTopic(analysis, "pets")).toMatch(/^f\d+$/);
    expect(rowKeyForTopic(analysis, "furnished")).toBe("topic-furnished");
  });
});
