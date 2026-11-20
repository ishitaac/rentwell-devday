import { describe, expect, it } from "vitest";

import { DEMO_CANDIDATES } from "./demoData";
import { matchProfiles, rankCandidates } from "./matching";
import { makeField, type FieldKey, type FieldValue, type Priority, type RoommateProfile } from "./types";

type Spec = Partial<Record<FieldKey, FieldValue | [FieldValue, Priority]>>;
function person(id: string, spec: Spec, hasHousing = false): RoommateProfile {
  const fields: RoommateProfile["fields"] = {};
  for (const [k, e] of Object.entries(spec) as Array<[FieldKey, FieldValue | [FieldValue, Priority]]>) {
    const [value, priority] = Array.isArray(e) ? e : [e, "preferred" as Priority];
    fields[k] = makeField(value, { priority, confirmed: true });
  }
  return { profileId: id, demo: true, displayName: id, hasHousing, location: { state: "UT" }, fields };
}

const core: Spec = { sleep: "standard", cleanliness: 3, guestFrequency: "sometimes" };

describe("matching: hard requirements", () => {
  it("budget below a specific home's per-person cost is a requirement conflict when required", () => {
    const a = person("a", { ...core, budgetMax: [900, "required"] });
    const b = person("b", { ...core, budgetMax: 1500 });
    const r = matchProfiles(a, b, { perPersonRent: 1200 });
    expect(r.category).toBe("requirement-conflict");
    expect(r.score).toBeNull();
    expect(r.hardConflicts.map((c) => c.key)).toContain("budgetMax");
  });

  it("a required private bedroom cannot be satisfied by a host's shared bedroom, however well habits match", () => {
    const seeker = person("seeker", { ...core, bedroom: ["private", "required"] });
    const host = person("host", { ...core, bedroom: "shared" }, true);
    const r = matchProfiles(seeker, host);
    expect(r.category).toBe("requirement-conflict");
    expect(r.score).toBeNull();
    expect(r.hardConflicts[0].reason).toContain("seeker requires a private bedroom");
  });

  it("the same bedroom mismatch is not a conflict when it was only a preference", () => {
    const seeker = person("seeker", { ...core, bedroom: "private" });
    const host = person("host", { ...core, bedroom: "shared" }, true);
    expect(matchProfiles(seeker, host).category).not.toBe("requirement-conflict");
  });

  it("a required no-smoking rule conflicts with an 'ok' answer", () => {
    const a = person("a", { ...core, smokingInShared: ["no", "required"] });
    const b = person("b", { ...core, smokingInShared: "ok" });
    expect(matchProfiles(a, b).category).toBe("requirement-conflict");
  });

  it("required move-in timing more than a month apart conflicts", () => {
    const a = person("a", { ...core, moveInMonth: ["2026-12", "required"] });
    const b = person("b", { ...core, moveInMonth: "2027-03" });
    expect(matchProfiles(a, b).hardConflicts.map((c) => c.key)).toContain("moveInMonth");
  });
});

describe("matching: missing and flexible information", () => {
  it("missing preferences are unknown, not incompatible", () => {
    const a = person("a", core);
    const b = person("b", { sleep: "standard" });
    const r = matchProfiles(a, b);
    expect(r.category).toBe("not-enough-info");
    expect(r.score).toBeNull();
    expect(r.unknowns.length).toBeGreaterThan(0);
    expect(r.hardConflicts).toEqual([]);
  });

  it("unconfirmed fields are never used", () => {
    const a = person("a", core);
    const b = person("b", core);
    const unconfirmed: RoommateProfile = { ...b, fields: { ...b.fields, smokingInShared: makeField("ok", { priority: "required", confirmed: false }) } };
    const withIt = matchProfiles({ ...a, fields: { ...a.fields, smokingInShared: makeField("no", { priority: "required", confirmed: true }) } }, unconfirmed);
    expect(withIt.category).not.toBe("requirement-conflict");
  });

  it("flexible preferences raise agreement but a required conflict still wins", () => {
    const strict = matchProfiles(person("a", { sleep: "early", cleanliness: 5, guestFrequency: "rarely" }), person("b", { sleep: "late", cleanliness: 1, guestFrequency: "often" }));
    const flex = matchProfiles(
      person("a", { sleep: ["early", "flexible"], cleanliness: [5, "flexible"], guestFrequency: ["rarely", "flexible"] }),
      person("b", { sleep: ["late", "flexible"], cleanliness: [1, "flexible"], guestFrequency: ["often", "flexible"] }),
    );
    expect((flex.score ?? 0)).toBeGreaterThan(strict.score ?? 0);
  });

  it("scores stay within 0..100", () => {
    for (const c of DEMO_CANDIDATES) {
      const r = matchProfiles(person("me", { sleep: "early", cleanliness: 5, noiseTolerance: 1, guestFrequency: "rarely" }), c.profile);
      if (r.score !== null) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("matching: lifestyle", () => {
  it("conflicting quiet hours show as friction", () => {
    const early = person("e", { sleep: "early", quietStartHour: 21, noiseTolerance: 1 });
    const late = person("l", { sleep: "late", quietStartHour: 24, noiseTolerance: 5 });
    const r = matchProfiles(early, late);
    expect(r.friction.join(" ")).toContain("Sleep schedule");
    expect(r.assessments.find((a) => a.key === "quietStartHour")?.raw).toBeLessThan(0.5);
  });

  it("a vegetarian with separate cookware and a meat-eater who is flexible are compatible in the kitchen", () => {
    const veg = person("v", { ...core, cookwareSharing: "separate", cookingFrequency: "daily" });
    const meat = person("m", { ...core, cookwareSharing: "flexible", cookingFrequency: "daily" });
    const r = matchProfiles(veg, meat);
    expect(r.assessments.find((a) => a.key === "cookwareSharing")?.raw).toBeGreaterThanOrEqual(0.8);
    expect(r.friction.join(" ")).not.toContain("Cookware");
    expect(r.hardConflicts).toEqual([]);
  });

  it("two people who both want separate cookware are fully aligned on it", () => {
    const r = matchProfiles(person("a", { ...core, cookwareSharing: "separate" }), person("b", { ...core, cookwareSharing: "separate" }));
    expect(r.assessments.find((a) => a.key === "cookwareSharing")?.raw).toBe(1);
  });

  it("a genuine kitchen-rule disagreement is reported as friction", () => {
    const r = matchProfiles(person("a", { ...core, cookwareSharing: "separate" }), person("b", { ...core, cookwareSharing: "shared" }));
    expect(r.friction.join(" ")).toContain("Cookware");
  });
});

describe("matching: protected characteristics cannot influence results", () => {
  it("extra protected-looking keys on a profile change nothing", () => {
    const a = person("a", { ...core, cookwareSharing: "separate" });
    const b = person("b", { ...core, cookwareSharing: "flexible" });
    const baseline = matchProfiles(a, b);
    const tainted = { ...b, fields: { ...b.fields, gender: makeField("female", { confirmed: true, priority: "required" }), religion: makeField("x", { confirmed: true, priority: "required" }) } } as unknown as RoommateProfile;
    expect(matchProfiles(a, tainted)).toEqual(baseline);
    // Names and location text are not inputs either.
    expect(matchProfiles(a, { ...b, displayName: "Another Name", location: { state: "UT", city: "Elsewhere", neighborhoods: ["Anywhere"] } })).toEqual(baseline);
  });

  it("assistance animals are never read by matching (no pet key exists)", () => {
    const a = person("a", core);
    const withAnimal = { ...a, fields: { ...a.fields, assistanceAnimal: makeField("yes", { confirmed: true, priority: "required" }) } } as unknown as RoommateProfile;
    expect(matchProfiles(withAnimal, person("b", core))).toEqual(matchProfiles(a, person("b", core)));
  });
});

describe("ranking", () => {
  it("is stable, puts requirement conflicts last, and breaks ties by id", () => {
    const me = person("me", { sleep: "early", cleanliness: 4, bedroom: ["private", "required"], guestFrequency: "rarely" });
    const ranked = rankCandidates(me, DEMO_CANDIDATES.map((c) => c.profile));
    expect(ranked[ranked.length - 1].category).toBe("requirement-conflict");
    expect(rankCandidates(me, [...DEMO_CANDIDATES].reverse().map((c) => c.profile)).map((r) => r.candidateId)).toEqual(ranked.map((r) => r.candidateId));
    const twin1 = person("b-twin", core);
    const twin2 = person("a-twin", core);
    expect(rankCandidates(person("me", core), [twin1, twin2]).map((r) => r.candidateId)).toEqual(["a-twin", "b-twin"]);
  });
});
