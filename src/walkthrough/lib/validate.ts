import { allowedCategories, findShot } from "./shots.js";
import {
  CATEGORIES,
  CONFIDENCES,
  FINDINGS,
  SEVERITIES,
  ZONES,
  type Category,
  type Confidence,
  type Finding,
  type Observation,
  type PhotoResult,
  type Severity,
  type UnitType,
  type Zone,
} from "./types.js";

/**
 * validate.ts: the model observes, code decides. Every severity shown to a renter passes
 * through here. Anything malformed is discarded and the shot counts as Not checked.
 */

export const MAX_DESCRIPTION_CHARS = 140;
export const MAX_HEADLINE_CHARS = 40;
const MAX_HINT_CHARS = 80;
const MAX_CANNOT_JUDGE_CHARS = 200;
const MAX_REASON_CHARS = 120;
const MAX_OBSERVATIONS = 6;
export const CLOSER_PHOTO_NOTE = "Low confidence: needs a closer photo.";

/** Verdict words and hazard names the product never says about a property. */
const BANNED_PATTERNS: RegExp[] = [
  /\b(un)?safe(ty)?\s+(to|for)\b/i,
  /\b(un)?safe\b/i,
  /\bpass(es|ed)?\b/i,
  /\bfail(s|ed|ing)?\b/i,
  /\b(good|bad|poor|great|excellent|fine)\s+condition\b/i,
  /\bapproved\b/i,
  /\bcertified\b/i,
  /\binspection\s+(complete|passed)\b/i,
  /\bmou?ld\b/i,
  /\basbestos\b/i,
];

export type ValidationOutcome =
  | { ok: true; result: PhotoResult }
  | { ok: false; code: "invalid" | "banned_word"; detail: string };

export function findBannedWord(text: string): string | null {
  for (const pattern of BANNED_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Fallback headline: the first few words of the description. */
function shortHeadline(description: string): string {
  return description
    .split(/[,.;(]/)[0]
    .split(" ")
    .slice(0, 5)
    .join(" ");
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

interface RawObservation {
  category?: unknown;
  finding?: unknown;
  severity?: unknown;
  description?: unknown;
  locationHint?: unknown;
  confidence?: unknown;
  cannotJudge?: unknown;
  headline?: unknown;
  zone?: unknown;
}

type ObservationOutcome = { ok: true; value: Observation | null } | { ok: false; detail: string };

function validateObservation(raw: RawObservation, allowed: Category[]): ObservationOutcome {
  if (!isOneOf(CATEGORIES, raw.category)) return { ok: false, detail: "invalid category" };
  if (!isOneOf(FINDINGS, raw.finding)) return { ok: false, detail: "invalid finding" };
  if (!isOneOf(CONFIDENCES, raw.confidence)) return { ok: false, detail: "invalid confidence" };
  if (raw.severity != null && !isOneOf(SEVERITIES, raw.severity)) {
    return { ok: false, detail: "invalid severity" };
  }
  const description = asText(raw.description);
  if (!description || !description.trim()) return { ok: false, detail: "missing description" };

  // Off-topic categories are dropped, not fatal.
  if (!allowed.includes(raw.category)) return { ok: true, value: null };

  return {
    ok: true,
    value: applyCaps(raw.category, raw.finding, raw.severity ?? null, raw.confidence, {
      description,
      locationHint: asText(raw.locationHint) ?? "",
      cannotJudge: asText(raw.cannotJudge) ?? "",
      headline: asText(raw.headline) ?? "",
      zone: isOneOf(ZONES, raw.zone) ? raw.zone : null,
    }),
  };
}

function applyCaps(
  category: Category,
  finding: Finding,
  rawSeverity: Severity | null,
  confidence: Confidence,
  text: {
    description: string;
    locationHint: string;
    cannotJudge: string;
    headline: string;
    zone: Zone | null;
  },
): Observation {
  const description = clip(text.description, MAX_DESCRIPTION_CHARS);
  const base = {
    category,
    finding,
    confidence,
    headline: clip(text.headline || shortHeadline(description), MAX_HEADLINE_CHARS),
    description,
    locationHint: clip(text.locationHint, MAX_HINT_CHARS),
    cannotJudge: clip(
      text.cannotJudge || "What is outside the frame or hidden behind surfaces.",
      MAX_CANNOT_JUDGE_CHARS,
    ),
  };
  if (finding === "no_concern_visible") return { ...base, severity: null, zone: null };

  // A concern without a severity is treated as the mildest one.
  const severity = rawSeverity ?? "follow_up";
  if (confidence === "low") {
    // Low confidence: no zone either, so we never point confidently at a guess.
    return { ...base, severity: "follow_up", zone: null, capNote: CLOSER_PHOTO_NOTE };
  }
  return { ...base, severity, zone: text.zone };
}

/** Validate untrusted model output (or an imported record) for one shot. */
export function validatePhotoResult(
  raw: unknown,
  unitType: UnitType,
  shotId: string,
): ValidationOutcome {
  const shot = findShot(unitType, shotId);
  if (!shot) return { ok: false, code: "invalid", detail: "unknown shot" };
  if (!raw || typeof raw !== "object")
    return { ok: false, code: "invalid", detail: "not an object" };
  const data = raw as Record<string, unknown>;
  if (typeof data.assessable !== "boolean")
    return { ok: false, code: "invalid", detail: "missing assessable" };
  if (!isOneOf(["good", "poor"] as const, data.imageQuality)) {
    return { ok: false, code: "invalid", detail: "invalid imageQuality" };
  }
  if (!Array.isArray(data.observations))
    return { ok: false, code: "invalid", detail: "missing observations" };

  const banned = findBannedWord(collectText(data));
  if (banned) return { ok: false, code: "banned_word", detail: `banned word: ${banned}` };

  if (!data.assessable) {
    const reason =
      asText(data.notAssessableReason) || "the photo does not clearly show the requested area";
    return {
      ok: true,
      result: {
        shotId,
        assessable: false,
        notAssessableReason: clip(reason, MAX_REASON_CHARS),
        imageQuality: data.imageQuality,
        observations: [],
      },
    };
  }

  const observations: Observation[] = [];
  for (const item of data.observations.slice(0, MAX_OBSERVATIONS)) {
    if (!item || typeof item !== "object")
      return { ok: false, code: "invalid", detail: "bad observation" };
    const outcome = validateObservation(item as RawObservation, allowedCategories(shot));
    if (!outcome.ok) return { ok: false, code: "invalid", detail: outcome.detail };
    if (outcome.value) observations.push(outcome.value);
  }
  return {
    ok: true,
    result: {
      shotId,
      assessable: true,
      notAssessableReason: null,
      imageQuality: data.imageQuality,
      observations,
    },
  };
}

function collectText(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof data.notAssessableReason === "string") parts.push(data.notAssessableReason);
  for (const item of data.observations as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const obs = item as RawObservation;
    for (const value of [obs.headline, obs.description, obs.locationHint, obs.cannotJudge]) {
      if (typeof value === "string") parts.push(value);
    }
  }
  return parts.join(" \n ");
}
