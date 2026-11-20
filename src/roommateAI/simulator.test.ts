import { describe, expect, it } from "vitest";

import { DEMO_CANDIDATES } from "./demoData";
import { applyNarrations, buildScenarios, dayTimeline, narrationInput, SIMULATOR_DISCLAIMER, validateNarration } from "./simulator";
import { makeField, type FieldKey, type FieldValue, type RoommateProfile } from "./types";

function person(spec: Partial<Record<FieldKey, FieldValue>>, id = "me"): RoommateProfile {
  const fields: RoommateProfile["fields"] = {};
  for (const [k, v] of Object.entries(spec) as Array<[FieldKey, FieldValue]>) fields[k] = makeField(v, { confirmed: true });
  return { profileId: id, demo: false, displayName: id, hasHousing: false, location: {}, fields };
}

const me = person({ sleep: "late", cleanliness: 4, cookwareSharing: "separate", guestFrequency: "often" });
const maya = DEMO_CANDIDATES[0];

describe("simulator scenarios", () => {
  it("builds shared scenarios from consented keys, most-to-discuss first", () => {
    const s = buildScenarios(me, maya.profile, { fromMatch: maya.sharedKeys });
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.mode === "shared")).toBe(true);
    expect(s[0].agreement as number).toBeLessThanOrEqual(s[s.length - 1].agreement as number);
    for (const x of s) {
      expect(x.title.length).toBeGreaterThan(0);
      expect(x.whatIf.length).toBeGreaterThanOrEqual(2);
      expect(x.compromise.length).toBeGreaterThan(0);
      expect(x.discussionQuestion).toContain("?");
      expect(x.uncertainty).toBe(SIMULATOR_DISCLAIMER);
    }
  });

  it("without the match's consent it is a clearly labeled single-user preview and never uses their values", () => {
    const s = buildScenarios(me, maya.profile, { fromMatch: [] });
    expect(s.length).toBeGreaterThan(0);
    for (const x of s) {
      expect(x.mode).toBe("single-user-preview");
      expect(x.relevantPreferences.every((p) => p.who === "you")).toBe(true);
      expect(x.agreement).toBeNull();
    }
    const text = JSON.stringify(s);
    expect(text).not.toContain('"early"');
  });

  it("uses only keys the match actually shared", () => {
    const s = buildScenarios(me, maya.profile, { fromMatch: ["sleep"] });
    const prefs = s.flatMap((x) => x.relevantPreferences).filter((p) => p.who === "match");
    expect(prefs.every((p) => p.key === "sleep")).toBe(true);
  });

  it("handles missing data without inventing facts", () => {
    expect(buildScenarios(person({}), maya.profile, { fromMatch: maya.sharedKeys })).toEqual([]);
    const only = buildScenarios(person({ temperature: "cool" }), null);
    expect(only.map((s) => s.id)).toEqual(["temperature"]);
    expect(only[0].situation).toContain("a different habit (not shared)");
  });

  it("never generates protected-trait scenarios or judgments", () => {
    const text = JSON.stringify(buildScenarios(me, maya.profile, { fromMatch: maya.sharedKeys }, 10)).toLowerCase();
    for (const bad of ["religio", "gender", "race", "disab", "famil", "nationality", "diagnos", "dangerous", "trustworth"]) expect(text).not.toContain(bad);
  });

  it("ignores unconfirmed values", () => {
    const unconfirmed: RoommateProfile = { ...me, fields: { sleep: makeField("late", { confirmed: false }) } };
    expect(buildScenarios(unconfirmed, null)).toEqual([]);
  });

  it("builds a timeline only from confirmed sleep values and shows 'not shared' without consent", () => {
    expect(dayTimeline(person({}), null)).toBeNull();
    expect(dayTimeline(me, maya.profile, { fromMatch: [] })?.[0].match).toBe("not shared");
    expect(dayTimeline(me, maya.profile, { fromMatch: ["sleep"] })?.[0].match).toBe("6:00 AM");
  });
});

describe("Claude narration is validated or discarded", () => {
  const scenarios = buildScenarios(me, maya.profile, { fromMatch: maya.sharedKeys }, 3);
  const target = scenarios[0];
  const good = { id: target.id, situation: target.situation, friction: target.friction, compromise: target.compromise, discussionQuestion: target.discussionQuestion };

  it("accepts a faithful rewrite", () => {
    expect(validateNarration(good, target)).not.toBeNull();
    const out = applyNarrations(scenarios, [good]);
    expect(out[0].narrated).toBe(true);
    expect(out[1].narrated).toBe(false);
  });

  it.each([
    ["protected term", { ...good, friction: "This is hard because she is a woman." }],
    ["character judgment", { ...good, friction: "He is a toxic person who is dangerous." }],
    ["invented number", { ...good, compromise: "Set quiet hours at 9:15 and pay $400." }],
    ["invented name", { ...good, situation: "On Tuesday, one housemate called Priya stays up late." }],
    ["too long", { ...good, situation: "x".repeat(401) }],
    ["wrong id", { ...good, id: "other" }],
    ["missing field", { id: good.id, situation: good.situation }],
  ])("rejects %s and falls back to deterministic text", (_name, bad) => {
    expect(validateNarration(bad, target)).toBeNull();
    const out = applyNarrations(scenarios, [bad]);
    expect(out[0].narrated).toBe(false);
    expect(out[0].situation).toBe(target.situation);
  });

  it("falls back entirely when the model returns nothing (API failure)", () => {
    expect(applyNarrations(scenarios, undefined)).toEqual(scenarios);
    expect(applyNarrations(scenarios, "garbage")).toEqual(scenarios);
  });

  it("sends the model only compact scenario data without people's names", () => {
    const payload = JSON.stringify(narrationInput(scenarios));
    expect(payload).not.toContain("Maya");
    expect(payload).not.toContain("demo-maya");
  });
});
