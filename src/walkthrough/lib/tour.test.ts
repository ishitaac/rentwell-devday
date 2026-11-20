import { describe, expect, it } from "vitest";
import { buildQuestions } from "./questions";
import { initialCaptureState, placePhoto, setPrompt, skipShot } from "./session";
import { MISC_SHOTS, tourShots, UNIT_TYPES } from "./shots";
import { summarize } from "./summarize";
import { UNIT_TYPE_IDS } from "./types";
import { CLOSER_PHOTO_NOTE, validatePhotoResult } from "./validate";
import { APARTMENT_IDS, observation, okResult } from "./testFixtures";

const raw = (obs: object[]) => ({
  assessable: true,
  notAssessableReason: null,
  imageQuality: "good",
  observations: obs,
});

describe("zones and headlines", () => {
  it("keeps the zone for a medium or high confidence concern", () => {
    const out = validatePhotoResult(
      raw([observation({ zone: "top_right", confidence: "medium" })]),
      "apartment",
      "A2",
    );
    expect(out.ok && out.result.observations[0].zone).toBe("top_right");
  });

  it("drops the zone for low confidence and for no-concern items", () => {
    const out = validatePhotoResult(
      raw([
        observation({ confidence: "low" }),
        observation({ finding: "no_concern_visible", severity: null }),
      ]),
      "apartment",
      "A2",
    );
    if (!out.ok) throw new Error();
    expect(out.result.observations.map((o) => o.zone)).toEqual([null, null]);
    expect(out.result.observations[0].capNote).toBe(CLOSER_PHOTO_NOTE);
  });

  it("ignores an invalid zone instead of failing", () => {
    const out = validatePhotoResult(
      raw([observation({ zone: "everywhere" as never })]),
      "apartment",
      "A2",
    );
    expect(out.ok && out.result.observations[0].zone).toBeNull();
  });

  it("derives a short headline when the model omits one, and caps long ones", () => {
    const out = validatePhotoResult(
      raw([{ ...observation(), headline: undefined }, observation({ headline: "x".repeat(80) })]),
      "apartment",
      "A2",
    );
    if (!out.ok) throw new Error();
    expect(out.result.observations[0].headline).toBe("Brown staining on the ceiling");
    expect(out.result.observations[1].headline.length).toBeLessThanOrEqual(40);
  });

  it("rejects banned words in the headline", () => {
    const out = validatePhotoResult(
      raw([observation({ headline: "Looks safe" })]),
      "apartment",
      "A2",
    );
    expect(out).toMatchObject({ ok: false, code: "banned_word" });
  });
});

describe("tour content", () => {
  it.each(UNIT_TYPE_IDS)(
    "%s tour visits every required shot once, each with up to 3 look-fors",
    (type) => {
      const stops = tourShots(type);
      expect(stops.map((s) => s.id).sort()).toEqual(
        UNIT_TYPES[type].required.map((s) => s.id).sort(),
      );
      for (const stop of stops) {
        expect(stop.lookFor.length).toBeGreaterThan(0);
        expect(stop.lookFor.length).toBeLessThanOrEqual(3);
        expect(stop.quickCheck).not.toBeNull();
      }
    },
  );

  it("'Anything else?' shots accept any category", () => {
    const out = validatePhotoResult(
      raw([observation({ category: "yard_grounds" })]),
      "apartment",
      "X1",
    );
    expect(out.ok && out.result.observations).toHaveLength(1);
  });
});

describe("summary with tour data", () => {
  it("a skipped shot is a gap with the reason, never a pass", () => {
    const s = summarize(
      "apartment",
      APARTMENT_IDS.filter((id) => id !== "A6").map((id) => okResult(id)),
      {
        skipped: { A6: "Locked" },
      },
    );
    expect(s.gaps).toEqual([
      expect.objectContaining({ shotId: "A6", kind: "skipped", reason: "Skipped: Locked" }),
    ]);
    expect(s.statusLabel).toBe("Incomplete evidence");
  });

  it("a missing 'Anything else?' photo is not a gap", () => {
    const s = summarize(
      "apartment",
      APARTMENT_IDS.map((id) => okResult(id)),
    );
    expect(s.gaps).toEqual([]);
    expect(s.showNoConcernsLine).toBe(true);
  });

  it("a 'No' quick check becomes a renter flag and a landlord question, and hides the no-concerns line", () => {
    const s = summarize(
      "apartment",
      APARTMENT_IDS.map((id) => okResult(id)),
      { quickChecks: { A1: "no", A3: "yes" } },
    );
    expect(s.renterFlags).toEqual([
      expect.objectContaining({ shotId: "A1", label: "Hot water and pressure" }),
    ]);
    expect(s.showNoConcernsLine).toBe(false);
    const qs = buildQuestions(s);
    expect(qs.map((q) => q.kind)).toEqual(["quick_check", "condition_report"]);
  });

  it("every question has a short version no longer than the full one", () => {
    const s = summarize("apartment", [
      okResult("A1", [observation({ category: "water_moisture" })]),
      okResult("A2", [observation()]),
      okResult("X1", [observation({ category: "visible_safety", locationHint: "" })]),
    ]);
    for (const q of buildQuestions(s)) {
      expect(q.short.length).toBeGreaterThan(5);
      expect(q.short.length).toBeLessThanOrEqual(q.text.length);
    }
  });
});

describe("session tour helpers", () => {
  it("skipping clears the photo; taking a photo clears the skip", () => {
    const photo = {
      id: "p1",
      base64: "AAAA",
      takenAt: null,
      takenAtSource: "none" as const,
      fileName: "a.jpg",
    };
    const skipped = skipShot(
      placePhoto(initialCaptureState("apartment"), "A1", photo),
      "A1",
      "Locked",
    );
    expect(skipped.slots).toEqual({});
    expect(skipped.skipped).toEqual({ A1: "Locked" });
    expect(placePhoto(skipped, "A1", photo).skipped).toEqual({});
  });

  it("stores and clears the 'Anything else?' prompt", () => {
    const withPrompt = setPrompt(
      initialCaptureState("apartment"),
      MISC_SHOTS[0].id,
      "Is this discolored?",
    );
    expect(withPrompt.prompts).toEqual({ X1: "Is this discolored?" });
    expect(setPrompt(withPrompt, "X1", "  ").prompts).toEqual({});
  });
});
