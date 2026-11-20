import { describe, expect, it } from "vitest";
import { cacheKey, hashBytes, ResultCache, type KeyValueStore } from "./cache";
import { readCaptureDate } from "./exif";
import {
  buildQuestions,
  cleanLocation,
  CONDITION_REPORT_QUESTION,
  formatEmail,
  standardQuestions,
} from "./questions";
import { runLimited } from "./queue";
import {
  addToTray,
  assignFromTray,
  changeUnitType,
  clearSlot,
  initialCaptureState,
  placePhoto,
  setNote,
  type CapturedPhoto,
} from "./session";
import { allShots, UNIT_TYPES } from "./shots";
import { NO_CONCERNS_LINE, summarize } from "./summarize";
import { CATEGORIES, UNIT_TYPE_IDS } from "./types";
import { CLOSER_PHOTO_NOTE, findBannedWord, validatePhotoResult } from "./validate";
import { APARTMENT_IDS, failed, observation, okResult, unassessable } from "./testFixtures";

const rawResult = (overrides: Record<string, unknown> = {}, obs: object[] = [observation()]) => ({
  assessable: true,
  notAssessableReason: null,
  imageQuality: "good",
  observations: obs,
  ...overrides,
});

describe("T01 validate", () => {
  it("accepts a well-formed result", () => {
    const outcome = validatePhotoResult(rawResult(), "apartment", "A2");
    expect(outcome.ok).toBe(true);
  });

  it("rejects an invalid enum", () => {
    const outcome = validatePhotoResult(
      rawResult({}, [observation({ severity: "critical" as never })]),
      "apartment",
      "A2",
    );
    expect(outcome).toMatchObject({ ok: false, code: "invalid" });
  });

  it("rejects a missing field", () => {
    const { assessable: _drop, ...missing } = rawResult();
    expect(validatePhotoResult(missing, "apartment", "A2")).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(
      validatePhotoResult(rawResult({}, [{ ...observation(), description: "" }]), "apartment", "A2")
        .ok,
    ).toBe(false);
  });

  it.each([
    "The ceiling looks safe",
    "Window frame in good condition",
    "This would fail inspection",
    "Possible mold near the tub",
    "Looks approved",
  ])("rejects banned wording: %s", (description) => {
    const outcome = validatePhotoResult(
      rawResult({}, [observation({ description })]),
      "apartment",
      "A2",
    );
    expect(outcome).toMatchObject({ ok: false, code: "banned_word" });
  });

  it("does not flag ordinary words that contain banned roots", () => {
    expect(findBannedWord("Hallway passage with visible safety signage")).toBeNull();
  });

  it("rejects unknown shots and non-objects", () => {
    expect(validatePhotoResult(rawResult(), "apartment", "H4").ok).toBe(false);
    expect(validatePhotoResult("hello", "apartment", "A2").ok).toBe(false);
  });

  it("drops categories outside the shot, but keeps visible_safety and water_moisture", () => {
    const outcome = validatePhotoResult(
      rawResult({}, [
        observation({ category: "yard_grounds" }),
        observation({ category: "visible_safety" }),
        observation({ category: "water_moisture" }),
      ]),
      "apartment",
      "A2",
    );
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.result.observations.map((o) => o.category)).toEqual([
      "visible_safety",
      "water_moisture",
    ]);
  });

  it("caps descriptions at 140 characters", () => {
    const outcome = validatePhotoResult(
      rawResult({}, [observation({ description: "x ".repeat(200) })]),
      "apartment",
      "A2",
    );
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.result.observations[0].description.length).toBeLessThanOrEqual(140);
  });

  it("ignores observations on an unassessable photo", () => {
    const outcome = validatePhotoResult(
      rawResult({ assessable: false, notAssessableReason: "too dark", imageQuality: "poor" }),
      "apartment",
      "A2",
    );
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.result.observations).toEqual([]);
    expect(outcome.result.notAssessableReason).toBe("too dark");
  });
});

describe("T02 caps", () => {
  it("caps low-confidence priority at follow_up and asks for a closer photo", () => {
    const outcome = validatePhotoResult(
      rawResult({}, [observation({ confidence: "low", severity: "priority" })]),
      "apartment",
      "A2",
    );
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.result.observations[0]).toMatchObject({
      severity: "follow_up",
      capNote: CLOSER_PHOTO_NOTE,
    });
  });

  it("caps low-confidence stop_and_verify too", () => {
    const outcome = validatePhotoResult(
      rawResult({}, [observation({ confidence: "low", severity: "stop_and_verify" })]),
      "apartment",
      "A2",
    );
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.result.observations[0].severity).toBe("follow_up");
  });

  it("clears severity on no-concern items and defaults a missing concern severity to follow_up", () => {
    const outcome = validatePhotoResult(
      rawResult({}, [
        observation({ finding: "no_concern_visible", severity: "priority" }),
        observation({ severity: null }),
      ]),
      "apartment",
      "A2",
    );
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.result.observations.map((o) => o.severity)).toEqual([null, "follow_up"]);
  });
});

describe("T03 summarize precedence", () => {
  const all = (extra: Parameters<typeof summarize>[1] = []) => [
    ...APARTMENT_IDS.filter((id) => !extra.some((e) => e.shotId === id)).map((id) => okResult(id)),
    ...extra,
  ];

  it("stop_and_verify beats priority", () => {
    const s = summarize(
      "apartment",
      all([
        okResult("A1", [observation({ category: "water_moisture", severity: "stop_and_verify" })]),
        okResult("A2", [observation()]),
      ]),
    );
    expect(s.statusLabel).toBe("Pause and verify");
    expect(s.concerns[0].severity).toBe("stop_and_verify");
  });

  it("priority beats incomplete", () => {
    const s = summarize("apartment", [okResult("A2", [observation()])]);
    expect(s.statusLabel).toBe("Follow-up needed");
    expect(s.notCheckedCount).toBe(5);
  });

  it("incomplete beats recorded", () => {
    const s = summarize("apartment", all([unassessable("A3")]));
    expect(s.statusLabel).toBe("Incomplete evidence");
    expect(s.gaps).toEqual([expect.objectContaining({ shotId: "A3", kind: "not_assessable" })]);
  });

  it("all clear is 'Walkthrough recorded' with the no-concerns line, never 'good condition'", () => {
    const s = summarize("apartment", all());
    expect(s.statusLabel).toBe("Walkthrough recorded");
    expect(s.showNoConcernsLine).toBe(true);
    expect(NO_CONCERNS_LINE).not.toMatch(/good condition/i);
  });

  it("counts failed analyses as not checked", () => {
    const s = summarize("apartment", all([failed("A6")]));
    expect(s.notCheckedCount).toBe(1);
    expect(s.gaps[0]).toMatchObject({ kind: "failed", reason: "Could not analyze" });
  });
});

describe("T04 no evidence", () => {
  it("all unassessable gives 'No walkthrough evidence recorded', never 'No concerns'", () => {
    const s = summarize(
      "apartment",
      APARTMENT_IDS.map((id) => unassessable(id)),
    );
    expect(s.statusLabel).toBe("No walkthrough evidence recorded");
    expect(s.showNoConcernsLine).toBe(false);
  });

  it("no photos at all is also no evidence", () => {
    expect(summarize("apartment", []).statusLabel).toBe("No walkthrough evidence recorded");
  });
});

describe("T05 questions", () => {
  it("renders the location hint in the template", () => {
    const s = summarize("apartment", [okResult("A2", [observation()])]);
    const qs = buildQuestions(s);
    expect(qs[0]).toMatchObject({ sourceShotId: "A2", kind: "finding" });
    expect(qs[0].text).toBe(
      "Will the upper left corner near the window be repaired or repainted before move-in, and can you confirm that in writing?",
    );
  });

  it("asks to see not-checked shots before signing and adds the condition report", () => {
    const s = summarize("apartment", [
      okResult("A1", [
        observation({ category: "water_moisture", locationHint: "near the P-trap" }),
      ]),
    ]);
    const texts = buildQuestions(s).map((q) => q.text);
    expect(texts[0]).toBe(
      "Can you confirm in writing the cause and repair timeline for the staining near the P-trap?",
    );
    expect(texts).toContain("Can I see the bathroom tub, shower, and caulk lines before I sign?");
    expect(texts.at(-1)).toBe(CONDITION_REPORT_QUESTION);
  });

  it("has a template for every category", () => {
    for (const category of CATEGORIES) {
      const s = summarize("apartment", [
        okResult("AO3", [
          observation({ category: category === "visible_safety" ? category : "visible_safety" }),
        ]),
      ]);
      expect(buildQuestions(s).length).toBeGreaterThan(0);
    }
  });

  it("falls back to the shot when the hint is empty", () => {
    expect(cleanLocation("  ", "kitchen sink")).toBe("kitchen sink");
    expect(cleanLocation("Near the window.", "x")).toBe("the window");
  });

  it("formats an email", () => {
    const email = formatEmail(["Q1?", "Q2?"], {
      rentalName: "Juniper Row 4B",
      unitTypeLabel: "Apartment or condo",
    });
    expect(email).toContain(
      "Subject: Questions after touring the apartment or condo at Juniper Row 4B",
    );
    expect(email).toContain("1. Q1?\n2. Q2?");
  });
});

describe("T06 hash cache", () => {
  it("returns the cached result for identical bytes and the same shot", async () => {
    const store = new Map<string, string>();
    const kv: KeyValueStore = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    };
    const bytes = new TextEncoder().encode("same image");
    const keyA = cacheKey(await hashBytes(bytes), "apartment", "A2");
    const keyB = cacheKey(
      await hashBytes(new TextEncoder().encode("same image")),
      "apartment",
      "A2",
    );
    expect(keyA).toBe(keyB);
    const cache = new ResultCache(kv);
    const entry = okResult("A2", [observation()]);
    if (entry.state !== "ok") throw new Error();
    cache.set(keyA, entry.result);
    expect(new ResultCache(kv).get(keyB)).toEqual(entry.result);
    expect(cache.get(cacheKey(await hashBytes(bytes), "apartment", "A3"))).toBeNull();
  });
});

describe("T07 unit types", () => {
  it.each(UNIT_TYPE_IDS)(
    "%s has exactly 6 required shots with valid categories and unique ids",
    (type) => {
      const config = UNIT_TYPES[type];
      expect(config.required).toHaveLength(6);
      const shots = allShots(type);
      expect(new Set(shots.map((s) => s.id)).size).toBe(shots.length);
      for (const shot of shots) {
        expect(CATEGORIES).toContain(shot.category);
        for (const related of shot.related) expect(CATEGORIES).toContain(related);
      }
    },
  );
});

describe("T08 summarize uses the selected type's shots", () => {
  it("an apartment with 6 assessable photos is complete", () => {
    expect(
      summarize(
        "apartment",
        APARTMENT_IDS.map((id) => okResult(id)),
      ).notCheckedCount,
    ).toBe(0);
  });

  it("a house missing H6 has one gap", () => {
    const s = summarize(
      "single_family",
      ["H1", "H2", "H3", "H4", "H5"].map((id) => okResult(id)),
    );
    expect(s.gaps).toEqual([expect.objectContaining({ shotId: "H6", kind: "not_taken" })]);
    expect(s.coverageText).toBe("5 of 6 shots checked");
  });

  it("ignores results for shots of another type", () => {
    const s = summarize(
      "single_family",
      APARTMENT_IDS.map((id) => okResult(id, [observation()])),
    );
    expect(s.concernCount).toBe(0);
    expect(s.statusLabel).toBe("No walkthrough evidence recorded");
  });
});

describe("T09 standard questions", () => {
  it("each type shows its own two questions and no other type's", () => {
    for (const type of UNIT_TYPE_IDS) {
      const own = standardQuestions(type);
      expect(own).toHaveLength(2);
      for (const other of UNIT_TYPE_IDS.filter((t) => t !== type)) {
        for (const q of standardQuestions(other)) expect(own).not.toContain(q);
      }
    }
  });
});

const photo = (id: string): CapturedPhoto => ({
  id,
  base64: "AAAA",
  takenAt: null,
  takenAtSource: "none",
  fileName: `${id}.jpg`,
});

describe("T10 unit type switch", () => {
  it("asks for confirmation when photos are assigned, then clears slots", () => {
    const filled = placePhoto(initialCaptureState("apartment"), "A1", photo("p1"));
    expect(changeUnitType(filled, "single_family", false)).toEqual({ kind: "needs_confirmation" });
    const changed = changeUnitType(filled, "single_family", true);
    expect(changed.kind).toBe("changed");
    if (changed.kind === "changed") {
      expect(changed.state.unitType).toBe("single_family");
      expect(changed.state.slots).toEqual({});
    }
  });

  it("switches without asking when nothing is assigned", () => {
    expect(changeUnitType(initialCaptureState("apartment"), "townhome", false).kind).toBe(
      "changed",
    );
  });
});

describe("session tray", () => {
  it("assigns tray photos to slots and returns displaced photos to the tray", () => {
    let state = addToTray(initialCaptureState("apartment"), [photo("p1"), photo("p2")]);
    state = assignFromTray(state, "p1", "A1");
    state = assignFromTray(state, "p2", "A1");
    expect(state.slots.A1).toBe("p2");
    expect(state.tray).toEqual(["p1"]);
  });

  it("clears a slot and its note without mutating the old state", () => {
    const before = setNote(
      placePhoto(initialCaptureState("apartment"), "A1", photo("p1")),
      "A1",
      "Landlord said it will be fixed",
    );
    const after = clearSlot(before, "A1");
    expect(after.slots).toEqual({});
    expect(after.notes).toEqual({});
    expect(before.slots.A1).toBe("p1");
  });
});

describe("queue", () => {
  it("never runs more than the limit at once and keeps order", async () => {
    let active = 0;
    let peak = 0;
    const results = await runLimited([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      if (n === 4) throw new Error("boom");
      return n * 2;
    });
    expect(peak).toBe(3);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : "x"))).toEqual([
      2,
      4,
      6,
      "x",
      10,
      12,
      14,
    ]);
  });
});

describe("exif", () => {
  function jpegWithDate(date: string): ArrayBuffer {
    // Minimal big-endian TIFF: IFD0 with one DateTime entry.
    const ascii = new TextEncoder().encode(`${date}\0`);
    const tiff = new Uint8Array(8 + 2 + 12 + 4 + ascii.length);
    const v = new DataView(tiff.buffer);
    v.setUint16(0, 0x4d4d);
    v.setUint16(2, 42);
    v.setUint32(4, 8);
    v.setUint16(8, 1);
    v.setUint16(10, 0x0132);
    v.setUint16(12, 2);
    v.setUint32(14, ascii.length);
    v.setUint32(18, 26);
    tiff.set(ascii, 26);
    const app1 = new Uint8Array(4 + 6 + tiff.length);
    const a = new DataView(app1.buffer);
    a.setUint16(0, 0xffe1);
    a.setUint16(2, 2 + 6 + tiff.length);
    app1.set(new TextEncoder().encode("Exif\0\0"), 4);
    app1.set(tiff, 10);
    const out = new Uint8Array(2 + app1.length + 2);
    out.set([0xff, 0xd8], 0);
    out.set(app1, 2);
    out.set([0xff, 0xda], 2 + app1.length);
    return out.buffer;
  }

  it("reads the capture date", () => {
    expect(readCaptureDate(jpegWithDate("2026:11:20 09:41:07"))).toBe("2026-11-20T09:41:07");
  });

  it("returns null for non-JPEG or missing EXIF", () => {
    expect(readCaptureDate(new Uint8Array([1, 2, 3, 4]).buffer)).toBeNull();
    expect(readCaptureDate(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 0]).buffer)).toBeNull();
  });
});
