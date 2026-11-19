import { describe, expect, it } from "vitest";

import {
  ROOMMATE_PROFILES,
  bindPendingRoommate,
  createRoommateSelection,
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
});
