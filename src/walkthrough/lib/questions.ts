import { CATEGORY_LABELS, findShot, UNIT_TYPES } from "./shots.js";
import type { WalkthroughSummary } from "./summarize.js";
import type { Category, UnitType } from "./types.js";

/** questions.ts: deterministic landlord question templates. No model involved. */

export interface LandlordQuestion {
  id: string;
  text: string;
  /** Shot the question came from, so the UI can link back to the photo. */
  sourceShotId: string | null;
  kind: "finding" | "gap" | "condition_report";
}

const TEMPLATES: Record<Category, (where: string, category: string) => string> = {
  water_moisture: (where) =>
    `Can you confirm in writing the cause and repair timeline for the staining near ${where}?`,
  walls_ceilings: (where) =>
    `Will the ${where.replace(/^the\s+/i, "")} be repaired or repainted before move-in, and can you confirm that in writing?`,
  flooring: (where) =>
    `Can you document the flooring condition near ${where} so it isn't deducted from my deposit?`,
  windows_doors: (where) =>
    `Can the window or door near ${where} be inspected for sealing and operation before I sign?`,
  kitchen_fixtures: (where, category) =>
    `Can you confirm repair or replacement of the ${category} issue near ${where}?`,
  bathroom_fixtures: (where, category) =>
    `Can you confirm repair or replacement of the ${category} issue near ${where}?`,
  appliances: (where, category) =>
    `Can you confirm repair or replacement of the ${category} issue near ${where}?`,
  visible_safety: (where) =>
    `Can you have the area near ${where} checked and confirm in writing what was found?`,
  cleanliness_pests: () =>
    "Can you share the pest-control history and the unit's pre-move-in cleaning plan?",
  exterior: (where) =>
    `Who is responsible for repairing the exterior issue near ${where}, and when will it be done?`,
  yard_grounds: () =>
    "Who maintains the yard and drainage, and is that written in the lease or HOA rules?",
  mechanical_visible: (where) =>
    `Can you share the age and last service date of the water heater and furnace, and confirm the repair of the issue near ${where}?`,
  common_areas: (where) =>
    `Who is responsible for the shared-area issue near ${where}, and what is the repair timeline?`,
};

export const CONDITION_REPORT_QUESTION =
  "Can we add a move-in condition report that lists these items, signed by both of us?";

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
    const where = cleanLocation(
      concern.locationHint,
      shot?.askLabel.replace(/^the /, "") ?? "this area",
    );
    const text = TEMPLATES[concern.category](where, CATEGORY_LABELS[concern.category]);
    add({ id: `finding-${index}`, text, sourceShotId: concern.shotId, kind: "finding" });
  });

  summary.gaps
    .filter((gap) => gap.required)
    .forEach((gap) => {
      const shot = findShot(summary.unitType, gap.shotId);
      add({
        id: `gap-${gap.shotId}`,
        text: `Can I see ${shot?.askLabel ?? gap.label.toLowerCase()} before I sign?`,
        sourceShotId: gap.shotId,
        kind: "gap",
      });
    });

  if (summary.concernCount > 0) {
    add({
      id: "condition-report",
      text: CONDITION_REPORT_QUESTION,
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
