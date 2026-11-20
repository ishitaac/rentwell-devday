import { describe, expect, it } from "vitest";

import { createExternalRentalDecision } from "./rentalDecision";
import {
  createDemoSession,
  loadDemoSession,
  loadSavedPlan,
  resetRentwellDemoData,
  saveDemoSession,
  saveManagerPilot,
  saveSavedPlan,
  type SavedRentalPlan,
  type StorageLike,
} from "./demoAccount";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  dump() {
    return [...this.values.values()].join("\n");
  }

  has(key: string) {
    return this.values.has(key);
  }
}

const decision = createExternalRentalDecision({
  label: "Campus apartment",
  neighborhood: "Central City",
  askingRent: 1500,
  bedrooms: 2,
  squareFootage: 900,
  mandatoryRecurringFeeTotal: 75,
  noMandatoryRecurringFees: false,
  moveInDate: "2027-01-15",
});

function makePlan(ownerEmail = "olena@example.com"): SavedRentalPlan {
  return {
    version: 1,
    ownerEmail,
    decision,
    decisionOrigin: "rental-entry",
    roommate: null,
    roommateStatus: "not-started",
    advisorReviewedDecisionId: null,
    advisorStatus: "not-started",
    savedAt: "2026-11-19T20:00:00.000Z",
  };
}

describe("demo account persistence", () => {
  it("keeps renter and manager sessions role-separated", () => {
    const storage = new MemoryStorage();
    saveDemoSession(storage, createDemoSession("renter@example.com", "renter"));
    saveDemoSession(
      storage,
      createDemoSession("manager@example.com", "property-manager", "Wasatch Homes"),
    );

    expect(loadDemoSession(storage, "renter")).toMatchObject({
      ok: true,
      value: { role: "renter", email: "renter@example.com" },
    });
    expect(loadDemoSession(storage, "property-manager")).toMatchObject({
      ok: true,
      value: { role: "property-manager", email: "manager@example.com" },
    });
  });

  it("stores plans under normalized owner email without a password", () => {
    const storage = new MemoryStorage();
    const plan = makePlan("  Olena@Example.COM ");

    expect(saveSavedPlan(storage, plan)).toEqual({ ok: true });
    expect(loadSavedPlan(storage, "olena@example.com")).toMatchObject({
      ok: true,
      value: { ownerEmail: "olena@example.com", decision: { title: "Campus apartment" } },
    });
    expect(storage.dump()).not.toContain("password");
  });

  it("does not reveal another email's plan", () => {
    const storage = new MemoryStorage();
    saveSavedPlan(storage, makePlan());

    expect(loadSavedPlan(storage, "different@example.com")).toEqual({ ok: true, value: null });
  });

  it("ignores malformed and incompatible saved data", () => {
    const malformed = new MemoryStorage();
    malformed.setItem("rentwell.demo.saved-plans.v1", "not-json");
    expect(loadSavedPlan(malformed, "olena@example.com")).toEqual({ ok: true, value: null });

    const incompatible = new MemoryStorage();
    incompatible.setItem(
      "rentwell.demo.saved-plans.v1",
      JSON.stringify({ "olena@example.com": { ...makePlan(), version: 2 } }),
    );
    expect(loadSavedPlan(incompatible, "olena@example.com")).toEqual({ ok: true, value: null });

    const invalidFee = new MemoryStorage();
    invalidFee.setItem(
      "rentwell.demo.saved-plans.v1",
      JSON.stringify({
        "olena@example.com": {
          ...makePlan(),
          decision: { ...decision, recurringFees: [null] },
        },
      }),
    );
    expect(loadSavedPlan(invalidFee, "olena@example.com")).toEqual({ ok: true, value: null });
  });

  it("rejects a saved record whose owner does not match its lookup email", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "rentwell.demo.saved-plans.v1",
      JSON.stringify({ "olena@example.com": makePlan("other@example.com") }),
    );

    expect(loadSavedPlan(storage, "olena@example.com")).toEqual({ ok: true, value: null });
  });

  it("returns a failure result when storage throws", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(saveSavedPlan(storage, makePlan())).toEqual({
      ok: false,
      error: "Browser storage is unavailable.",
    });
    expect(loadSavedPlan(storage, "olena@example.com")).toEqual({
      ok: false,
      value: null,
      error: "Browser storage is unavailable.",
    });
    expect(saveManagerPilot(storage, "started")).toEqual({
      ok: false,
      error: "Browser storage is unavailable.",
    });
    expect(resetRentwellDemoData(storage)).toEqual({
      ok: false,
      error: "Browser storage is unavailable.",
    });
  });

  it("reset removes only RentWell demo keys after confirmation", () => {
    const storage = new MemoryStorage();
    storage.setItem("unrelated.preference", "keep me");
    saveDemoSession(storage, createDemoSession("renter@example.com", "renter"));
    saveSavedPlan(storage, makePlan("renter@example.com"));

    expect(resetRentwellDemoData(storage)).toEqual({ ok: true });
    expect(storage.has("rentwell.demo.session.renter")).toBe(false);
    expect(storage.has("rentwell.demo.saved-plans.v1")).toBe(false);
    expect(storage.has("unrelated.preference")).toBe(true);
  });
});
