import { CATEGORY_LABELS, findShot, isMiscShot, UNIT_TYPES } from "./shots.js";
import type { WalkthroughSummary } from "./summarize.js";
import type { Category, UnitType } from "./types.js";

/** questions.ts: deterministic landlord question templates. No model involved. */

export interface LandlordQuestion {
  id: string;
  /** Full wording, used for Copy and Copy as email. */
  text: string;
  /** One scannable line for the results screen. */
  short: string;
  /** Shot the question came from, so the UI can link back to the photo. */
  sourceShotId: string | null;
  kind: "finding" | "quick_check" | "gap" | "condition_report";
}

interface Template {
  full: (where: string, category: string) => string;
  short: (where: string, category: string) => string;
}

const fixture: Template = {
  full: (where, category) =>
    `Can you confirm repair or replacement of the ${category} issue near ${where}?`,
  short: (where) => `Repair the issue at ${where}?`,
};

const TEMPLATES: Record<Category, Template> = {
  water_moisture: {
    full: (where) =>
      `Can you confirm in writing the cause and repair timeline for the staining near ${where}?`,
    short: (where) => `Cause + repair date for staining at ${where}?`,
  },
  walls_ceilings: {
    full: (where) =>
      `Will the ${where.replace(/^the\s+/i, "")} be repaired or repainted before move-in, and can you confirm that in writing?`,
    short: (where) => `Repaint ${where} before move-in? (in writing)`,
  },
  flooring: {
    full: (where) =>
      `Can you document the flooring condition near ${where} so it isn't deducted from my deposit?`,
    short: (where) => `Note floor at ${where} so it's not taken from my deposit?`,
  },
  windows_doors: {
    full: (where) =>
      `Can the window or door near ${where} be inspected for sealing and operation before I sign?`,
    short: (where) => `Check window/door at ${where} before I sign?`,
  },
  kitchen_fixtures: fixture,
  bathroom_fixtures: fixture,
  appliances: fixture,
  visible_safety: {
    full: (where) =>
      `Can you have the area near ${where} checked and confirm in writing what was found?`,
    short: (where) => `Have ${where} checked? (in writing)`,
  },
  cleanliness_pests: {
    full: () => "Can you share the pest-control history and the unit's pre-move-in cleaning plan?",
    short: () => "Pest-control history + cleaning plan?",
  },
  exterior: {
    full: (where) =>
      `Who is responsible for repairing the exterior issue near ${where}, and when will it be done?`,
    short: (where) => `Who fixes the exterior at ${where}, and when?`,
  },
  yard_grounds: {
    full: () =>
      "Who maintains the yard and drainage, and is that written in the lease or HOA rules?",
    short: () => "Who maintains the yard and drainage?",
  },
  mechanical_visible: {
    full: (where) =>
      `Can you share the age and last service date of the water heater and furnace, and confirm the repair of the issue near ${where}?`,
    short: () => "Water heater/furnace age, last service, repair?",
  },
  common_areas: {
    full: (where) =>
      `Who is responsible for the shared-area issue near ${where}, and what is the repair timeline?`,
    short: (where) => `Who fixes the shared area at ${where}, and when?`,
  },
};

export const CONDITION_REPORT_QUESTION =
  "Can we add a move-in condition report that lists these items, signed by both of us?";
const CONDITION_REPORT_SHORT = "Signed move-in condition report listing these?";

/** Turns a model location hint into something that reads well mid-sentence. */
export function cleanLocation(hint: string, fallback: string): string {
  const text = hint.replace(/[.\s]+$/, "").trim();
  if (!text) return fallback;
  const lowered = text.charAt(0).toLowerCase() + text.slice(1);
  return lowered.replace(/^(near|at|on|in)\s+/i, "");
}

export function buildQuestions(summary: WalkthroughSummary): LandlordQuestion[] {
  const questions: LandlordQuestion[] = [];
  const seen = new Set<string>();
  const add = (question: LandlordQuestion) => {
    if (seen.has(question.text)) return;
    seen.add(question.text);
    questions.push(question);
  };

  summary.concerns.forEach((concern, index) => {
    const shot = findShot(summary.unitType, concern.shotId);
    const fallback = isMiscShot(concern.shotId)
      ? "the spot in my photo"
      : (shot?.askLabel.replace(/^the /, "") ?? "this area");
    const where = cleanLocation(concern.locationHint, fallback);
    const template = TEMPLATES[concern.category];
    const category = CATEGORY_LABELS[concern.category];
    add({
      id: `finding-${index}`,
      text: template.full(where, category),
      short: template.short(where, category),
      sourceShotId: concern.shotId,
      kind: "finding",
    });
  });

  for (const flag of summary.renterFlags) {
    add({
      id: `check-${flag.shotId}`,
      text: flag.question,
      short: flag.question,
      sourceShotId: flag.shotId,
      kind: "quick_check",
    });
  }

  summary.gaps
    .filter((gap) => gap.required)
    .forEach((gap) => {
      const shot = findShot(summary.unitType, gap.shotId);
      const what = shot?.askLabel ?? gap.label.toLowerCase();
      add({
        id: `gap-${gap.shotId}`,
        text: `Can I see ${what} before I sign?`,
        short: `See ${shot?.short.toLowerCase() ?? what} before I sign?`,
        sourceShotId: gap.shotId,
        kind: "gap",
      });
    });

  if (summary.concernCount > 0 || summary.renterFlags.length > 0) {
    add({
      id: "condition-report",
      text: CONDITION_REPORT_QUESTION,
      short: CONDITION_REPORT_SHORT,
      sourceShotId: null,
      kind: "condition_report",
    });
  }
  return questions;
}

export function standardQuestions(unitType: UnitType): string[] {
  return UNIT_TYPES[unitType].standardQuestions;
}

export function formatQuestionList(questions: string[]): string {
  return questions.map((text, index) => `${index + 1}. ${text}`).join("\n");
}

export function formatEmail(
  questions: string[],
  context: { rentalName?: string | null; unitTypeLabel: string },
): string {
  const place = context.rentalName ? ` at ${context.rentalName}` : "";
  return [
    `Subject: Questions after touring the ${context.unitTypeLabel.toLowerCase()}${place}`,
    "",
    "Hi,",
    "",
    `Thank you for showing me the ${context.unitTypeLabel.toLowerCase()}${place}. Before I decide, could you help with a few questions?`,
    "",
    formatQuestionList(questions),
    "",
    "Written answers would be great so we both have a record.",
    "",
    "Thank you,",
  ].join("\n");
}
