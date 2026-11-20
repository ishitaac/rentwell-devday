import { describe, expect, it } from "vitest";
import { mustHaveResults, mustHaveStops } from "./mustHaves";
import {
  buildSnapshot,
  loadSavedWalkthroughs,
  saveWalkthroughToProfile,
  type KeyValueStore,
} from "./profile";
import { buildQuestions } from "./questions";
import { MISC_SHOTS, tourShots } from "./shots";
import { summarize } from "./summarize";
import { observation, okResult } from "./testFixtures";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const snapshot = (now: string) => {
  const summary = summarize("apartment", [okResult("A2", [observation()])], {
    quickChecks: { A4: "no" },
  });
  return buildSnapshot({
    summary,
    questions: buildQuestions(summary),
    standard: ["Std?"],
    rentalName: "Juniper Row 4B",
    mustHaves: [{ label: "Spacious kitchen", answer: "Yes" }],
    isSample: false,
    now: new Date(now),
  });
};

describe("save walkthrough to profile", () => {
  it("snapshots status, counts, findings, and full questions without photos", () => {
    const s = snapshot("2026-11-20T12:00:00Z");
    expect(s).toMatchObject({
      statusLabel: "Follow-up needed",
      rentalName: "Juniper Row 4B",
      counts: { priority: 1, youNoticed: 1 },
    });
    expect(s.findings[0]).toEqual({
      headline: "Ceiling stain",
      severity: "Priority",
      where: "Ceiling and corners",
    });
    expect(s.questions.at(-1)).toBe("Std?");
    expect(JSON.stringify(s)).not.toMatch(/base64|data:image/);
  });

  it("stores per renter, newest first, capped at five", () => {
    const store = memoryStore();
    for (let i = 0; i < 7; i += 1)
      saveWalkthroughToProfile(store, "Sam@Example.com", snapshot(`2026-11-20T12:0${i}:00Z`));
    const items = loadSavedWalkthroughs(store, "sam@example.com");
    expect(items).toHaveLength(5);
    expect(items[0].savedAt).toBe("2026-11-20T12:06:00.000Z");
    expect(loadSavedWalkthroughs(store, "other@example.com")).toEqual([]);
  });

  it("survives corrupt storage and failing writes", () => {
    const store = memoryStore();
    store.data.set("rentwell.walkthroughs.a@b.co", "{not json");
    expect(loadSavedWalkthroughs(store, "a@b.co")).toEqual([]);
    const failing: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(saveWalkthroughToProfile(failing, "a@b.co", snapshot("2026-11-20T12:00:00Z")).ok).toBe(
      false,
    );
  });
});

describe("must-haves", () => {
  const stops = [...tourShots("apartment"), MISC_SHOTS[0]];

  it("reminds at the first matching stop, or at Anything else when no stop fits", () => {
    const byStop = mustHaveStops(["kitchen", "light", "outdoor"], stops);
    expect(byStop.A1.map((m) => m.id)).toEqual(["kitchen"]);
    expect(byStop.A2.map((m) => m.id)).toEqual(["light"]);
    expect(byStop.X1.map((m) => m.id)).toEqual(["outdoor"]);
  });

  it("reports the renter's answers, and 'Not checked' when unanswered", () => {
    expect(mustHaveResults(["kitchen", "bath"], { kitchen: "no" })).toEqual([
      { id: "kitchen", label: "Spacious kitchen", answer: "No", isNo: true },
      { id: "bath", label: "Updated bathroom", answer: "Not checked", isNo: false },
    ]);
  });
});
