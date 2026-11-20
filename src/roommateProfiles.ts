import type { RoommateSelection } from "./demoAccount";

export type RoommateProfile = {
  id: string;
  initials: string;
  name: string;
  score: number;
  role: string;
  budget: string;
  area: string;
  matches: string[];
  difference: string;
  color: string;
};

export const ROOMMATE_PROFILES: RoommateProfile[] = [
  {
    id: "maya-j",
    initials: "MJ",
    name: "Maya J.",
    score: 94,
    role: "Fictional profile · Graduate student",
    budget: "$1,050–$1,250",
    area: "The Avenues, Central City",
    matches: [
      "Similar tidy-but-not-perfect style",
      "Compatible move-in timing",
      "Friendly, independent home vibe",
    ],
    difference: "Maya starts her day earlier and prefers quiet after 10:30 PM.",
    color: "peach",
  },
  {
    id: "alex-k",
    initials: "AK",
    name: "Alex K.",
    score: 89,
    role: "Fictional profile · UX designer",
    budget: "$1,100–$1,350",
    area: "The Avenues, Downtown",
    matches: [
      "Great fit with your stated housing budget",
      "Similar approach to occasional guests",
      "Both value clear chore expectations",
    ],
    difference: "Alex works from home three days a week.",
    color: "mint-avatar",
  },
  {
    id: "riley-s",
    initials: "RS",
    name: "Riley S.",
    score: 83,
    role: "Fictional profile · Research assistant",
    budget: "$950–$1,200",
    area: "Central City, 9th & 9th",
    matches: ["Flexible on neighborhood", "Compatible shared-space habits", "Same move-in window"],
    difference: "Riley prefers a more social household on weekends.",
    color: "blue-avatar",
  },
];

export function createRoommateSelection(
  profile: RoommateProfile,
  decisionId: string | null,
): RoommateSelection {
  return {
    profileId: profile.id,
    displayName: profile.name,
    compatibilityScore: profile.score,
    decisionId,
  };
}

export function bindPendingRoommate(
  selection: RoommateSelection | null,
  decisionId: string,
): RoommateSelection | null {
  if (!selection) return null;
  if (selection.decisionId === null) return { ...selection, decisionId };
  return selection.decisionId === decisionId ? selection : null;
}

export function resolveRentalSelection(
  selection: RoommateSelection | null,
  decisionId: string,
): {
  roommate: RoommateSelection | null;
  roommateStatus: "not-started" | "selected";
  destination: "listing-details" | "plan-summary";
} {
  const roommate = bindPendingRoommate(selection, decisionId);
  const bindsPendingChoice = selection?.decisionId === null && roommate !== null;
  return {
    roommate,
    roommateStatus: roommate ? "selected" : "not-started",
    destination: bindsPendingChoice ? "plan-summary" : "listing-details",
  };
}
