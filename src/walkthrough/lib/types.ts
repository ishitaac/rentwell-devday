/** Walkthrough domain types. Shared by the browser and the /api/analyze-photo function. */

export const UNIT_TYPE_IDS = ["apartment", "townhome", "single_family"] as const;
export type UnitType = (typeof UNIT_TYPE_IDS)[number];

export const CATEGORIES = [
  "water_moisture",
  "walls_ceilings",
  "flooring",
  "windows_doors",
  "kitchen_fixtures",
  "bathroom_fixtures",
  "appliances",
  "visible_safety",
  "cleanliness_pests",
  "exterior",
  "yard_grounds",
  "mechanical_visible",
  "common_areas",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FINDINGS = ["concern_visible", "no_concern_visible"] as const;
export type Finding = (typeof FINDINGS)[number];

export const SEVERITIES = ["follow_up", "priority", "stop_and_verify"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

/** Nine zones of the photo. A coarse region is far easier to get right than a precise box. */
export const ZONES = [
  "top_left",
  "top_center",
  "top_right",
  "middle_left",
  "center",
  "middle_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
] as const;
export type Zone = (typeof ZONES)[number];

export interface Observation {
  category: Category;
  finding: Finding;
  severity: Severity | null;
  /** 2 to 5 words for the results grid, e.g. "Ceiling stain". */
  headline: string;
  description: string;
  locationHint: string;
  confidence: Confidence;
  cannotJudge: string;
  /** Shaded on the photo. Code keeps it only for concerns with medium or high confidence. */
  zone: Zone | null;
  /** Set by code when a cap changed what the model said (for example low confidence). */
  capNote?: string;
}

/** A photo result after validate.ts. Never trust a PhotoResult that did not pass through it. */
export interface PhotoResult {
  shotId: string;
  assessable: boolean;
  notAssessableReason: string | null;
  imageQuality: "good" | "poor";
  observations: Observation[];
}

export interface PhotoRequest {
  unitType: UnitType;
  shotId: string;
  imageBase64: string;
  /** "Anything else?" shots only: what the renter wants a second opinion on. */
  renterPrompt?: string;
}

/** What the browser knows about one analyzed shot. */
export type ShotAnalysis =
  | { shotId: string; state: "ok"; result: PhotoResult }
  | { shotId: string; state: "failed"; reason: string };
