import { describe, expect, it } from "vitest";
import { buildQuestions } from "./lib/questions";
import { summarize } from "./lib/summarize";
import { SAMPLE } from "./sample";

describe("Sample walkthrough", () => {
  it("every sample result passes the validator, with code caps applied", () => {
    expect(SAMPLE.analyses).toHaveLength(6);
    const a5 = SAMPLE.analyses.find((a) => a.shotId === "A5");
    expect(a5?.state === "ok" && a5.result.observations[0].severity).toBe("follow_up");
  });

  it("tells the demo story: ceiling stain priority, one dark photo as a gap", () => {
    const summary = summarize(SAMPLE.unitType, SAMPLE.analyses);
    expect(summary.statusLabel).toBe("Follow-up needed");
    expect(summary.concerns[0]).toMatchObject({ shotId: "A2", severity: "priority" });
    expect(summary.gaps.map((g) => g.shotId)).toEqual(["A6"]);
    expect(buildQuestions(summary).length).toBeGreaterThan(3);
  });
});
