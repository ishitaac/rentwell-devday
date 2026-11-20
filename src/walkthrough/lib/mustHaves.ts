import type { ArtKey, Shot } from "./shots.js";

/**
 * Must-haves (sample): things the renter cares about in the unit itself. The tour reminds them at
 * the matching stop and they answer. The AI never judges these ("spacious" is the renter's call).
 * Only features of the home, never people or neighbors.
 */

export type MustHaveAnswer = "yes" | "unsure" | "no";

export interface MustHave {
  id: string;
  label: string;
  question: string;
  /** Stops where the reminder fits; if none is on the tour, it shows at "Anything else?". */
  arts: ArtKey[];
}

export const MUST_HAVES: MustHave[] = [
  {
    id: "kitchen",
    label: "Spacious kitchen",
    question: "Does this kitchen feel spacious enough for you?",
    arts: ["sink", "appliances"],
  },
  {
    id: "light",
    label: "Lots of natural light",
    question: "Does this space get the light you want?",
    arts: ["window", "ceiling"],
  },
  {
    id: "bath",
    label: "Updated bathroom",
    question: "Does the bathroom feel updated enough for you?",
    arts: ["tub"],
  },
  {
    id: "outdoor",
    label: "Outdoor space",
    question: "Is there outdoor space that works for you?",
    arts: ["yard", "exterior"],
  },
  {
    id: "storage",
    label: "Enough storage",
    question: "Did you see enough closet and storage space?",
    arts: [],
  },
];

/** Pre-selected for the sample so the demo shows the idea without setup. */
export const SAMPLE_MUST_HAVES = ["kitchen", "light"];

export const ANSWER_LABEL: Record<MustHaveAnswer, string> = {
  yes: "Yes",
  unsure: "Not sure",
  no: "No",
};

/** Which stop shows each selected must-have: the first matching stop, else the last stop. */
export function mustHaveStops(selected: string[], stops: Shot[]): Record<string, MustHave[]> {
  const byStop: Record<string, MustHave[]> = {};
  const last = stops[stops.length - 1]?.id;
  for (const item of MUST_HAVES.filter((m) => selected.includes(m.id))) {
    const stop = stops.find((s) => item.arts.includes(s.art))?.id ?? last;
    if (stop) byStop[stop] = [...(byStop[stop] ?? []), item];
  }
  return byStop;
}

export function mustHaveResults(selected: string[], answers: Record<string, MustHaveAnswer>) {
  return MUST_HAVES.filter((m) => selected.includes(m.id)).map((m) => ({
    id: m.id,
    label: m.label,
    answer: answers[m.id] ? ANSWER_LABEL[answers[m.id]] : "Not checked",
    isNo: answers[m.id] === "no",
  }));
}
