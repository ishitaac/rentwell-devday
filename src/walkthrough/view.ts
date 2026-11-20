import type { ShotAnalysis, UnitType } from "./lib/types";

/** Everything the results screen needs, whether it came from a live run, the Sample, or a saved record. */
export interface ResultsView {
  source: "live" | "sample" | "record";
  unitType: UnitType;
  analyses: ShotAnalysis[];
  photoUrls: Record<string, string>;
  takenAt: Record<string, { at: string | null; source: "device_exif" | "file_date" | "none" }>;
  notes: Record<string, string>;
  rental: { name: string | null; rent: number | null } | null;
  recordCreatedAt?: string;
  isIllustrated?: boolean;
}

export interface RentalContext {
  name: string;
  rent: number | null;
}
