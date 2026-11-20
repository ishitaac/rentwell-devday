import { describe, expect, it } from "vitest";
import { buildQuestions } from "./lib/questions";
import { allShots } from "./lib/shots";
import { summarize } from "./lib/summarize";
import { UNIT_TYPE_IDS } from "./lib/types";
import { SAMPLE, sampleAnalysis } from "./sample";

describe("Sample walkthrough", () => {
  it("every sample result passes the validator, with code caps applied", () => {
    expect(SAMPLE.analyses).toHaveLength(7);
    expect(SAMPLE.analyses.every((a) => a.state === "ok")).toBe(true);
    const a5 = SAMPLE.analyses.find((a) => a.shotId === "A5");
    expect(a5?.state === "ok" && a5.result.observations[0]).toMatchObject({
      severity: "follow_up",
      zone: null,
    });
  });

  it("tells the demo story: ceiling stain priority, dark appliance photo as a gap, one renter flag", () => {
    const summary = summarize(SAMPLE.unitType, SAMPLE.analyses, {
      quickChecks: SAMPLE.quickChecks,
    });
    expect(summary.statusLabel).toBe("Follow-up needed");
    expect(summary.concerns[0]).toMatchObject({
      shotId: "A2",
      severity: "priority",
      zone: "top_right",
    });
    expect(summary.gaps.map((g) => g.shotId)).toEqual(["A6"]);
    expect(summary.renterFlags.map((f) => f.shotId)).toEqual(["A4"]);
    expect(buildQuestions(summary).length).toBeGreaterThan(3);
  });

  it.each(UNIT_TYPE_IDS)(
    "has a valid sample result for every %s shot, so the demo tour never stalls",
    (type) => {
      for (const shot of allShots(type)) {
        expect(sampleAnalysis(type, shot).state).toBe("ok");
      }
    },
  );
});
