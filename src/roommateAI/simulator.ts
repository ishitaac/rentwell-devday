import { mentionsProtectedTerm, screenProtectedLanguage } from "./compliance";
import { agreement } from "./matching";
import { FIELD_DEFS, type FieldKey, type FieldValue, type RoommateProfile, confirmed } from "./types";

/**
 * Living Together Simulator: deterministic scenario selection and text, with optional Claude narration
 * that must pass validation or be discarded in favor of the deterministic text.
 * Scenarios are hypothetical conversation starters. They are not predictions, assessments or findings.
 */

export const SIMULATOR_DISCLAIMER =
  "This is a hypothetical scenario built from the preferences shown. It is not a prediction of what will happen, and it says nothing about anyone's character.";

export type ScenarioMode = "shared" | "single-user-preview";

export interface ScenarioPreference {
  who: "you" | "match";
  key: FieldKey;
  label: string;
  value: string;
}

export interface WhatIf {
  label: string;
  outcome: string;
}

export interface Scenario {
  id: string;
  category: string;
  mode: ScenarioMode;
  title: string;
  situation: string;
  relevantPreferences: ScenarioPreference[];
  friction: string;
  compromise: string;
  discussionQuestion: string;
  uncertainty: string;
  whatIf: WhatIf[];
  /** 0..1 agreement used only to order scenarios; null in single-user previews. */
  agreement: number | null;
  narrated: boolean;
}

/** Which keys each user has approved sharing with this specific match. */
export interface SharingConsent {
  /** Keys the OTHER person approved sharing with you for this simulation. Empty = no consent. */
  fromMatch: readonly FieldKey[];
}

interface ScenarioDef {
  id: string;
  category: string;
  keys: FieldKey[];
  title: string;
  situation: (v: Vals) => string;
  friction: (v: Vals) => string;
  compromise: (v: Vals) => string;
  question: string;
  whatIf: (v: Vals) => WhatIf[];
}

type Vals = Record<string, string>;

const SCENARIOS: ScenarioDef[] = [
  {
    id: "quiet-hours",
    category: "Early riser vs. night owl",
    keys: ["sleep", "quietStartHour"],
    title: "A weeknight at different rhythms",
    situation: (v) => `On a weeknight, one housemate's schedule is "${v.a_sleep}" and the other's is "${v.b_sleep}". One is winding down while the other is just getting going.`,
    friction: () => "Evening noise, light and kitchen use can overlap with someone else's wind-down time.",
    compromise: () => "Agree on a window for quiet shared spaces, and which activities (headphones, door closed, kitchen use) are fine outside it.",
    question: "What does 'quiet' mean to each of you on a weeknight, and when does it start?",
    whatIf: () => [
      { label: "Quiet hours start at 10 PM", outcome: "The earlier sleeper gets predictable rest; the later one moves loud activities to their room or headphones after 10." },
      { label: "Quiet hours start at 11 PM", outcome: "The later sleeper keeps more evening time; the earlier one may want a white-noise or earplug backup." },
    ],
  },
  {
    id: "work-schedule",
    category: "Different study/work-from-home schedules",
    keys: ["workFromHome", "noiseTolerance"],
    title: "A workday at home",
    situation: (v) => `One housemate works or studies from home "${v.a_workFromHome}", the other "${v.b_workFromHome}". Calls, typing and kitchen noise share the same walls.`,
    friction: () => "Daytime noise and shared-space use may matter more to the person who is home most.",
    compromise: () => "Share a weekly calendar for calls and focus time, and agree where each person works.",
    question: "Which hours do you most need quiet, and where do you like to work?",
    whatIf: () => [
      { label: "Shared calendar for calls", outcome: "Both see when focus time matters; fewer surprises." },
      { label: "Common areas stay free for calls before noon", outcome: "The person home most gets a quiet morning; the other uses the living room later." },
    ],
  },
  {
    id: "kitchen-cookware",
    category: "Shared cookware boundaries",
    keys: ["cookwareSharing", "cookingFrequency"],
    title: "Cooking dinner on the same night",
    situation: (v) => `One housemate prefers "${v.a_cookwareSharing}" cookware and utensils; the other prefers "${v.b_cookwareSharing}". Both want to cook around 7 PM.`,
    friction: () => "Pots, pans and utensils can be a quiet source of tension when expectations differ.",
    compromise: () => "Label shelves for personal vs. shared items, and agree how shared items get cleaned.",
    question: "Which kitchen items are shared, which are personal, and who cleans what?",
    whatIf: () => [
      { label: "Separate labeled shelves", outcome: "Personal items stay personal; shared items are clearly named." },
      { label: "Everything shared, wash right after use", outcome: "Works if both agree on 'wash right after use' and what counts as clean." },
    ],
  },
  {
    id: "guests",
    category: "Guests and social activities",
    keys: ["guestFrequency", "overnightGuests"],
    title: "A Friday with friends over",
    situation: (v) => `One housemate likes guests "${v.a_guestFrequency}" and the other "${v.b_guestFrequency}". A group is coming over Friday evening.`,
    friction: () => "Noise, common-area use and notice expectations may differ.",
    compromise: () => "Agree on a heads-up window, shared-space limits and a quiet time for gatherings.",
    question: "How much notice would you like before guests come over, and how late is fine?",
    whatIf: () => [
      { label: "24-hour heads-up", outcome: "Predictability for the person who prefers a quieter home." },
      { label: "Heads-up only for overnight guests", outcome: "More spontaneity for hosting; the quieter housemate still gets notice for overnights." },
    ],
  },
  {
    id: "cleaning",
    category: "Cleaning schedules",
    keys: ["cleanliness"],
    title: "The sink after a busy week",
    situation: (v) => `One housemate rates tidiness ${v.a_cleanliness}/5 and the other ${v.b_cleanliness}/5. Dishes have piled up midweek.`,
    friction: () => "'Clean enough' can mean different things.",
    compromise: () => "Define a short baseline (dishes within a day, weekly deep-clean rotation) instead of a general standard.",
    question: "What does 'clean enough' look like for the kitchen and bathroom?",
    whatIf: () => [
      { label: "Weekly rotation", outcome: "Responsibilities are explicit and rotate." },
      { label: "Split by area", outcome: "Each person owns specific zones, so there is no daily negotiation." },
    ],
  },
  {
    id: "bathroom",
    category: "Shared bathroom routines",
    keys: ["bathroom", "sleep"],
    title: "A busy morning",
    situation: (v) => `The housemates share a bathroom, with sleep schedules "${v.a_sleep}" and "${v.b_sleep}". Both need it before 8:30 AM.`,
    friction: () => "Morning overlap can create waiting and noise.",
    compromise: () => "Agree on rough time blocks and what to do when running late.",
    question: "When do you each usually use the bathroom, and what would help on a rushed morning?",
    whatIf: () => [
      { label: "Rough time blocks", outcome: "Each person has a predictable window; flexibility on request." },
      { label: "First-come with a 15-minute courtesy", outcome: "Simple, but depends on both honoring the courtesy." },
    ],
  },
  {
    id: "expenses",
    category: "Shared expense expectations",
    keys: ["expenseSplit"],
    title: "The utilities bill arrives",
    situation: (v) => `One housemate prefers to split shared costs "${v.a_expenseSplit}" and the other "${v.b_expenseSplit}". A higher-than-usual bill arrives.`,
    friction: () => "Different assumptions about fairness show up when costs change.",
    compromise: () => "Agree on how recurring bills and one-off purchases are split, and how changes are communicated.",
    question: "How should we split utilities and shared purchases, and how do we handle a surprise bill?",
    whatIf: () => [
      { label: "Equal split on everything", outcome: "Simple to track; may feel uneven if usage differs a lot." },
      { label: "Equal rent, split utilities by use where measurable", outcome: "Closer to actual use; requires an agreed way to measure it." },
    ],
  },
  {
    id: "temperature",
    category: "Temperature preferences",
    keys: ["temperature"],
    title: "The thermostat in January",
    situation: (v) => `One housemate likes the home "${v.a_temperature}" and the other "${v.b_temperature}". The thermostat is in the hallway.`,
    friction: () => "A single thermostat means one setting for two preferences.",
    compromise: () => "Agree on a range, and use personal heating, cooling or bedding to cover the difference.",
    question: "What temperature range works, and who adjusts the thermostat when?",
    whatIf: () => [
      { label: "Agree on a middle range", outcome: "Nobody gets their ideal; both stay within a tolerable range." },
      { label: "Personal fan or space heater in bedrooms", outcome: "Shared rooms stay moderate; comfort is handled in private rooms." },
    ],
  },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);

function label(key: FieldKey, value: FieldValue): string {
  return `${FIELD_DEFS[key].label}: ${String(value)}`;
}

/**
 * Build scenarios. Shared mode uses a match's value for a key ONLY if that key is in consent.fromMatch.
 * Otherwise the scenario is a single-user preview using only the user's own confirmed values and a
 * generic, clearly unknown counterpart.
 */
export function buildScenarios(me: RoommateProfile, other: RoommateProfile | null, consent: SharingConsent = { fromMatch: [] }, limit = 4): Scenario[] {
  const out: Scenario[] = [];
  for (const def of SCENARIOS) {
    const myKeys = def.keys.filter((k) => confirmed(me, k));
    if (myKeys.length === 0) continue;
    const vals: Vals = {};
    const prefs: ScenarioPreference[] = [];
    let sharedUsable = false;
    let agree: number | null = null;
    for (const key of def.keys) {
      const mine = confirmed(me, key);
      const theirs = other && consent.fromMatch.includes(key) ? confirmed(other, key) : undefined;
      vals[`a_${key}`] = mine ? String(mine.value) : "unspecified";
      vals[`b_${key}`] = theirs ? String(theirs.value) : "unspecified";
      if (mine) prefs.push({ who: "you", key, label: FIELD_DEFS[key].label, value: String(mine.value) });
      if (theirs) prefs.push({ who: "match", key, label: FIELD_DEFS[key].label, value: String(theirs.value) });
      if (mine && theirs) {
        sharedUsable = true;
        const ag = agreement(key, mine.value, theirs.value);
        agree = agree === null ? ag : Math.min(agree, ag);
      }
    }
    // Shared mode needs at least one key both people have shared.
    const mode: ScenarioMode = sharedUsable ? "shared" : "single-user-preview";
    if (mode === "single-user-preview") {
      for (const key of def.keys) vals[`b_${key}`] = "a different habit (not shared)";
    }
    out.push({
      id: def.id,
      category: def.category,
      mode,
      title: def.title,
      situation: def.situation(vals),
      relevantPreferences: prefs,
      friction: def.friction(vals),
      compromise: def.compromise(vals),
      discussionQuestion: def.question,
      uncertainty: SIMULATOR_DISCLAIMER,
      whatIf: def.whatIf(vals),
      agreement: mode === "shared" ? agree : null,
      narrated: false,
    });
  }
  // Order: shared scenarios with the lowest agreement first (most to discuss), then previews in library order.
  const order = (s: Scenario) => (s.mode === "shared" ? (s.agreement ?? 1) : 2);
  return out
    .map((s, i) => ({ s, i }))
    .sort((x, y) => order(x.s) - order(y.s) || x.i - y.i)
    .map((x) => x.s)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Optional narration by Claude: validated, or discarded
// ---------------------------------------------------------------------------

export interface Narration {
  id: string;
  situation: string;
  friction: string;
  compromise: string;
  discussionQuestion: string;
}

const MAX_NARRATION_FIELD = 400;
const ALLOWED_CAPITALIZED = new Set(["RentWell", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January"]);
const FORBIDDEN_CLAIMS = /\b(diagnos|disorder|therap|dangerous|danger|unsafe|trustworth|untrustworth|violent|will (definitely|certainly|always|never|fight|break)|is going to (fight|argue)|personality|narcissis|toxic|crazy|lazy|selfish|controlling)\w*/i;

/** Minimal shape used to build the compact payload sent to the model (no names, no ids of people). */
export function narrationInput(scenarios: Scenario[]): Array<{ id: string; category: string; situation: string; friction: string; compromise: string; question: string; preferences: string[] }> {
  return scenarios.map((s) => ({
    id: s.id,
    category: s.category,
    situation: s.situation,
    friction: s.friction,
    compromise: s.compromise,
    question: s.discussionQuestion,
    preferences: s.relevantPreferences.map((p) => `${p.who}: ${label(p.key, p.value)}`),
  }));
}

function allowedNumbers(scenario: Scenario): Set<string> {
  const text = [scenario.situation, scenario.friction, scenario.compromise, scenario.discussionQuestion, ...scenario.relevantPreferences.map((p) => p.value), ...scenario.whatIf.map((w) => `${w.label} ${w.outcome}`)].join(" ");
  return new Set(text.match(/\d+(?::\d+)?/g) ?? []);
}

/**
 * Accept a model narration for a scenario only if it is well-formed, contains no protected-category terms,
 * no judgments about character/risk, no names, and introduces no numbers/times beyond the deterministic text.
 * Returns null to signal "use the deterministic text".
 */
export function validateNarration(raw: unknown, scenario: Scenario): Narration | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.id !== scenario.id) return null;
  const fields = ["situation", "friction", "compromise", "discussionQuestion"] as const;
  const text: Partial<Record<(typeof fields)[number], string>> = {};
  for (const f of fields) {
    const v = r[f];
    if (typeof v !== "string" || v.trim().length === 0 || v.length > MAX_NARRATION_FIELD) return null;
    text[f] = v.trim();
  }
  const joined = fields.map((f) => text[f]).join(" ");
  if (mentionsProtectedTerm(joined) || screenProtectedLanguage(joined).flagged) return null;
  if (FORBIDDEN_CLAIMS.test(joined)) return null;
  // No proper names: any capitalized word that is not sentence-initial is rejected (except "RentWell").
  const words = joined.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^A-Za-z]/g, "");
    if (w.length > 1 && /^[A-Z][a-z]+$/.test(w) && !ALLOWED_CAPITALIZED.has(w) && !/[.!?]$/.test(words[i - 1])) return null;
  }
  const allowed = allowedNumbers(scenario);
  for (const n of joined.match(/\d+(?::\d+)?/g) ?? []) if (!allowed.has(n)) return null;
  return text as Narration;
}

/** Apply per-scenario validated narrations; any invalid one leaves that scenario deterministic. */
export function applyNarrations(scenarios: Scenario[], raw: unknown): Scenario[] {
  const items = Array.isArray(raw) ? raw : [];
  return scenarios.map((s) => {
    const match = items.find((i) => typeof i === "object" && i !== null && (i as { id?: unknown }).id === s.id);
    const n = match ? validateNarration(match, s) : null;
    return n ? { ...s, situation: n.situation, friction: n.friction, compromise: n.compromise, discussionQuestion: n.discussionQuestion, narrated: true } : s;
  });
}

// ---------------------------------------------------------------------------
// Day-in-the-life timeline for the schedule scenario
// ---------------------------------------------------------------------------

const SLEEP_BLOCKS: Record<string, { wake: string; windDown: string }> = {
  early: { wake: "6:00 AM", windDown: "9:30 PM" },
  standard: { wake: "7:30 AM", windDown: "10:30 PM" },
  late: { wake: "9:30 AM", windDown: "12:30 AM" },
};

export interface TimelineRow {
  label: string;
  you: string;
  match: string;
}

/** Illustrative blocks derived only from confirmed "sleep" values. Never presented as a forecast. */
export function dayTimeline(me: RoommateProfile, other: RoommateProfile | null, consent: SharingConsent = { fromMatch: [] }): TimelineRow[] | null {
  const mine = confirmed(me, "sleep");
  if (!mine) return null;
  const theirs = other && consent.fromMatch.includes("sleep") ? confirmed(other, "sleep") : undefined;
  const a = SLEEP_BLOCKS[String(mine.value)];
  const b = theirs ? SLEEP_BLOCKS[String(theirs.value)] : null;
  return [
    { label: "Typical wake-up", you: a.wake, match: b ? b.wake : "not shared" },
    { label: "Typical wind-down", you: a.windDown, match: b ? b.windDown : "not shared" },
  ];
}
