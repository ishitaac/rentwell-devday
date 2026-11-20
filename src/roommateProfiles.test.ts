import { describe, expect, it } from "vitest";

import {
  ROOMMATE_PROFILES,
  bindPendingRoommate,
  createRoommateSelection,
  resolveRentalSelection,
} from "./roommateProfiles";

describe("roommate selection", () => {
  it("creates a pending roommate-first choice without rental costs", () => {
    const selection = createRoommateSelection(ROOMMATE_PROFILES[0], null);

    expect(selection).toEqual({
      profileId: "maya-j",
      displayName: "Maya J.",
      compatibilityScore: 94,
      decisionId: null,
    });
    expect(selection).not.toHaveProperty("rent");
    expect(selection).not.toHaveProperty("monthlyShare");
  });

  it("binds a pending choice to exactly one selected rental", () => {
    const pending = createRoommateSelection(ROOMMATE_PROFILES[1], null);

    expect(bindPendingRoommate(pending, "rental-one")).toEqual({
      ...pending,
      decisionId: "rental-one",
    });
    expect(bindPendingRoommate({ ...pending, decisionId: "rental-one" }, "rental-one")).toEqual({
      ...pending,
      decisionId: "rental-one",
    });
  });

  it("clears a roommate bound to a different decision", () => {
    const bound = createRoommateSelection(ROOMMATE_PROFILES[2], "rental-one");

    expect(bindPendingRoommate(bound, "rental-two")).toBeNull();
  });

  it("binds a pending roommate and opens the plan when a rental is selected", () => {
    const pending = createRoommateSelection(ROOMMATE_PROFILES[0], null);

    expect(resolveRentalSelection(pending, "rental-one")).toEqual({
      roommate: { ...pending, decisionId: "rental-one" },
      roommateStatus: "selected",
      destination: "plan-summary",
    });
  });

  it("opens a receipt and clears a roommate bound to another rental", () => {
    const bound = createRoommateSelection(ROOMMATE_PROFILES[0], "rental-one");

    expect(resolveRentalSelection(bound, "rental-two")).toEqual({
      roommate: null,
      roommateStatus: "not-started",
      destination: "listing-details",
    });
  });
});
