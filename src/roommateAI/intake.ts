import { screenProtectedLanguage, detectPromptInjection } from "./compliance";
import {
  FIELD_DEFS,
  FIELD_KEYS,
  type FieldKey,
  type FieldValue,
  type ProfileField,
  type RoommateProfile,
  isFieldKey,
  makeField,
  normalizeValue,
} from "./types";

/** One extracted preference candidate, whether from the deterministic extractor or from Claude. */
export interface Extraction {
  key: FieldKey;
  value: FieldValue;
  uncertainty: "low" | "medium" | "high";
  /** The user's own words (short) supporting the value. */
  evidence?: string;
  /** The text stated a need, not just a preference. Never auto-applied as "required". */
  suggestedRequired?: boolean;
}

export interface ExtractionResult {
  accepted: Extraction[];
  /** Keys/values dropped because they were unknown, malformed or protected-attribute territory. */
  rejected: string[];
  /** True when free text contained protected-category language that was ignored for matching. */
  sensitiveLanguageIgnored: boolean;
}

const MAX_EVIDENCE = 120;

/** Validate a raw model (or fallback) extraction array against the field registry. */
export function validateExtractions(raw: unknown): ExtractionResult {
  const accepted: Extraction[] = [];
  const rejected: string[] = [];
  const seen = new Set<FieldKey>();
  const items = Array.isArray(raw) ? raw.slice(0, 40) : [];
  if (!Array.isArray(raw)) rejected.push("not-an-array");
  for (const item of items) {
    if (typeof item !== "object" || item === null) {
      rejected.push("malformed-item");
      continue;
    }
    const rec = item as Record<string, unknown>;
    const key = typeof rec.key === "string" ? rec.key : "";
    if (!isFieldKey(key)) {
      rejected.push(`unknown-key:${key.slice(0, 40)}`);
      continue;
    }
    const value = normalizeValue(key, rec.value);
    if (value === null) {
      rejected.push(`bad-value:${key}`);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const evidence = typeof rec.evidence === "string" ? rec.evidence.slice(0, MAX_EVIDENCE) : undefined;
    if (evidence && screenProtectedLanguage(evidence).flagged) {
      rejected.push(`protected-language:${key}`);
      continue;
    }
    const uncertainty = rec.uncertainty === "low" || rec.uncertainty === "high" ? rec.uncertainty : "medium";
    accepted.push({
      key,
      value,
      uncertainty,
      evidence,
      suggestedRequired: rec.suggestedRequired === true,
    });
  }
  return { accepted, rejected, sensitiveLanguageIgnored: false };
}

type Rule = { test: RegExp; out: Array<{ key: FieldKey; value: FieldValue; required?: boolean }> };

/**
 * Deterministic fallback extractor: works with no AI, no network. Covers common household phrasing.
 * It reads practical behaviors only. Diet or identity words (e.g. "vegetarian") produce nothing by themselves;
 * the practical kitchen behavior (e.g. separate utensils) is what gets extracted.
 */
const RULES: Rule[] = [
  { test: /\b(study|studying|work|working|stay up|up)\s+(really\s+)?late\b|\bnight owl\b/i, out: [{ key: "sleep", value: "late" }] },
  { test: /\bearly (riser|bird)\b|\bwake up (really )?early\b|\bearly to bed\b/i, out: [{ key: "sleep", value: "early" }] },
  { test: /\b(own|private) (bed)?room\b|\bneed my own (space|bedroom)\b/i, out: [{ key: "bedroom", value: "private", required: true }] },
  { test: /\b(fine|ok|okay) (with )?sharing (a )?(the )?bathroom\b|\bshare (a |the )?bathroom\b/i, out: [{ key: "bathroom", value: "shared" }] },
  { test: /\b(own|private) bathroom\b/i, out: [{ key: "bathroom", value: "private", required: true }] },
  { test: /\bseparate (cooking )?(utensils|cookware|pots|pans|dishes)\b|\bown (pots|pans|cookware|utensils)\b/i, out: [{ key: "cookwareSharing", value: "separate" }] },
  { test: /\b(share|sharing) (pots|pans|cookware|dishes|utensils)\b/i, out: [{ key: "cookwareSharing", value: "shared" }] },
  { test: /\b(like|love|enjoy)\s+(having\s+)?(friends|people)\s+over\b|\bhost(ing)? (friends|gatherings)\b/i, out: [{ key: "guestFrequency", value: "often" }] },
  { test: /\b(rarely|hardly ever|don't|do not) (have|host) (guests|people|friends)\b|\bprefer(s)? a quiet home\b/i, out: [{ key: "guestFrequency", value: "rarely" }] },
  { test: /\bno overnight guests\b/i, out: [{ key: "overnightGuests", value: "never" }] },
  { test: /\b(cook|cooking) (almost )?(every day|daily|most days)\b/i, out: [{ key: "cookingFrequency", value: "daily" }] },
  { test: /\b(rarely|barely|don't|do not) cook\b/i, out: [{ key: "cookingFrequency", value: "rarely" }] },
  { test: /\bno smoking\b|\bsmoke[- ]free\b|\bno vaping\b/i, out: [{ key: "smokingInShared", value: "no", required: true }] },
  { test: /\b(very |really )?(tidy|clean|neat)\b/i, out: [{ key: "cleanliness", value: 4 }] },
  { test: /\b(messy|laid[- ]back about (cleaning|mess)|relaxed about (cleaning|mess))\b/i, out: [{ key: "cleanliness", value: 2 }] },
  { test: /\b(work|working|study|studying) from home\b/i, out: [{ key: "workFromHome", value: "most" }] },
  { test: /\b(keep|like) (it )?cool\b|\bcool house\b/i, out: [{ key: "temperature", value: "cool" }] },
  { test: /\b(keep|like) (it )?warm\b|\bwarm house\b/i, out: [{ key: "temperature", value: "warm" }] },
  { test: /\bsplit (everything|bills|expenses) (equally|evenly)\b/i, out: [{ key: "expenseSplit", value: "equal" }] },
  { test: /\bquiet (after|from) (9|10|11)\b/i, out: [] }, // handled below with the hour
  { test: /\bpay (my )?share (of )?(bills|expenses) by (use|usage)\b/i, out: [{ key: "expenseSplit", value: "by-use" }] },
  { test: /\bcheck[- ]in\b.*\b(weekly|monthly)\b|\bregular check[- ]ins?\b/i, out: [{ key: "conflictStyle", value: "scheduled" }] },
  { test: /\btalk (things )?(out )?(right away|soon|directly)\b/i, out: [{ key: "conflictStyle", value: "talk-soon" }] },
  { test: /\bfurnished\b/i, out: [{ key: "furnished", value: "yes" }] },
  { test: /\bneed parking\b|\bhave a car\b/i, out: [{ key: "parking", value: "yes" }] },
];

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function extractFromText(text: string, now: Date = new Date()): ExtractionResult {
  const sensitive = screenProtectedLanguage(text).flagged || detectPromptInjection(text);
  const accepted: Extraction[] = [];
  const seen = new Set<FieldKey>();
  const push = (e: Extraction) => {
    if (!seen.has(e.key)) {
      seen.add(e.key);
      accepted.push(e);
    }
  };
  // Split into sentences so protected language in one sentence does not poison the others,
  // but the flagged sentence itself is ignored entirely.
  const sentences = text.split(/(?<=[.!?;])\s+|\n+/).filter(Boolean);
  for (const sentence of sentences) {
    if (screenProtectedLanguage(sentence).flagged || detectPromptInjection(sentence)) continue;
    for (const rule of RULES) {
      if (!rule.test.test(sentence)) continue;
      for (const o of rule.out) {
        push({
          key: o.key,
          value: o.value,
          uncertainty: "medium",
          evidence: sentence.slice(0, MAX_EVIDENCE),
          suggestedRequired: o.required === true,
        });
      }
    }
    const quiet = sentence.match(/\bquiet (?:after|from) (9|10|11)(?::30)?\s?(?:pm)?\b/i);
    if (quiet) {
      const hour = Number(quiet[1]) + 12;
      push({ key: "quietStartHour", value: Math.min(24, hour), uncertainty: "medium", evidence: sentence.slice(0, MAX_EVIDENCE) });
    }
    const budget = sentence.match(/\$\s?(\d{3,4})\b/);
    if (budget && /\b(budget|rent|pay|afford|month)/i.test(sentence)) {
      const v = normalizeValue("budgetMax", Number(budget[1]));
      if (v !== null) push({ key: "budgetMax", value: v, uncertainty: "medium", evidence: sentence.slice(0, MAX_EVIDENCE) });
    }
    const month = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b`, "i").test(sentence));
    if (month >= 0 && /\b(move|moving|start|available|lease)/i.test(sentence)) {
      let year = now.getFullYear();
      if (month < now.getMonth()) year += 1;
      push({ key: "moveInMonth", value: `${year}-${String(month + 1).padStart(2, "0")}`, uncertainty: "medium", evidence: sentence.slice(0, MAX_EVIDENCE) });
    }
  }
  return { accepted, rejected: [], sensitiveLanguageIgnored: sensitive };
}

/**
 * Apply extractions to a profile as UNCONFIRMED fields. Extracted fields never overwrite a
 * field the user already set, and never become "required" without explicit user confirmation.
 */
export function applyExtractions(
  profile: RoommateProfile,
  extractions: Extraction[],
  source: "user-text" | "ai-extracted",
): RoommateProfile {
  const fields = { ...profile.fields };
  for (const e of extractions) {
    if (fields[e.key]) continue;
    fields[e.key] = makeField(e.value, {
      priority: "preferred",
      source,
      uncertainty: e.uncertainty,
      confirmed: false,
      suggestedRequired: e.suggestedRequired === true,
    });
  }
  return { ...profile, fields };
}

/** User edit/confirmation. Setting "required" is only possible here, by the user. */
export function confirmField(
  profile: RoommateProfile,
  key: FieldKey,
  patch: { value?: FieldValue; priority?: ProfileField["priority"] } = {},
): RoommateProfile {
  const existing = profile.fields[key];
  if (!existing) return profile;
  let value = existing.value;
  if (patch.value !== undefined) {
    const v = normalizeValue(key, patch.value);
    if (v === null) return profile;
    value = v;
  }
  return {
    ...profile,
    fields: {
      ...profile.fields,
      [key]: { ...existing, value, priority: patch.priority ?? existing.priority, confirmed: true, uncertainty: "low" },
    },
  };
}

export function setFieldFromUser(profile: RoommateProfile, key: FieldKey, rawValue: unknown, priority: ProfileField["priority"] = "preferred"): RoommateProfile {
  const v = normalizeValue(key, rawValue);
  if (v === null) return profile;
  return {
    ...profile,
    fields: { ...profile.fields, [key]: makeField(v, { priority, source: "user-form", confirmed: true }) },
  };
}

export function removeField(profile: RoommateProfile, key: FieldKey): RoommateProfile {
  const { [key]: _removed, ...rest } = profile.fields;
  return { ...profile, fields: rest };
}

// ---------------------------------------------------------------------------
// Adaptive clarification: one question at a time, skippable, capped
// ---------------------------------------------------------------------------

export interface ClarifyingQuestion {
  key: FieldKey;
  question: string;
  options: Array<{ label: string; value: FieldValue }>;
}

const QUESTIONS: Partial<Record<FieldKey, ClarifyingQuestion>> = {
  budgetMax: { key: "budgetMax", question: "What's the most you'd comfortably pay per month for your share?", options: [900, 1100, 1300, 1500].map((v) => ({ label: `Up to $${v.toLocaleString()}`, value: v })) },
  moveInMonth: { key: "moveInMonth", question: "When would you like to move in?", options: [] },
  bedroom: { key: "bedroom", question: "Do you need a private bedroom?", options: [{ label: "Private bedroom", value: "private" }, { label: "Sharing is fine", value: "shared" }] },
  bathroom: { key: "bathroom", question: "How do you feel about sharing a bathroom?", options: [{ label: "I'd like a private one", value: "private" }, { label: "Sharing is fine", value: "shared" }] },
  sleep: { key: "sleep", question: "What does a typical day look like for sleep?", options: [{ label: "Early to bed, early up", value: "early" }, { label: "A standard schedule", value: "standard" }, { label: "Later nights", value: "late" }] },
  cookwareSharing: { key: "cookwareSharing", question: "How do you feel about sharing pots, pans and utensils?", options: [{ label: "Separate is better", value: "separate" }, { label: "Either way", value: "flexible" }, { label: "Happy to share", value: "shared" }] },
  guestFrequency: { key: "guestFrequency", question: "How often do you like having guests over?", options: [{ label: "Rarely", value: "rarely" }, { label: "Sometimes", value: "sometimes" }, { label: "Often", value: "often" }] },
  cleanliness: { key: "cleanliness", question: "How tidy do you like shared spaces? (1 relaxed – 5 very tidy)", options: [1, 2, 3, 4, 5].map((v) => ({ label: String(v), value: v })) },
  noiseTolerance: { key: "noiseTolerance", question: "How much everyday noise is fine with you? (1 very little – 5 a lot)", options: [1, 2, 3, 4, 5].map((v) => ({ label: String(v), value: v })) },
  expenseSplit: { key: "expenseSplit", question: "How would you like to split shared expenses?", options: [{ label: "Equally", value: "equal" }, { label: "By use", value: "by-use" }, { label: "Flexible", value: "flexible" }] },
  conflictStyle: { key: "conflictStyle", question: "If something bothers you, what works best?", options: [{ label: "Talk soon, directly", value: "talk-soon" }, { label: "A scheduled check-in", value: "scheduled" }, { label: "Write it down first", value: "written" }] },
};

/** Housing requirements first, then lifestyle keys that most often cause friction. */
const PRIORITY_ORDER: FieldKey[] = ["budgetMax", "bedroom", "bathroom", "sleep", "cookwareSharing", "guestFrequency", "cleanliness", "noiseTolerance", "expenseSplit", "conflictStyle"];

export const MAX_CLARIFYING_QUESTIONS = 4;

/**
 * Next question, or null when done. `asked` holds keys already asked or skipped, so questions never repeat.
 * A key the user already filled (confirmed or not) is never asked about again.
 */
export function nextClarifyingQuestion(profile: RoommateProfile, asked: readonly FieldKey[]): ClarifyingQuestion | null {
  if (asked.length >= MAX_CLARIFYING_QUESTIONS) return null;
  for (const key of PRIORITY_ORDER) {
    if (profile.fields[key] || asked.includes(key)) continue;
    const q = QUESTIONS[key];
    if (q && q.options.length > 0) return q;
  }
  return null;
}

/** Points worth a user-facing heads-up before confirmation (e.g. a required need next to a contradicting text value). */
export function describeUnresolved(profile: RoommateProfile): string[] {
  const out: string[] = [];
  for (const key of ["budgetMax", "moveInMonth", "bedroom", "bathroom"] as FieldKey[]) {
    if (!profile.fields[key]) out.push(`${FIELD_DEFS[key].label} not set — matching will treat it as unknown, not incompatible.`);
  }
  for (const key of FIELD_KEYS) {
    const f = profile.fields[key];
    if (f && !f.confirmed) out.push(`${FIELD_DEFS[key].label} was suggested from your description and is not used until you confirm it.`);
  }
  return out;
}
