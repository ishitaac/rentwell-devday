import { sampleArt } from "./art";
import sampleLive from "./data/sample-live.json";
import type { QuickAnswer } from "./lib/session";
import { MISC_SHOTS, tourShots, type ArtKey, type Shot } from "./lib/shots";
import type { ShotAnalysis, UnitType } from "./lib/types";
import { validatePhotoResult } from "./lib/validate";

/**
 * Sample data for the demo: illustrated stand-in photos plus saved example results, keyed by the
 * kind of stop so every home type can be demoed offline. Always labeled "Sample".
 * Every result goes through the validator, exactly like a live one.
 * If `pnpm cache:walkthrough` produced real model output (data/sample-live.json), the apartment
 * Sample uses it instead.
 */

type RawObservation = Record<string, unknown>;

const concern = (
  category: string,
  severity: string,
  headline: string,
  description: string,
  locationHint: string,
  zone: string,
  cannotJudge: string,
  confidence = "medium",
): RawObservation => ({
  category,
  finding: "concern_visible",
  severity,
  headline,
  description,
  locationHint,
  confidence,
  cannotJudge,
  zone,
});

const clear = (
  category: string,
  headline: string,
  description: string,
  cannotJudge: string,
): RawObservation => ({
  category,
  finding: "no_concern_visible",
  severity: null,
  headline,
  description,
  locationHint: "whole photo",
  confidence: "high",
  cannotJudge,
  zone: null,
});

const SAMPLE_OBSERVATIONS: Record<ArtKey, RawObservation[] | "dark"> = {
  sink: [
    concern(
      "water_moisture",
      "follow_up",
      "Rust spot at pipe joint",
      "Small rust-colored spot on the drain pipe joint under the sink",
      "drain pipe joint, lower left",
      "bottom_left",
      "Whether the joint leaks when water runs",
    ),
  ],
  ceiling: [
    concern(
      "walls_ceilings",
      "priority",
      "Ceiling stain",
      "Brown staining on the ceiling corner, about the size of a dinner plate",
      "upper right ceiling corner",
      "top_right",
      "Whether moisture is still present above the ceiling",
      "high",
    ),
  ],
  tub: [
    concern(
      "bathroom_fixtures",
      "follow_up",
      "Worn caulk",
      "Caulk line along the tub edge looks worn and discolored, with small gaps",
      "tub edge along the back wall",
      "bottom_center",
      "Whether water gets behind the tub surround",
    ),
  ],
  window: [
    clear(
      "windows_doors",
      "No visible damage",
      "Glass, frame, and sill show no visible cracks or peeling",
      "Whether it seals against drafts",
    ),
  ],
  floor: [
    concern(
      "flooring",
      "priority",
      "Mark on floorboards",
      "Dark curved mark on the floorboards near the baseboard",
      "floorboards right of center",
      "bottom_center",
      "How deep the mark is",
      "low",
    ),
  ],
  appliances: "dark",
  stairs: [
    clear(
      "visible_safety",
      "Rail and steps visible",
      "Handrail and steps show no visible damage",
      "Whether the rail is firmly attached",
    ),
  ],
  exterior: [
    concern(
      "exterior",
      "priority",
      "Sagging gutter",
      "Gutter along the left roof edge dips below the roofline",
      "gutter at upper left",
      "top_left",
      "Roof condition, which can't be judged from the ground",
    ),
  ],
  yard: [
    concern(
      "yard_grounds",
      "priority",
      "Pooling water by house",
      "Standing water on the lawn next to the foundation wall",
      "lawn by the house, lower left",
      "bottom_left",
      "Where the water drains or how often it pools",
    ),
  ],
  mechanical: [
    concern(
      "mechanical_visible",
      "priority",
      "Rust at heater base",
      "Rust-colored staining on the floor around the water heater base",
      "base of the water heater",
      "bottom_left",
      "Whether the unit works or leaks right now",
    ),
  ],
  hallway: [
    clear(
      "common_areas",
      "Hallway clear",
      "Hallway and exit door look clear with lighting on",
      "Whether the door locks properly",
    ),
  ],
  outlet: [
    clear(
      "visible_safety",
      "No marks visible",
      "Outlet cover is intact with no visible marks",
      "Whether the outlet works",
    ),
  ],
  garage: [
    clear(
      "exterior",
      "No visible damage",
      "Garage door and floor show no visible damage",
      "Whether the door opener works",
    ),
  ],
  anything: [
    concern(
      "visible_safety",
      "follow_up",
      "Discolored outlet cover",
      "Light brown discoloration on the wall plate around the upper outlet",
      "upper outlet",
      "top_right",
      "What caused the discoloration or whether the outlet works",
    ),
  ],
};

/** Saved example result for one shot, already validated. */
export function sampleAnalysis(unitType: UnitType, shot: Shot): ShotAnalysis {
  const observations = SAMPLE_OBSERVATIONS[shot.art];
  const raw =
    observations === "dark"
      ? {
          assessable: false,
          notAssessableReason: "photo is too dark to see the appliances",
          imageQuality: "poor",
          observations: [],
        }
      : { assessable: true, notAssessableReason: null, imageQuality: "good", observations };
  const outcome = validatePhotoResult(raw, unitType, shot.id);
  return outcome.ok
    ? { shotId: shot.id, state: "ok", result: outcome.result }
    : { shotId: shot.id, state: "failed", reason: "Could not analyze" };
}

/** Quick-check answers for the Sample: one "No" so the demo shows a renter flag. */
export function sampleQuickAnswer(shot: Shot): QuickAnswer {
  return shot.art === "window" ? "no" : "yes";
}

export const SAMPLE_MISC_PROMPT = "Is this outlet cover discolored?";

interface LiveSample {
  results: unknown[];
  photos: Record<string, string>;
}

function buildSample() {
  const unitType: UnitType = "apartment";
  const shots = tourShots(unitType);
  const misc = MISC_SHOTS[0];
  const live = sampleLive as LiveSample | null;
  const liveAnalyses = live?.results.flatMap((raw): ShotAnalysis[] => {
    const shotId = (raw as { shotId?: string }).shotId ?? "";
    const outcome = validatePhotoResult(raw, unitType, shotId);
    return outcome.ok ? [{ shotId, state: "ok", result: outcome.result }] : [];
  });
  return {
    unitType,
    rental: { name: "Sample apartment", rent: null },
    analyses: [
      ...(liveAnalyses ?? shots.map((shot) => sampleAnalysis(unitType, shot))),
      sampleAnalysis(unitType, misc),
    ],
    photos: {
      ...(live?.photos ?? Object.fromEntries(shots.map((shot) => [shot.id, sampleArt(shot.art)]))),
      [misc.id]: sampleArt(misc.art),
    } as Record<string, string>,
    notes: {
      A2: "Agent said the stain is from an old leak that was fixed. (Sample note)",
    } as Record<string, string>,
    quickChecks: Object.fromEntries(
      shots.map((shot) => [shot.id, sampleQuickAnswer(shot)]),
    ) as Record<string, QuickAnswer>,
    prompts: { [misc.id]: SAMPLE_MISC_PROMPT } as Record<string, string>,
    isIllustrated: !live,
  };
}

export const SAMPLE = buildSample();
