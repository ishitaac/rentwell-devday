import type { QuickAnswer } from "./lib/session";
import type { ShotAnalysis, UnitType } from "./lib/types";

/** Everything the results screen needs, whether it came from a live run, the Sample, or a saved record. */
export interface ResultsView {
  source: "live" | "sample" | "record";
  unitType: UnitType;
  analyses: ShotAnalysis[];
  /** Shots still being read in the background. */
  pending: string[];
  photoUrls: Record<string, string>;
  takenAt: Record<string, { at: string | null; source: "device_exif" | "file_date" | "none" }>;
  notes: Record<string, string>;
  quickChecks: Record<string, QuickAnswer>;
  skipped: Record<string, string>;
  prompts: Record<string, string>;
  rental: { name: string | null; rent: number | null } | null;
  recordCreatedAt?: string;
  isIllustrated?: boolean;
}

export interface RentalContext {
  name: string;
  rent: number | null;
}
