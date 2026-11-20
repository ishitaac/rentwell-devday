import type { LandlordQuestion } from "./questions.js";
import { findShot, UNIT_TYPES } from "./shots.js";
import type { WalkthroughSummary } from "./summarize.js";
import type { UnitType } from "./types.js";

/**
 * Walkthroughs saved to the renter's demo profile (My Plan). Findings, gaps, and questions only:
 * photos are private and too large for browser storage, so they stay in the renter's ZIP.
 */

export interface SavedWalkthrough {
  id: string;
  savedAt: string;
  unitType: UnitType;
  unitTypeLabel: string;
  rentalName: string | null;
  statusLabel: string;
  coverageText: string;
  counts: {
    stopAndVerify: number;
    priority: number;
    followUp: number;
    notChecked: number;
    youNoticed: number;
  };
  findings: { headline: string; severity: string; where: string }[];
  youNoticed: string[];
  gaps: string[];
  questions: string[];
  mustHaves: { label: string; answer: string }[];
  isSample: boolean;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const MAX_SAVED = 5;
const SEVERITY_LABEL = {
  stop_and_verify: "Stop and verify",
  priority: "Priority",
  follow_up: "Follow up",
} as const;

const keyFor = (email: string) => `rentwell.walkthroughs.${email.trim().toLowerCase()}`;

export function buildSnapshot(input: {
  summary: WalkthroughSummary;
  questions: LandlordQuestion[];
  standard: string[];
  rentalName: string | null;
  mustHaves: { label: string; answer: string }[];
  isSample: boolean;
  now?: Date;
}): SavedWalkthrough {
  const { summary } = input;
  const savedAt = (input.now ?? new Date()).toISOString();
  return {
    id: `wt-${savedAt}`,
    savedAt,
    unitType: summary.unitType,
    unitTypeLabel: UNIT_TYPES[summary.unitType].label,
    rentalName: input.rentalName,
    statusLabel: summary.statusLabel,
    coverageText: summary.coverageText,
    counts: {
      stopAndVerify: summary.stopAndVerifyCount,
      priority: summary.priorityCount,
      followUp: summary.followUpCount,
      notChecked: summary.notCheckedCount,
      youNoticed: summary.renterFlags.length,
    },
    findings: summary.concerns.map((concern) => ({
      headline: concern.headline,
      severity: SEVERITY_LABEL[concern.severity ?? "follow_up"],
      where: findShot(summary.unitType, concern.shotId)?.short ?? concern.shotLabel,
    })),
    youNoticed: summary.renterFlags.map((flag) => flag.label),
    gaps: summary.gaps.map(
      (gap) => `${findShot(summary.unitType, gap.shotId)?.short ?? gap.label}: ${gap.reason}`,
    ),
    questions: [...input.questions.map((q) => q.text), ...input.standard],
    mustHaves: input.mustHaves,
    isSample: input.isSample,
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export function loadSavedWalkthroughs(store: KeyValueStore, email: string): SavedWalkthrough[] {
  try {
    const raw = store.getItem(keyFor(email));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? (parsed as SavedWalkthrough[]).filter((item) => item && typeof item.id === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveWalkthroughToProfile(
  store: KeyValueStore,
  email: string,
  snapshot: SavedWalkthrough,
): SaveResult {
  try {
    const existing = loadSavedWalkthroughs(store, email);
    const next = [snapshot, ...existing.filter((item) => item.id !== snapshot.id)].slice(
      0,
      MAX_SAVED,
    );
    store.setItem(keyFor(email), JSON.stringify(next));
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save to your profile in this browser." };
  }
}
