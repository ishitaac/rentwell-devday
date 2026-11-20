/**
 * Deterministic, version-controlled compliance layer.
 *
 * - No AI prompt can change anything here. Claude is never asked whether something is allowed.
 * - Statuses record product policy, NOT legal approval. Nothing in this file has had legal review.
 * - Every sensitive behavior is RESTRICTED or UNVERIFIED; both mean "disabled".
 * - Legal references are pointers for a reviewing attorney, not conclusions.
 */

export const COMPLIANCE_RULESET_VERSION = "2026-11-19.1";

export type PolicyStatus = "ALLOWED" | "RESTRICTED" | "UNVERIFIED";
export type ReviewerStatus = "unreviewed" | "in-review" | "reviewed";

export type SensitiveBehavior =
  | "filter-by-gender"
  | "filter-by-race-or-color"
  | "filter-by-religion"
  | "filter-by-national-origin"
  | "filter-by-sexual-orientation-or-gender-identity"
  | "filter-by-familial-status"
  | "filter-by-disability"
  | "filter-by-source-of-income"
  | "infer-protected-attribute"
  | "exclude-assistance-animal"
  | "use-neighborhood-demographics";

export interface ComplianceRule {
  ruleId: string;
  behavior: SensitiveBehavior;
  status: PolicyStatus;
  /** "federal", a state code, or "<STATE>:<city>". "*" = default policy everywhere. */
  jurisdiction: string;
  legalSource: string;
  effectiveDate: string;
  reviewDate: string | null;
  reviewerStatus: ReviewerStatus;
  ruleVersion: string;
  note: string;
}

const FEDERAL_FHA = "Fair Housing Act, 42 U.S.C. §§ 3601–3619 (reference only; not reviewed)";
const UTAH_FHA = "Utah Fair Housing Act, Utah Code Title 57, Chapter 21 (reference only; not reviewed)";

function rule(
  behavior: SensitiveBehavior,
  status: PolicyStatus,
  legalSource: string,
  note: string,
  jurisdiction = "*",
): ComplianceRule {
  return {
    ruleId: `${behavior}@${jurisdiction}`,
    behavior,
    status,
    jurisdiction,
    legalSource,
    effectiveDate: "2026-11-19",
    reviewDate: null,
    reviewerStatus: "unreviewed",
    ruleVersion: COMPLIANCE_RULESET_VERSION,
    note,
  };
}

export const COMPLIANCE_RULES: readonly ComplianceRule[] = [
  rule(
    "filter-by-gender",
    "UNVERIFIED",
    `${FEDERAL_FHA}; ${UTAH_FHA}. Fair Housing Council v. Roommate.com, 666 F.3d 1216 (9th Cir. 2012) is Ninth Circuit authority and is NOT treated as binding in Utah.`,
    "Disabled until counsel documents the exact functionality and verified housing context. A user describing their gender never creates a filter.",
  ),
  rule("filter-by-race-or-color", "RESTRICTED", FEDERAL_FHA, "Product policy: never used."),
  rule("filter-by-religion", "RESTRICTED", FEDERAL_FHA, "Product policy: never used. Food compatibility uses kitchen behaviors only."),
  rule("filter-by-national-origin", "RESTRICTED", FEDERAL_FHA, "Product policy: never used."),
  rule("filter-by-sexual-orientation-or-gender-identity", "RESTRICTED", `${UTAH_FHA}; local ordinances not evaluated`, "Product policy: never used."),
  rule("filter-by-familial-status", "RESTRICTED", FEDERAL_FHA, "Product policy: never used."),
  rule("filter-by-disability", "RESTRICTED", FEDERAL_FHA, "Product policy: never used; do not request medical details."),
  rule("filter-by-source-of-income", "RESTRICTED", "State/local source-of-income rules vary; not evaluated", "Product policy: never used."),
  rule("infer-protected-attribute", "RESTRICTED", FEDERAL_FHA, "No inference from names, photos, language, religious or dietary practice, neighborhood demographics, or disclosures."),
  rule("exclude-assistance-animal", "RESTRICTED", FEDERAL_FHA, "Assistance animals are not pets; they never trigger pet-based exclusion."),
  rule("use-neighborhood-demographics", "RESTRICTED", FEDERAL_FHA, "Location selects jurisdiction and housing context only."),
];

export interface JurisdictionChain {
  levels: string[];
  /** Levels whose rules this version does not evaluate; surfaced to the user and to reviewers. */
  notEvaluated: string[];
}

/** Federal -> state -> local. Only Utah has any state-specific entry; everything else is flagged. */
export function resolveJurisdiction(state?: string, city?: string): JurisdictionChain {
  const levels = ["federal"];
  const notEvaluated: string[] = [];
  const st = state?.trim().toUpperCase();
  if (!st) {
    notEvaluated.push("state (not provided)");
  } else {
    levels.push(st);
    if (st !== "UT") notEvaluated.push(`${st} state rules (only Utah is modeled)`);
  }
  if (city?.trim()) {
    notEvaluated.push(`local rules for ${city.trim()} (municipal ordinances not modeled)`);
  } else {
    notEvaluated.push("local rules (city not provided)");
  }
  return { levels, notEvaluated };
}

export interface ComplianceContext {
  state?: string;
  city?: string;
  /** e.g. "owner-occupied-room", "independent-unit", "unknown". Recorded; never assumed to create an exception. */
  housingArrangement?: "owner-occupied-room" | "shared-unit" | "independent-unit" | "unknown";
}

export interface BehaviorDecision {
  behavior: SensitiveBehavior;
  status: PolicyStatus;
  enabled: boolean;
  rule: ComplianceRule | null;
  jurisdiction: JurisdictionChain;
  rulesetVersion: string;
}

/**
 * Most specific matching rule wins; no match => UNVERIFIED (disabled).
 * `enabled` is true only for ALLOWED, and nothing in this ruleset is ALLOWED.
 */
export function evaluateBehavior(behavior: SensitiveBehavior, ctx: ComplianceContext = {}): BehaviorDecision {
  const jurisdiction = resolveJurisdiction(ctx.state, ctx.city);
  const candidates = COMPLIANCE_RULES.filter((r) => r.behavior === behavior);
  const specific = candidates.find((r) => r.jurisdiction !== "*" && jurisdiction.levels.includes(r.jurisdiction));
  const chosen = specific ?? candidates.find((r) => r.jurisdiction === "*") ?? null;
  const status: PolicyStatus = chosen?.status ?? "UNVERIFIED";
  return {
    behavior,
    status,
    enabled: status === "ALLOWED",
    rule: chosen,
    jurisdiction,
    rulesetVersion: COMPLIANCE_RULESET_VERSION,
  };
}

/** Re-evaluate every behavior; call again whenever location or arrangement changes. */
export function evaluateAll(ctx: ComplianceContext = {}): BehaviorDecision[] {
  return COMPLIANCE_RULES.map((r) => evaluateBehavior(r.behavior, ctx));
}

export function complianceDisclosure(): string {
  return "Automated policy checks help keep matching to housing needs and household habits. They are not legal certification or legal advice, and RentWell's rules have not had legal review.";
}

// ---------------------------------------------------------------------------
// Text screens (best-effort guards, not a complete legal classifier)
// ---------------------------------------------------------------------------

const CATEGORY_TERMS: Record<string, string[]> = {
  sex_gender: ["men", "man", "male", "males", "women", "woman", "female", "females", "girls", "guys", "transgender", "trans", "nonbinary"],
  orientation: ["gay", "lesbian", "straight", "bisexual", "queer", "heterosexual", "homosexual"],
  religion: ["christian", "christians", "muslim", "muslims", "jewish", "jews", "hindu", "hindus", "buddhist", "atheist", "atheists", "mormon", "mormons", "lds", "catholic", "religious"],
  race_origin: ["white", "black", "asian", "latino", "latina", "latinx", "hispanic", "arab", "african", "indian", "immigrant", "immigrants", "foreigner", "foreigners", "citizens", "nationality", "ethnicity", "race"],
  familial: ["kids", "children", "child", "families", "family", "pregnant", "single mother", "single mothers"],
  disability: ["disabled", "disability", "wheelchair", "handicapped", "mental illness", "autistic", "adhd", "depressed"],
  income_source: ["section 8", "voucher", "vouchers", "welfare", "disability income"],
};

const DIRECTIVE = /\b(only|no|not|never|prefer\w*|requir\w*|want\w*|must be|have to be|should be|without|exclud\w*|except|ban\w*|looking for|allow\w*|reject\w*|avoid\w*)\b/i;

export interface TextScreenResult {
  flagged: boolean;
  categories: string[];
}

/**
 * Flags text that pairs a protected-category term with a directive (e.g. "no kids", "women only").
 * Used on user free text, negotiation proposals and AI output. It errs toward flagging.
 */
export function screenProtectedLanguage(text: string): TextScreenResult {
  const lower = text.toLowerCase();
  const categories: string[] = [];
  for (const [category, terms] of Object.entries(CATEGORY_TERMS)) {
    const hit = terms.some((t) => new RegExp(`(^|[^a-z])${t.replace(/ /g, "\\s+")}([^a-z]|$)`, "i").test(lower));
    if (hit && DIRECTIVE.test(lower)) categories.push(category);
  }
  return { flagged: categories.length > 0, categories };
}

/** Any mention at all of a protected-category term. Stricter; used on AI-generated narration. */
export function mentionsProtectedTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return Object.values(CATEGORY_TERMS)
    .flat()
    .some((t) => new RegExp(`(^|[^a-z])${t.replace(/ /g, "\\s+")}([^a-z]|$)`, "i").test(lower));
}

const INJECTION_PATTERNS = [
  /ignore (all |any |the )?(previous|prior|above) (instructions|rules|prompts?)/i,
  /disregard (all |any |the )?(previous|prior|above|your) (instructions|rules)/i,
  /\bsystem prompt\b/i,
  /you are now\b/i,
  /\bact as\b.{0,30}\b(admin|developer|system)\b/i,
  /\boverride\b.{0,30}\b(compliance|policy|rules|filter)/i,
  /\b(enable|turn on|unlock)\b.{0,30}\b(gender|religion|race)\b.{0,20}\bfilter/i,
  /reveal .{0,30}(instructions|prompt|api key|other user)/i,
];

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

/** Strip control characters and cap length before any text goes into a model prompt. */
export function sanitizeUserText(text: string, maxChars: number): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").slice(0, maxChars).trim();
}
