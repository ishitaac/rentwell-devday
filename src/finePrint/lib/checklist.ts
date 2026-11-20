import type { Clause, CostSummary, TopicStatus } from "./types";
import { normalizeForMatch, numbersIn } from "./verify.js";

/**
 * Topic coverage. Code decides Found / Not found by scanning clause text; the model never
 * does. The preamble (banner, parties) and signature blocks never count as coverage.
 */

export interface Topic {
  id: string;
  label: string; // "Pets"
  subject: string; // used in "Pets aren't mentioned in this lease."
  plural: boolean;
  pattern: RegExp;
  question: string; // landlord question when not found
}

const t = (id: string, label: string, pattern: RegExp, question: string, subject = label, plural = false): Topic => ({
  id,
  label,
  subject,
  plural,
  pattern,
  question,
});

export const TOPICS: Topic[] = [
  t("pets", "Pets", /\bpets?\b|\banimals?\b/i, "What is your pet policy, and what does it cost?", "Pets", true),
  t("parking", "Parking", /\bparking\b|\bvehicles?\b/i, "Is parking included, and what does it cost?"),
  t("utilities", "Utilities", /\butilit(?:y|ies)\b|\belectric|\bwater\b|\bnatural gas\b/i, "Which utilities do I pay, and what did this unit average over the last 12 months?", "Utilities", true),
  t("internet", "Internet", /\binternet\b|\bwi-?fi\b|\btechnology package\b/i, "Is internet included, and can I use my own provider?"),
  t("renters_insurance", "Renter's insurance", /\binsurance\b/i, "Do I need renter's insurance, and how much coverage?"),
  t("security_deposit", "Security deposit", /\bsecurity deposit\b/i, "How much is the deposit, and what can be deducted from it?"),
  t("late_fees", "Late fees", /\blate (?:fee|charge)s?\b/i, "What are the late fees, and is there a grace period?", "Late fees", true),
  t("early_termination", "Moving out early", /\bearly termination\b|\bbefore the end of the term\b/i, "What happens if I need to move out early?"),
  t("subletting", "Subletting", /\bsublet|\bassign(?:ment)?\b/i, "Can I sublet or transfer the lease if plans change?"),
  t("guests", "Guests", /\bguests?\b/i, "Are there limits on overnight guests?", "Guests", true),
  t("occupancy", "Occupancy limit", /\boccupan(?:cy|ts?)\b|\boccupied\b/i, "How many people may live in the unit?"),
  t("maintenance", "Repairs", /\brepairs?\b|\bmaintenance\b/i, "How are repair requests handled, and how fast?", "Repairs", true),
  t("entry", "Landlord entry", /\benter the premises\b|\bentry\b/i, "How much notice do you give before entering?"),
  t("renewal", "Renewal", /\brenew|\bmonth-to-month\b/i, "What happens when the lease ends? Does it renew automatically?"),
  t("rent_increase", "Rent increases", /\brent schedule\b|\bincreas/i, "Can the rent go up during the lease?", "Rent increases", true),
  t("liability", "Roommate liability", /\bjointly and severally\b/i, "If a roommate leaves, am I responsible for their share?"),
  t("move_out", "Move-out", /\bmove-out\b|\bmove out\b|\bvacate\b/i, "What are the move-out requirements and charges?"),
  t("smoking", "Smoking", /\bsmok|\bvap(?:e|ing)\b/i, "What is the smoking and vaping policy?"),
  t("furnished", "Furnishings", /\bfurnish/i, "Is the unit furnished? What is included?", "Furnishings", true),
  t("laundry", "Laundry", /\blaundry\b|\bwasher\b|\bdryer\b/i, "Is there laundry in the unit or building, and what does it cost?"),
  t("appliances", "Appliances", /\bappliances?\b|\brefrigerator\b|\bdishwasher\b/i, "Which appliances are included, and who repairs them?", "Appliances", true),
  t("heating_cooling", "Heating and A/C", /\bheat(?:ing)?\b|\bair condition|\bhvac\b|\bfurnace\b/i, "How is the unit heated and cooled, and who pays for it?"),
  t("quiet_hours", "Quiet hours", /\bquiet hours\b|\bnoise\b/i, "Are there quiet hours or noise rules?", "Quiet hours", true),
  t("snow_removal", "Snow removal", /\bsnow\b/i, "Who handles snow removal for walkways and parking?"),
  t("storage", "Storage", /\bstorage\b|\bbike room\b/i, "Is there storage space, and does it cost extra?"),
];

const NON_COVERAGE_IDS = /^(preamble|signatures?)/;

export function scanTopics(clauses: Clause[]): TopicStatus[] {
  const scannable = clauses.filter((c) => !NON_COVERAGE_IDS.test(c.id));
  return TOPICS.map((topic) => {
    const clauseIds = scannable
      .filter((c) => topic.pattern.test(normalizeForMatch(`${c.heading ?? ""} ${c.text}`)))
      .map((c) => c.id);
    return {
      topic: topic.id,
      label: topic.label,
      status: clauseIds.length > 0 ? "found" : "not_found",
      clauseIds,
    };
  });
}

export function topicById(id: string): Topic | undefined {
  return TOPICS.find((topic) => topic.id === id);
}

export function notFoundSentence(topic: Topic): string {
  return `${topic.subject} ${topic.plural ? "aren't" : "isn't"} mentioned in this lease. Worth asking before you sign.`;
}

const OCCUPANCY_RE = /(?:maximum occupancy|occupied by no more than|no more than|limited to|at most)[^.]*?\b(\w+)\s*(?:\(\d+\)\s*)?(?:persons|people|occupants|residents)/i;

/** Reads "Maximum occupancy is two (2) persons" style limits. Code, not the model. */
export function findOccupancyLimit(clauses: Clause[]): CostSummary["occupancyLimit"] {
  for (const clause of clauses) {
    const text = normalizeForMatch(clause.text);
    const match = text.match(OCCUPANCY_RE);
    if (!match) continue;
    const [max] = numbersIn(match[0].slice(match[0].toLowerCase().lastIndexOf(match[1].toLowerCase())));
    if (max && max > 0) return { max, clauseId: clause.id };
  }
  return null;
}
