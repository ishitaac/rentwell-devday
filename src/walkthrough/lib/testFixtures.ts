import type { Observation, PhotoResult, ShotAnalysis } from "./types.js";

export function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    category: "walls_ceilings",
    finding: "concern_visible",
    severity: "priority",
    headline: "Ceiling stain",
    zone: "top_left",
    description: "Brown staining on the ceiling corner",
    locationHint: "upper left corner near the window",
    confidence: "high",
    cannotJudge: "Whether moisture is still present behind the paint.",
    ...overrides,
  };
}

export function okResult(shotId: string, observations: Observation[] = []): ShotAnalysis {
  const result: PhotoResult = {
    shotId,
    assessable: true,
    notAssessableReason: null,
    imageQuality: "good",
    observations,
  };
  return { shotId, state: "ok", result };
}

export function unassessable(shotId: string, reason = "photo is too dark"): ShotAnalysis {
  return {
    shotId,
    state: "ok",
    result: {
      shotId,
      assessable: false,
      notAssessableReason: reason,
      imageQuality: "poor",
      observations: [],
    },
  };
}

export function failed(shotId: string): ShotAnalysis {
  return { shotId, state: "failed", reason: "timeout" };
}

export const APARTMENT_IDS = ["A1", "A2", "A3", "A4", "A5", "A6"];
