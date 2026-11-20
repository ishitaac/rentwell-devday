import {
  FIELD_DEFS,
  FIELD_KEYS,
  type FieldKey,
  type FieldValue,
  type ProfileField,
  type RoommateProfile,
  confirmed,
} from "./types";

/**
 * Transparent, deterministic roommate compatibility.
 * - Reads ONLY confirmed fields from the field registry (no protected inputs can reach it).
 * - Missing information is "unknown", never "incompatible".
 * - A required need that conflicts is a hard result; a high overall score cannot override it.
 * - The score describes overlap in stated habits. It is not a prediction of how people will get along.
 */

export const MATCH_DISCLAIMER =
  "Based only on preferences you and your match confirmed. This describes overlap in stated habits; it does not predict how well you'll get along.";

export interface MatchWeights {
  housing: number;
  schedule: number;
  "shared-space": number;
  social: number;
}

export const DEFAULT_WEIGHTS: MatchWeights = { housing: 0.3, schedule: 0.25, "shared-space": 0.25, social: 0.2 };

export interface MatchContext {
  /** Per-person monthly cost of a specific home, if one is selected. */
  perPersonRent?: number;
  weights?: MatchWeights;
}

export type MatchCategory = "strong-overlap" | "good-overlap" | "some-differences" | "significant-differences" | "not-enough-info" | "requirement-conflict";

export const CATEGORY_LABEL: Record<MatchCategory, string> = {
  "strong-overlap": "Strong overlap",
  "good-overlap": "Good overlap",
  "some-differences": "Some differences to discuss",
  "significant-differences": "Significant differences",
  "not-enough-info": "Not enough information yet",
  "requirement-conflict": "A required need doesn't line up",
};

export interface KeyAssessment {
  key: FieldKey;
  /** 0..1 raw agreement of the two stated values. */
  raw: number;
  /** 0..1 after mutual-tolerance adjustment. */
  effective: number;
  a: FieldValue;
  b: FieldValue;
}

export interface MatchResult {
  candidateId: string;
  hardConflicts: Array<{ key: FieldKey; reason: string }>;
  category: MatchCategory;
  /** null when there is a hard conflict or too little shared information. */
  score: number | null;
  breakdown: Array<{ group: keyof MatchWeights; score: number | null; knownKeys: number; totalKeys: number }>;
  assessments: KeyAssessment[];
  strengths: string[];
  friction: string[];
  unknowns: string[];
  /** Fraction of registry keys known on both sides (uncertainty indicator). */
  coverage: number;
  disclaimer: string;
}

// -- distance helpers --------------------------------------------------------

function ordinalIndex(key: FieldKey, v: FieldValue): number {
  const def = FIELD_DEFS[key];
  if (def.kind === "ordinal") return (def.values as readonly string[]).indexOf(String(v));
  return Number(v);
}

function ordinalAgreement(key: FieldKey, a: FieldValue, b: FieldValue): number {
  const def = FIELD_DEFS[key];
  if (def.kind === "ordinal") {
    const span = def.values.length - 1;
    return 1 - Math.abs(ordinalIndex(key, a) - ordinalIndex(key, b)) / span;
  }
  if (def.kind === "scale") return 1 - Math.abs(Number(a) - Number(b)) / (def.max - def.min);
  if (def.kind === "number") return 1 - Math.abs(Number(a) - Number(b)) / (def.max - def.min);
  return a === b ? 1 : 0;
}

function categoricalAgreement(key: FieldKey, a: FieldValue, b: FieldValue): number {
  if (a === b) return 1;
  switch (key) {
    case "cookwareSharing": {
      // Separate cookware + separate/flexible is workable (vegetarian & meat-eater households do this).
      // "separate" vs "shared" is a genuine kitchen-rule disagreement.
      const set = [a, b].sort().join("|");
      if (set === "flexible|separate" || set === "flexible|shared") return 0.8;
      return 0.2;
    }
    case "smokingInShared": {
      const set = [a, b].sort().join("|");
      if (set === "no|outside-only") return 0.6;
      if (set === "ok|outside-only") return 0.5;
      return 0; // no vs ok
    }
    case "expenseSplit":
      return a === "flexible" || b === "flexible" ? 0.8 : 0.4;
    case "conflictStyle":
      return 0.5;
    case "furnished":
    case "parking":
      return a === "either" || b === "either" ? 1 : 0;
    default:
      return 0;
  }
}

export function agreement(key: FieldKey, a: FieldValue, b: FieldValue): number {
  const def = FIELD_DEFS[key];
  return def.kind === "categorical" ? categoricalAgreement(key, a, b) : ordinalAgreement(key, a, b);
}

function possessive(name: string): string {
  return name === "You" ? "Your" : `${name}'s`;
}

function subjectRequires(name: string): string {
  return name === "You" ? "You require" : `${name} requires`;
}

function describe(key: FieldKey, value: FieldValue): string {
  const label = FIELD_DEFS[key].label.toLowerCase();
  return `${label}: ${String(value)}`;
}

function monthsApart(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return Math.abs((ay - by) * 12 + (am - bm));
}

// -- Stage 1: hard (lawful, confirmed, required) requirements -----------------

function isRequired(f?: ProfileField): boolean {
  return f?.priority === "required";
}

function hardConflicts(a: RoommateProfile, b: RoommateProfile, ctx: MatchContext): Array<{ key: FieldKey; reason: string }> {
  const out: Array<{ key: FieldKey; reason: string }> = [];

  // Budget against a specific home: required budgets are hard; otherwise friction handled later.
  if (ctx.perPersonRent !== undefined) {
    for (const who of [a, b]) {
      const f = confirmed(who, "budgetMax");
      if (f && Number(f.value) < ctx.perPersonRent && isRequired(f)) {
        out.push({ key: "budgetMax", reason: `${possessive(who.displayName)} confirmed budget is below this home's per-person cost.` });
      }
    }
  }

  // Bedroom / bathroom: if exactly one side hosts, the host's home defines what is on offer.
  for (const key of ["bedroom", "bathroom"] as const) {
    const fa = confirmed(a, key);
    const fb = confirmed(b, key);
    if (!fa || !fb) continue;
    const host = a.hasHousing && !b.hasHousing ? a : b.hasHousing && !a.hasHousing ? b : null;
    if (host) {
      const seeker = host === a ? b : a;
      const need = confirmed(seeker, key);
      const offer = confirmed(host, key);
      if (need && offer && isRequired(need) && need.value !== offer.value && need.value === "private") {
        out.push({ key, reason: `${subjectRequires(seeker.displayName)} a ${need.value} ${key}; the available home offers a ${offer.value} one.` });
      }
    } else if (isRequired(fa) && isRequired(fb) && fa.value !== fb.value) {
      out.push({ key, reason: `Both marked ${key} as required, with different needs.` });
    }
  }

  const simpleKeys: FieldKey[] = ["moveInMonth", "roommateCount", "furnished", "parking", "leaseMonths"];
  for (const key of simpleKeys) {
    const fa = confirmed(a, key);
    const fb = confirmed(b, key);
    if (!fa || !fb) continue;
    if (!isRequired(fa) && !isRequired(fb)) continue;
    if (key === "moveInMonth") {
      if (monthsApart(String(fa.value), String(fb.value)) > 1) out.push({ key, reason: "Required move-in timing differs by more than a month." });
    } else if (key === "furnished" || key === "parking") {
      if (categoricalAgreement(key, fa.value, fb.value) === 0) out.push({ key, reason: `Required ${key} preferences conflict.` });
    } else if (fa.value !== fb.value) {
      out.push({ key, reason: `Required ${FIELD_DEFS[key].label.toLowerCase()} differs.` });
    }
  }

  // Any confirmed lifestyle "required" need that the other person's confirmed answer clearly conflicts with.
  for (const key of FIELD_KEYS) {
    const def = FIELD_DEFS[key];
    if (def.group === "housing") continue;
    const fa = confirmed(a, key);
    const fb = confirmed(b, key);
    if (!fa || !fb) continue;
    if (!isRequired(fa) && !isRequired(fb)) continue;
    if (agreement(key, fa.value, fb.value) < 0.35) {
      out.push({ key, reason: `A required need about ${def.label.toLowerCase()} conflicts with the other person's confirmed answer.` });
    }
  }
  return out;
}

// -- Stage 2/3: lifestyle agreement and mutual tolerance --------------------

function tolerance(fa: ProfileField, fb: ProfileField): number {
  const flexA = fa.priority === "flexible";
  const flexB = fb.priority === "flexible";
  if (flexA && flexB) return 0.75;
  if (flexA || flexB) return 0.5;
  return 0;
}

export function matchProfiles(me: RoommateProfile, other: RoommateProfile, ctx: MatchContext = {}): MatchResult {
  const weights = ctx.weights ?? DEFAULT_WEIGHTS;
  const assessments: KeyAssessment[] = [];
  const unknowns: string[] = [];
  let bothKnown = 0;

  for (const key of FIELD_KEYS) {
    const fa = confirmed(me, key);
    const fb = confirmed(other, key);
    if (fa && fb) {
      bothKnown += 1;
      const raw = key === "moveInMonth" ? Math.max(0, 1 - monthsApart(String(fa.value), String(fb.value)) / 6) : key === "budgetMax" ? budgetAgreement(Number(fa.value), Number(fb.value), ctx) : agreement(key, fa.value, fb.value);
      const effective = raw + (1 - raw) * tolerance(fa, fb);
      assessments.push({ key, raw, effective, a: fa.value, b: fb.value });
    } else if (fa || fb) {
      unknowns.push(`${FIELD_DEFS[key].label}: only one of you has shared this — worth asking.`);
    }
  }

  const groups = ["housing", "schedule", "shared-space", "social"] as const;
  const breakdown = groups.map((group) => {
    const keys = FIELD_KEYS.filter((k) => FIELD_DEFS[k].group === group);
    const known = assessments.filter((x) => FIELD_DEFS[x.key].group === group);
    const score = known.length ? known.reduce((s, x) => s + x.effective, 0) / known.length : null;
    return { group, score, knownKeys: known.length, totalKeys: keys.length };
  });

  const usable = breakdown.filter((g) => g.score !== null);
  const weightSum = usable.reduce((s, g) => s + weights[g.group], 0);
  const weighted = weightSum > 0 ? usable.reduce((s, g) => s + (g.score as number) * weights[g.group], 0) / weightSum : null;
  const rawScore = weighted === null ? null : Math.max(0, Math.min(100, Math.round(weighted * 100)));

  const conflicts = hardConflicts(me, other, ctx);
  const strengths = assessments.filter((x) => x.effective >= 0.8).map((x) => `You're aligned on ${describe(x.key, x.a)}${x.a === x.b ? "" : ` and ${String(x.b)}`}.`);
  const friction = assessments
    .filter((x) => x.effective < 0.5)
    .map((x) => `${FIELD_DEFS[x.key].label}: you said ${String(x.a)}, they said ${String(x.b)}.`);

  const coverage = bothKnown / FIELD_KEYS.length;
  let category: MatchCategory;
  let score: number | null = rawScore;
  if (conflicts.length > 0) {
    category = "requirement-conflict";
    score = null;
  } else if (rawScore === null || bothKnown < 3) {
    category = "not-enough-info";
    score = null;
  } else if (rawScore >= 80) category = "strong-overlap";
  else if (rawScore >= 60) category = "good-overlap";
  else if (rawScore >= 40) category = "some-differences";
  else category = "significant-differences";

  return {
    candidateId: other.profileId,
    hardConflicts: conflicts,
    category,
    score,
    breakdown,
    assessments,
    strengths,
    friction,
    unknowns,
    coverage,
    disclaimer: MATCH_DISCLAIMER,
  };
}

function budgetAgreement(a: number, b: number, ctx: MatchContext): number {
  if (ctx.perPersonRent !== undefined) {
    const lowest = Math.min(a, b);
    return lowest >= ctx.perPersonRent ? 1 : Math.max(0, 1 - (ctx.perPersonRent - lowest) / ctx.perPersonRent);
  }
  return 1 - Math.min(1, Math.abs(a - b) / Math.max(a, b));
}

/** Stable ranking: requirement conflicts last, then score desc, then candidate id. */
export function rankCandidates(me: RoommateProfile, candidates: RoommateProfile[], ctx: MatchContext = {}): MatchResult[] {
  const rank = (r: MatchResult) => (r.category === "requirement-conflict" ? 2 : r.score === null ? 1 : 0);
  return candidates
    .map((c) => matchProfiles(me, c, ctx))
    .sort((x, y) => rank(x) - rank(y) || (y.score ?? -1) - (x.score ?? -1) || x.candidateId.localeCompare(y.candidateId));
}
