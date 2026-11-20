import { makeField, type FieldKey, type FieldValue, type Priority, type RoommateProfile } from "./types";
import type { NegotiationTopic } from "./negotiation";

/**
 * FICTIONAL DEMO DATA. None of these people exist. Their "shared" preferences are fixture values,
 * not the result of any real person's consent, and the UI labels them as such everywhere they appear.
 */

type Spec = Partial<Record<FieldKey, FieldValue | [FieldValue, Priority]>>;

function demoProfile(id: string, name: string, hasHousing: boolean, spec: Spec): RoommateProfile {
  const fields: RoommateProfile["fields"] = {};
  for (const [key, entry] of Object.entries(spec) as Array<[FieldKey, FieldValue | [FieldValue, Priority]]>) {
    const [value, priority] = Array.isArray(entry) ? entry : [entry, "preferred" as Priority];
    fields[key] = makeField(value, { priority, source: "user-form", confirmed: true });
  }
  return { profileId: id, demo: true, displayName: name, hasHousing, location: { state: "UT", city: "Salt Lake City" }, fields };
}

export interface DemoCandidate {
  profile: RoommateProfile;
  tagline: string;
  /** Keys this fictional person "shares" for simulation. Fixture data, not consent. */
  sharedKeys: FieldKey[];
}

const ALL_SHARED: FieldKey[] = ["sleep", "quietStartHour", "noiseTolerance", "workFromHome", "cleanliness", "cookwareSharing", "cookingFrequency", "temperature", "guestFrequency", "overnightGuests", "expenseSplit", "conflictStyle", "bathroom"];

export const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    profile: demoProfile("demo-maya", "Maya (fictional)", true, {
      budgetMax: 1250, moveInMonth: "2026-12", bedroom: "private", bathroom: "shared",
      sleep: "early", quietStartHour: 22, noiseTolerance: 2, workFromHome: "some", cleanliness: 4,
      cookwareSharing: "separate", cookingFrequency: "daily", temperature: "moderate",
      guestFrequency: "rarely", overnightGuests: "sometimes", expenseSplit: "equal", conflictStyle: "scheduled",
    }),
    tagline: "Fictional · graduate student · has a 2-bedroom available",
    sharedKeys: ALL_SHARED,
  },
  {
    profile: demoProfile("demo-alex", "Alex (fictional)", false, {
      budgetMax: 1350, moveInMonth: "2026-12", bedroom: "private", bathroom: "shared",
      sleep: "late", quietStartHour: 24, noiseTolerance: 4, workFromHome: "most", cleanliness: 3,
      cookwareSharing: "flexible", cookingFrequency: "sometimes", temperature: "cool",
      guestFrequency: "often", overnightGuests: "sometimes", expenseSplit: "flexible", conflictStyle: "talk-soon",
    }),
    tagline: "Fictional · designer · searching, works from home",
    sharedKeys: ALL_SHARED,
  },
  {
    profile: demoProfile("demo-riley", "Riley (fictional)", true, {
      budgetMax: 1100, moveInMonth: "2027-02", bedroom: ["shared", "required"], bathroom: "shared",
      sleep: "standard", noiseTolerance: 3, cleanliness: 2,
      cookwareSharing: ["shared", "preferred"], guestFrequency: "sometimes", expenseSplit: "by-use",
    }),
    tagline: "Fictional · researcher · room is a shared bedroom, fewer details shared",
    sharedKeys: ["sleep", "cleanliness", "cookwareSharing", "guestFrequency", "expenseSplit"],
  },
];

// -- negotiator demo fixtures -------------------------------------------------------

/** Neutral wording suggestions per topic (deterministic; users can edit or ignore). */
export const TOPIC_SUGGESTIONS: Record<NegotiationTopic, string[]> = {
  "quiet-hours": ["Quiet hours in shared spaces are 10 PM–7 AM on weeknights and 11 PM–8 AM on weekends; headphones are fine any time.", "Quiet hours start at 10:30 PM on weeknights; we text if we need to adjust for a night."],
  cleaning: ["We rotate kitchen and bathroom cleaning weekly, and dishes get washed within a day.", "Each of us owns specific zones and does a quick weekly reset on Sundays."],
  "kitchen-cookware": ["Each of us keeps a labeled shelf of personal cookware and utensils; shared items are washed right after use.", "We share basic pots and pans; anything personal stays on a labeled shelf."],
  "overnight-guests": ["Overnight guests are fine with a 24-hour heads-up, and no more than 3 nights in a row.", "We give a quick text before guests stay over; hosting stays out of the other person's bedroom area."],
  "shared-purchases": ["We buy household basics (soap, paper goods) in turns and track it in a shared note.", "Shared purchases over $30 are discussed first; everything else is split evenly."],
  "utilities-expenses": ["Utilities are split evenly and paid by the 5th; we flag any bill that is unusually high.", "Rent is fixed per person; utilities split by an agreed method and reviewed each quarter."],
  "shared-bathroom": ["Weekday mornings use rough time blocks, and we text if we are running late.", "First come, first served, with a 15-minute courtesy limit on busy mornings."],
  temperature: ["Thermostat stays between 68–72°F; anything beyond that is handled with fans or blankets in our own rooms.", "We keep it at 70°F and revisit in winter and summer."],
  communication: ["We message for anything non-urgent and talk in person for anything that bothers us within a few days.", "A short weekly check-in on Sunday evening; urgent things by text."],
  "conflict-resolution": ["If something bothers us, we raise it within a few days, privately, and listen first.", "We use a monthly 15-minute check-in and write down any change we agree on."],
};

/** Scripted fictional responses for the demo roommate. Played only when the user presses a labeled button. */
export const DEMO_ROOMMATE_TOPICS: NegotiationTopic[] = ["quiet-hours", "kitchen-cookware", "overnight-guests", "cleaning", "utilities-expenses"];

export const DEMO_ROOMMATE_COUNTER: Partial<Record<NegotiationTopic, string>> = {
  "quiet-hours": "Quiet hours in shared spaces are 10 PM–7 AM on weeknights and 11:30 PM–8 AM on weekends; headphones are fine any time.",
  "kitchen-cookware": "Each of us keeps a labeled shelf of personal cookware and utensils; shared items are washed right after use and put away.",
  "overnight-guests": "Overnight guests are fine with a 24-hour heads-up, up to 2 nights in a row.",
  cleaning: "We rotate kitchen and bathroom cleaning weekly, and dishes get washed the same day.",
  "utilities-expenses": "Utilities are split evenly and paid by the 5th; we flag any unusually high bill.",
};

export const SCENARIO_TOPIC: Record<string, NegotiationTopic> = {
  "quiet-hours": "quiet-hours",
  "work-schedule": "communication",
  "kitchen-cookware": "kitchen-cookware",
  guests: "overnight-guests",
  cleaning: "cleaning",
  bathroom: "shared-bathroom",
  expenses: "utilities-expenses",
  temperature: "temperature",
};
