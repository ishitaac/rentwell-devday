import { allShots, UNIT_TYPES, type Shot } from "./shots.js";
import type { Observation, ShotAnalysis, UnitType } from "./types.js";

/** summarize.ts: counts and a status label. Never a score, a percentage, or a verdict. */

export type StatusLabel =
  | "Pause and verify"
  | "Follow-up needed"
  | "Incomplete evidence"
  | "Walkthrough recorded"
  | "No walkthrough evidence recorded";

export type GapKind = "not_taken" | "not_assessable" | "failed";

export interface Gap {
  shotId: string;
  label: string;
  required: boolean;
  kind: GapKind;
  reason: string;
}

export interface FlaggedObservation extends Observation {
  shotId: string;
  shotLabel: string;
}

export interface WalkthroughSummary {
  unitType: UnitType;
  statusLabel: StatusLabel;
  concernCount: number;
  followUpCount: number;
  priorityCount: number;
  stopAndVerifyCount: number;
  notCheckedCount: number;
  checkedCount: number;
  requiredCount: number;
  /** "5 of 6 shots checked" describes effort, not quality. */
  coverageText: string;
  /** Only true when every required shot was assessable and nothing was flagged. */
  showNoConcernsLine: boolean;
  concerns: FlaggedObservation[];
  gaps: Gap[];
}

const SEVERITY_ORDER = { stop_and_verify: 0, priority: 1, follow_up: 2 } as const;

export const NO_CONCERNS_LINE = "No concerns visible in the photos you took.";

function gapFor(shot: Shot, required: boolean, analysis: ShotAnalysis | undefined): Gap | null {
  const base = { shotId: shot.id, label: shot.label, required };
  if (!analysis) return required ? { ...base, kind: "not_taken", reason: "Not taken" } : null;
  if (analysis.state === "failed") return { ...base, kind: "failed", reason: "Could not analyze" };
  if (!analysis.result.assessable) {
    return {
      ...base,
      kind: "not_assessable",
      reason: `Cannot assess: ${analysis.result.notAssessableReason ?? "unclear photo"}`,
    };
  }
  return null;
}

export function summarize(unitType: UnitType, analyses: ShotAnalysis[]): WalkthroughSummary {
  const config = UNIT_TYPES[unitType];
  const byShot = new Map(analyses.map((entry) => [entry.shotId, entry]));
  const requiredIds = new Set(config.required.map((shot) => shot.id));

  const gaps: Gap[] = [];
  const concerns: FlaggedObservation[] = [];
  let checkedCount = 0;
  let anyAssessable = false;

  for (const shot of allShots(unitType)) {
    const required = requiredIds.has(shot.id);
    const analysis = byShot.get(shot.id);
    const gap = gapFor(shot, required, analysis);
    if (gap) {
      gaps.push(gap);
      continue;
    }
    if (!analysis || analysis.state !== "ok") continue;
    anyAssessable = true;
    if (required) checkedCount += 1;
    for (const observation of analysis.result.observations) {
      if (observation.finding === "concern_visible") {
        concerns.push({ ...observation, shotId: shot.id, shotLabel: shot.label });
      }
    }
  }

  const sortedConcerns = [...concerns].sort(
    (a, b) => SEVERITY_ORDER[a.severity ?? "follow_up"] - SEVERITY_ORDER[b.severity ?? "follow_up"],
  );
  const countOf = (severity: keyof typeof SEVERITY_ORDER) =>
    concerns.filter((item) => item.severity === severity).length;
  const stopAndVerifyCount = countOf("stop_and_verify");
  const priorityCount = countOf("priority");
  const followUpCount = countOf("follow_up");
  const notCheckedCount = gaps.length;
  const requiredCount = config.required.length;

  const statusLabel: StatusLabel = !anyAssessable
    ? "No walkthrough evidence recorded"
    : stopAndVerifyCount > 0
      ? "Pause and verify"
      : priorityCount > 0
        ? "Follow-up needed"
        : notCheckedCount > 0
          ? "Incomplete evidence"
          : "Walkthrough recorded";

  return {
    unitType,
    statusLabel,
    concernCount: concerns.length,
    followUpCount,
    priorityCount,
    stopAndVerifyCount,
    notCheckedCount,
    checkedCount,
    requiredCount,
    coverageText: `${checkedCount} of ${requiredCount} shots checked`,
    showNoConcernsLine: checkedCount === requiredCount && concerns.length === 0,
    concerns: sortedConcerns,
    gaps,
  };
}
