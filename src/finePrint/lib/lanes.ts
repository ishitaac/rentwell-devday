import { notFoundSentence, TOPICS, topicById } from "./checklist.js";
import { computeCosts } from "./costs.js";
import { formatDollars } from "./format.js";
import { looksLikeInjection } from "./injection.js";
import type { AnalysisResult, Clause, CostScenario, Finding, QuoteRef, TopicStatus } from "./types";

/**
 * Ask panel routing (spec §8). A router (model or local rules) proposes a lane; code
 * decides the final lane against the checklist and builds every reply from templates.
 * Only IN_LEASE answers contain model prose, and those carry verified quotes.
 */

export type RouterLane = "IN_LEASE" | "LEGAL_JUDGMENT" | "WHAT_IF" | "OFF_TOPIC";
export type Lane = RouterLane | "NOT_IN_LEASE";

export interface WhatIf {
  occupants: number | null; // total people, when stated
  addOccupants?: number | null; // relative change ("my friend moves in too" = +1); code adds it
  removeCharge: string | null;
  includeEstimates: boolean | null;
}

export interface RouteDecision {
  lane: RouterLane;
  topic: string | null;
  whatIf: WhatIf | null;
  ack: string | null;
}

export interface AskRequest {
  question: string;
  analysis: { topics: TopicStatus[]; charges: { id: string; label: string }[] };
  leaseClauses: Clause[];
}

export interface Citation extends QuoteRef {
  section: string;
}

export interface AskReply {
  lane: Lane;
  text: string;
  topic: string | null;
  citations: Citation[];
  whatIf: WhatIf | null;
  chips: string[];
  addQuestion: string | null;
  source: "model" | "local";
}

export const SUGGESTION_CHIPS = ["Pets?", "What if we move out early?", "Guests?", "What's not included?"];
export const OFF_TOPIC_REDIRECT = "I only read leases though.";
export const LEGAL_LINE = "I can tell you what it says and what to ask, not whether it's enforceable.";
export const UNVERIFIED_LINE = "I couldn't verify that against the lease.";
export const NOT_INCLUDED_TOPIC = "not_included";
const NEUTRAL_ACK = "Got it.";
const ACK_MAX_WORDS = 8;

const LEGAL_RE =
  /\b(legal|illegal|lawful|unlawful|enforceable|enforce|sue|lawyer|attorney|tenant (?:law|rights)|my rights|allowed to (?:do|charge)|can they (?:do|charge|make|keep|evict)|get away with)\b/i;
const NOT_INCLUDED_RE = /\b(not included|isn'?t included|what'?s missing|doesn'?t (?:say|mention|cover)|not (?:in|covered by) (?:the|this) lease)\b/i;

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const OCCUPANTS_RE = /\b(\d|one|two|three|four|five|six)\s+(?:roommates?|people|persons|occupants|of us|tenants|residents)\b/i;
const SPLIT_RE = /\bsplit\s+(\d|two|three|four|five|six)\s+ways\b/i;
const REMOVE_RE = /\b(?:skip|without|drop|remove|cancel|no|don'?t (?:need|want|have)|get rid of)\s+(?:the\s+|a\s+|my\s+|our\s+)?([a-z][a-z' -]{2,30})/i;
const ESTIMATE_RE = /\b(?:include|add|with|count)\b[^.]{0,20}\b(?:estimate[sd]?|utilit(?:y|ies)|water)\b/i;

/** Extra phrasings a renter uses that the checklist keywords would miss. */
const TOPIC_SYNONYMS: Record<string, RegExp> = {
  pets: /\b(dogs?|cats?|puppy|kitten|service animal|emotional support)\b/i,
  early_termination: /\b(move out early|moving out early|break (?:the|my) lease|leave early|end (?:the|my) lease early|terminate)\b/i,
  subletting: /\b(sublease|subletting|someone take over|take over (?:the|my) lease)\b/i,
  guests: /\b(visitors?|stay over|staying over|overnight|boyfriend|girlfriend|partner stay)\b/i,
  utilities: /\b(power|electricity|heat bill|gas bill)\b/i,
  renters_insurance: /\binsur/i,
  late_fees: /\b(pay late|paying late|late payment|grace period)\b/i,
  security_deposit: /\bdeposit back\b|\bget my deposit\b/i,
  rent_increase: /\b(rent (?:go|going) up|raise the rent|rent increase)\b/i,
  maintenance: /\b(broken|fix|repair)\b/i,
};

function wordToNumber(word: string): number {
  return NUMBER_WORDS[word.toLowerCase()] ?? Number(word);
}

/** Best-matching checklist topic for a message, or null. */
export function matchTopic(message: string): string | null {
  for (const [id, pattern] of Object.entries(TOPIC_SYNONYMS)) if (pattern.test(message)) return id;
  const topic = TOPICS.find((t) => t.pattern.test(message));
  return topic ? topic.id : null;
}

export { looksLikeInjection };

export function parseWhatIf(message: string): WhatIf | null {
  const occupants = message.match(OCCUPANTS_RE) ?? message.match(SPLIT_RE);
  const remove = message.match(REMOVE_RE);
  const estimates = ESTIMATE_RE.test(message);
  const whatIf: WhatIf = {
    occupants: occupants ? wordToNumber(occupants[1]) : null,
    removeCharge: remove ? remove[1].trim().replace(/[?.!]+$/, "") : null,
    includeEstimates: estimates ? true : null,
  };
  return whatIf.occupants !== null || whatIf.removeCharge !== null || whatIf.includeEstimates !== null ? whatIf : null;
}

const MATCH_STOP = new Set(["the", "a", "an", "our", "my", "fee", "fees", "charge", "charges", "monthly", "month", "cost", "costs", "service", "services"]);

/** Content words, plurals reduced safely ("pests" -> "pest", but "gas" and "glass" stay). */
export function chargeTerms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? [])
    .filter((w) => !MATCH_STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .filter((w) => w.length > 2);
}

/** Index of the label that shares the most terms with `term`, or -1 when none share any. */
export function matchCharge(term: string, labels: string[]): number {
  const wanted = chargeTerms(term);
  let best = -1;
  let bestScore = 0;
  labels.forEach((label, i) => {
    const have = chargeTerms(label);
    const score = wanted.filter((w) => have.some((h) => h.startsWith(w) || w.startsWith(h))).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/**
 * Deterministic routing for messages that do not need a model. Null means "ask the router".
 * A "remove X" what-if is only taken locally when X is a real charge (or a known non-charge
 * like pets); otherwise "move out without notice" would be mistaken for a scenario change.
 */
export function preRoute(message: string, chargeLabels: string[] = []): RouteDecision | null {
  const text = message.trim();
  if (looksLikeInjection(text)) return { lane: "OFF_TOPIC", topic: null, whatIf: null, ack: NEUTRAL_ACK };
  if (LEGAL_RE.test(text)) return { lane: "LEGAL_JUDGMENT", topic: matchTopic(text), whatIf: null, ack: null };
  if (NOT_INCLUDED_RE.test(text)) return { lane: "IN_LEASE", topic: NOT_INCLUDED_TOPIC, whatIf: null, ack: null };
  if (!/\b(what if|what would|split|skip|without|drop|include)\b/i.test(text)) return null;
  const whatIf = parseWhatIf(text);
  if (!whatIf) return null;
  const onlyRemoval = whatIf.occupants === null && whatIf.includeEstimates === null;
  if (onlyRemoval && matchCharge(whatIf.removeCharge!, chargeLabels) < 0 && !matchTopic(whatIf.removeCharge!)?.match(/^pets$/)) {
    return null;
  }
  return { lane: "WHAT_IF", topic: null, whatIf, ack: null };
}

const hasChange = (w: WhatIf | null): w is WhatIf =>
  Boolean(w && (w.occupants !== null || Boolean(w.addOccupants) || w.removeCharge !== null || w.includeEstimates !== null));

/** A router WHAT_IF with no usable change falls back to local parsing, else a lease question. */
export function routeOrFallback(decision: RouteDecision, question: string): RouteDecision {
  if (decision.lane !== "WHAT_IF" || hasChange(decision.whatIf)) return decision;
  const parsed = parseWhatIf(question);
  if (hasChange(parsed)) return { ...decision, whatIf: parsed };
  return { lane: "IN_LEASE", topic: matchTopic(question), whatIf: null, ack: null };
}

/** Offline / router-failure routing: local rules, then topic keywords, else off-topic. */
export function fallbackRoute(message: string, chargeLabels: string[] = []): RouteDecision {
  const pre = preRoute(message, chargeLabels);
  if (pre) return pre;
  const topic = matchTopic(message);
  return topic
    ? { lane: "IN_LEASE", topic, whatIf: null, ack: null }
    : { lane: "OFF_TOPIC", topic: null, whatIf: null, ack: NEUTRAL_ACK };
}

/** Max 8 words, no questions, links, or instructions. Otherwise a neutral ack. */
export function sanitizeAck(ack: string | null): string {
  if (!ack) return NEUTRAL_ACK;
  const clean = ack.replace(/\s+/g, " ").trim();
  const unsafe = /[?<>{}[\]`]|https?:|www\.|\.com\b|\b(ignore|click|visit|try|ask|tell|go to|instructions?)\b/i;
  if (!clean || unsafe.test(clean) || looksLikeInjection(clean)) return NEUTRAL_ACK;
  const words = clean.split(" ").slice(0, ACK_MAX_WORDS).join(" ").replace(/[,;:\-–]+$/, "");
  return /[.!]$/.test(words) ? words : `${words}.`;
}

/** Code has the final say: a lease topic the checklist did not find becomes NOT_IN_LEASE. */
export function resolveLane(decision: RouteDecision, topics: TopicStatus[]): Lane {
  if (decision.lane !== "IN_LEASE" || !decision.topic || decision.topic === NOT_INCLUDED_TOPIC) return decision.lane;
  const status = topics.find((t) => t.topic === decision.topic);
  return status?.status === "not_found" ? "NOT_IN_LEASE" : "IN_LEASE";
}

const base = (lane: Lane, text: string, extra: Partial<AskReply> = {}): AskReply => ({
  lane,
  text,
  topic: null,
  citations: [],
  whatIf: null,
  chips: [],
  addQuestion: null,
  source: "local",
  ...extra,
});

export function offTopicReply(ack: string | null): AskReply {
  return base("OFF_TOPIC", `${sanitizeAck(ack)} ${OFF_TOPIC_REDIRECT}`, { chips: SUGGESTION_CHIPS.slice(1) });
}

/** WHAT_IF carries only the change; the confirmation line is computed by applyWhatIf. */
export function whatIfReply(whatIf: WhatIf | null): AskReply {
  return base("WHAT_IF", "", { whatIf });
}

export function notInLeaseReply(topicId: string): AskReply {
  const topic = topicById(topicId);
  const text = topic ? notFoundSentence(topic) : "The lease doesn't say. Worth asking before you sign.";
  return base("NOT_IN_LEASE", text, { topic: topicId, addQuestion: topic?.question ?? null });
}

/** First sentence of each clause that mentions the topic: exact lease text, chosen by code. */
export function topicCitations(topicId: string | null, topics: TopicStatus[], clauses: Clause[], limit = 2): Citation[] {
  const topic = topicId ? topicById(topicId) : undefined;
  const status = topics.find((t) => t.topic === topicId);
  if (!topic || !status) return [];
  return status.clauseIds.slice(0, limit).flatMap((id) => {
    const clause = clauses.find((c) => c.id === id);
    if (!clause) return [];
    const sentence = clause.text.split(/(?<=[.!?])\s+/).find((s) => topic.pattern.test(s)) ?? clause.text.split(/(?<=[.!?])\s+/)[0];
    return [{ clauseId: id, quote: sentence, section: clause.section }];
  });
}

const LABEL_STOP = new Set(["fee", "fees", "charge", "deposit", "the", "and", "for", "with", "per", "month", "monthly"]);

/** A verified charge whose distinctive label words appear in the question ("carpet cleaning"). */
export function findingCitation(question: string, findings: Finding[], clauses: Clause[]): Citation[] {
  const q = question.toLowerCase();
  const hit = findings.find((f) => {
    if (!f.verified) return false;
    const words = (f.label.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !LABEL_STOP.has(w));
    return words.length > 0 && words.some((w) => q.includes(w));
  });
  const clause = hit && clauses.find((c) => c.id === hit.clauseId);
  return hit && clause ? [{ clauseId: hit.clauseId, quote: hit.quote, section: clause.section }] : [];
}

export function legalReply(
  topicId: string | null,
  topics: TopicStatus[],
  clauses: Clause[],
  fallback: Citation[] = [],
): AskReply {
  const fromTopic = topicCitations(topicId, topics, clauses);
  const citations = fromTopic.length > 0 ? fromTopic : fallback;
  const lead = citations.length > 0 ? `${LEGAL_LINE} Here's the clause:` : LEGAL_LINE;
  return base("LEGAL_JUDGMENT", lead, { topic: topicId, citations });
}

/** Used offline or when the answer model is unavailable: quote the lease, no prose. */
export function quoteOnlyReply(topicId: string, topics: TopicStatus[], clauses: Clause[]): AskReply {
  const citations = topicCitations(topicId, topics, clauses);
  if (citations.length === 0) return notInLeaseReply(topicId);
  return base("IN_LEASE", "Here's what the lease says:", { topic: topicId, citations });
}

export function notIncludedReply(analysis: Pick<AnalysisResult, "topics" | "costs">): AskReply {
  const missing = analysis.topics.filter((t) => t.status === "not_found").map((t) => t.label);
  const unpriced = analysis.costs.unknowns.map((u) => u.label);
  const parts = [
    unpriced.length > 0 ? `Not priced: ${unpriced.join(", ")}.` : "",
    missing.length > 0 ? `Not mentioned: ${missing.join(", ")}.` : "",
  ].filter(Boolean);
  return base("IN_LEASE", parts.join(" ") || "This lease covers every topic on our checklist.", { topic: NOT_INCLUDED_TOPIC });
}

// ---- WHAT_IF: scenario math in code, never a document edit ----

export interface WhatIfResult {
  scenario: CostScenario;
  message: string;
}

export function applyWhatIf(analysis: AnalysisResult, scenario: CostScenario, whatIf: WhatIf): WhatIfResult {
  let next: CostScenario = { ...scenario, excludedFindingIds: [...scenario.excludedFindingIds] };
  const notes: string[] = [];

  const target = whatIf.addOccupants ? scenario.occupants + whatIf.addOccupants : whatIf.occupants;
  if (target !== null && target !== undefined) {
    next = { ...next, occupants: Math.min(4, Math.max(1, Math.round(target))) };
  }
  if (whatIf.includeEstimates !== null) next = { ...next, includeEstimates: whatIf.includeEstimates };

  if (whatIf.removeCharge) {
    const costsNow = computeCosts(analysis.findings, analysis.rentSchedule, next, analysis.costs.occupancyLimit);
    const candidates = [...costsNow.monthlyLines, ...(next.includeEstimates ? costsNow.estimateLines : [])];
    const hit = candidates[matchCharge(whatIf.removeCharge, candidates.map((c) => c.label))];
    if (hit) {
      next = { ...next, excludedFindingIds: [...next.excludedFindingIds, hit.findingId] };
      const finding = analysis.findings.find((f) => f.id === hit.findingId);
      const section = analysis.clauses.find((c) => c.id === finding?.clauseId)?.section;
      if (finding?.isRequired) notes.push(`Note: ${section ?? "the lease"} lists ${hit.label.toLowerCase()} as required, so ask before counting on this.`);
      notes.unshift(`Without ${hit.label.toLowerCase()}`);
    } else {
      notes.unshift(`${capitalize(whatIf.removeCharge.replace(/^(the|a|an|our|my)\s+/i, ""))} isn't in your monthly total, so nothing changes`);
    }
  }

  const costs = computeCosts(analysis.findings, analysis.rentSchedule, next, analysis.costs.occupancyLimit);
  const total = costs.displayedMonthlyCents;
  const shares = costs.perPersonDollars;
  const headline = total === null ? "No monthly total found" : `${formatDollars(total)} a month`;
  const split =
    shares.length > 1
      ? shares.every((s) => s === shares[0])
        ? `, ${formatDollars(shares[0] * 100)} each for ${shares.length}`
        : `, split ${shares.length} ways: ${shares.map((s) => formatDollars(s * 100)).join(" / ")}`
      : "";
  const lead = notes.length > 0 && !notes[0].startsWith("Note") ? `${notes.shift()}: ` : "Updated: ";
  const limit = costs.occupancyLimit && next.occupants > costs.occupancyLimit.max
    ? ` Heads up: this lease allows ${costs.occupancyLimit.max} people max.`
    : "";
  return { scenario: next, message: `${lead}${headline}${split}.${limit}${notes.length ? ` ${notes.join(" ")}` : ""}` };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
