/**
 * Fictional AI roommate for the demo: personas, deterministic safety constraints, a scripted fallback
 * responder, validation of model output, and the pure function that applies a reply to the negotiation
 * state machine. Shared by the server (demo endpoint) and the client (fallback). No network, no I/O.
 *
 * Claude only writes the conversation. Which terms are acceptable, what is accepted, rejected or
 * countered, and every state transition are decided here, deterministically.
 */
import { detectPromptInjection, mentionsProtectedTerm, screenProtectedLanguage } from "./compliance";
import {
  ALL_TOPICS,
  approveTerm,
  editTerm,
  markDiscussing,
  NegotiationError,
  proposeTerm,
  rejectTerm,
  type NegotiationTopic,
  type Session,
} from "./negotiation";
import { SCENARIO_IDS } from "./simulator";

export const MAX_MESSAGE_CHARS = 400;
export const MAX_HISTORY = 12;

export type Stance = "accept" | "counter" | "reject" | "discuss";
export interface ChatTurn {
  role: "user" | "jordan";
  text: string;
}
export interface ScenarioContext {
  id: string;
  title: string;
  situation: string;
  friction: string;
}
export interface JordanTurnInput {
  personaId: string;
  message: string;
  history: ChatTurn[];
  openTopics: NegotiationTopic[];
  scenario?: ScenarioContext;
  flaggedTopics: NegotiationTopic[];
  compatibility: string[];
}
export interface JordanReply {
  message: string;
  stance: Stance;
  topic: NegotiationTopic | null;
  /** The user's proposal wording, when the message was a proposal on an ordinary household topic. */
  proposalText: string | null;
  counterText: string | null;
  /** True when deterministic constraints replaced something the model said. */
  overridden: boolean;
}

// -- personas ------------------------------------------------------------------------

export interface Persona {
  profileId: string;
  name: string;
  /** Facts the roommate may state about itself. Ordinary household habits only. */
  about: string[];
  /** Latest weeknight quiet-hours start the persona accepts (24h clock; 24 = midnight, 25 = 1 AM). */
  quietLatest: number;
  quietPreferred: number;
  maxGuestNights: number;
  /** Hours of heads-up wanted before overnight guests; 0 = none required. */
  guestNoticeHours: number;
  cleaningNeedsSchedule: boolean;
  separateCookware: boolean;
  equalUtilities: boolean;
}

export const PERSONAS: Record<string, Persona> = {
  "demo-jordan": {
    profileId: "demo-jordan", name: "Jordan",
    about: ["Works from home some days and needs quiet in the evening", "Usually winds down by 10 PM and is up around 6:30 AM", "Likes a tidy kitchen; dishes get done the same day", "Prefers personal cookware, happy to share basics", "Fine with occasional guests with a day's heads-up, up to two nights in a row", "Prefers splitting utilities evenly"],
    quietLatest: 22.5, quietPreferred: 22, maxGuestNights: 2, guestNoticeHours: 24, cleaningNeedsSchedule: true, separateCookware: true, equalUtilities: true,
  },
  "demo-maya": {
    profileId: "demo-maya", name: "Maya",
    about: ["Early sleeper; quiet from 10 PM", "Cooks daily and prefers separate cookware", "Likes a tidy home", "Guests are occasional; overnight sometimes with notice"],
    quietLatest: 22.5, quietPreferred: 22, maxGuestNights: 2, guestNoticeHours: 24, cleaningNeedsSchedule: true, separateCookware: true, equalUtilities: true,
  },
  "demo-alex": {
    profileId: "demo-alex", name: "Alex",
    about: ["Night owl who works from home most days", "Relaxed about noise and timing", "Often has friends over", "Flexible about splitting expenses"],
    quietLatest: 25, quietPreferred: 24, maxGuestNights: 4, guestNoticeHours: 0, cleaningNeedsSchedule: false, separateCookware: false, equalUtilities: false,
  },
  "demo-riley": {
    profileId: "demo-riley", name: "Riley",
    about: ["Standard sleep schedule", "Relaxed about tidiness", "Happy to share cookware", "Prefers splitting costs by use"],
    quietLatest: 23, quietPreferred: 22.5, maxGuestNights: 3, guestNoticeHours: 12, cleaningNeedsSchedule: false, separateCookware: false, equalUtilities: false,
  },
};

export function personaFor(profileId: string): Persona | null {
  return PERSONAS[profileId] ?? null;
}

// -- deterministic constraints -------------------------------------------------------

export function fmtHour(h: number): string {
  if (h === 24) return "midnight";
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  const hh = whole % 24;
  const h12 = hh % 12 || 12;
  return `${h12}${mins ? `:${String(mins).padStart(2, "0")}` : ""} ${hh >= 12 ? "PM" : "AM"}`;
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

export interface Constraints {
  /** Earliest evening/night clock time mentioned, 24h; null if none. */
  quietStart: number | null;
  nights: number | null;
  noNotice: boolean;
  vagueCleaning: boolean;
  shareEverything: boolean;
  unequalSplit: boolean;
}

export function constraintsOf(text: string): Constraints {
  const t = text.toLowerCase();
  const times: number[] = [];
  for (const m of t.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/g)) {
    const pm = m[3].startsWith("p");
    const base = Number(m[1]) % 12;
    if (!pm && base !== 0) continue; // morning times are not quiet-hours starts
    times.push((pm ? base + 12 : 24) + Number(m[2] ?? 0) / 60);
  }
  if (/\bmidnight\b/.test(t)) times.push(24);
  const nights: number[] = [];
  for (const m of t.matchAll(/\b(\d+|one|two|three|four|five|six|seven)\s*(?:consecutive\s+|straight\s+)?nights?\b/g)) nights.push(NUMBER_WORDS[m[1]] ?? Number(m[1]));
  const split = t.match(/\b(\d{2})\s*[/:]\s*(\d{2})\b/);
  return {
    quietStart: times.length ? Math.min(...times) : null,
    nights: nights.length ? Math.max(...nights) : null,
    noNotice: /\b(?:no|without)\s+(?:a\s+)?(?:heads[- ]?up|notice|warning)\b|\bwithout\s+(?:asking|telling)\b|\bany\s?time\b/.test(t),
    vagueCleaning: /\bwhenever\b|\bas needed\b|\bno schedule\b|\bwhen (?:it|things?) (?:gets?|get) (?:bad|dirty|messy)\b|\bdon'?t (?:need|have) to clean\b/.test(t),
    shareEverything: /\b(?:share|use) (?:everything|anything|all)\b|\bhelp yourself\b|\bno labels?\b/.test(t),
    unequalSplit: (!!split && split[1] !== split[2]) || /\bunequal\b|\b(?:you|i) pay(?:s)? (?:all|everything)\b/.test(t),
  };
}

export const sameConstraints = (a: string, b: string) => JSON.stringify(constraintsOf(a)) === JSON.stringify(constraintsOf(b));

export function counterFor(p: Persona, topic: NegotiationTopic): string | null {
  switch (topic) {
    case "quiet-hours":
      return `Quiet hours in shared spaces start at ${fmtHour(p.quietPreferred)} on weeknights and ${fmtHour(p.quietPreferred + 1)} on weekends; headphones are fine any time.`;
    case "overnight-guests":
      return p.guestNoticeHours ? `Overnight guests are fine with a ${p.guestNoticeHours}-hour heads-up, up to ${p.maxGuestNights} nights in a row.` : `Overnight guests are fine with a quick text, up to ${p.maxGuestNights} nights in a row.`;
    case "cleaning":
      return "We rotate kitchen and bathroom cleaning weekly, and dishes get washed the same day.";
    case "kitchen-cookware":
      return "Each of us keeps a labeled shelf of personal cookware and utensils; shared items are washed right after use.";
    case "utilities-expenses":
      return "Utilities are split evenly and paid by the 5th; we flag any unusually high bill.";
    default:
      return null;
  }
}

export interface Verdict {
  ok: boolean;
  reason: string;
}

/** Hard boundaries of the fictional persona. The model can never override a failing verdict. */
export function evaluate(p: Persona, topic: NegotiationTopic, text: string): Verdict {
  const c = constraintsOf(text);
  const no = (reason: string): Verdict => ({ ok: false, reason });
  if (topic === "quiet-hours" && c.quietStart !== null && c.quietStart > p.quietLatest)
    return no(`I'm usually winding down by ${fmtHour(p.quietPreferred)}, so quiet hours that start after ${fmtHour(p.quietLatest)} wouldn't work for me`);
  if (topic === "overnight-guests") {
    if (c.nights !== null && c.nights > p.maxGuestNights) return no(`more than ${p.maxGuestNights} nights in a row is more than I'm comfortable with`);
    if (c.noNotice && p.guestNoticeHours) return no(`I'd need some heads-up before someone stays over`);
  }
  if (topic === "cleaning" && c.vagueCleaning && p.cleaningNeedsSchedule) return no("I do better with a clear schedule than cleaning only when it gets bad");
  if (topic === "kitchen-cookware" && c.shareEverything && p.separateCookware) return no("I'd like to keep my own cookware separate");
  if (topic === "utilities-expenses" && c.unequalSplit && p.equalUtilities) return no("I'd rather split shared bills evenly");
  return { ok: true, reason: "" };
}

// -- topic / proposal detection (fallback and light grounding) ------------------------

const TOPIC_PATTERNS: Array<[NegotiationTopic, RegExp]> = [
  ["overnight-guests", /\b(guests?|overnight|visitors?|sleep(?:s|ing)? over|stay(?:s|ing)? over)\b/],
  ["quiet-hours", /\b(quiet|noise|noisy|loud|music|headphones?)\b/],
  ["cleaning", /\b(clean|cleaning|dish(?:es)?|chores?|tidy|trash|vacuum)\b/],
  ["kitchen-cookware", /\b(kitchen|cookware|pots?|pans?|utensils?|fridge|shelf)\b/],
  ["utilities-expenses", /\b(utilit\w*|bills?|split|rent|expenses?|wifi|internet)\b/],
  ["shared-purchases", /\b(groceries|supplies|toilet paper|shared purchases?)\b/],
  ["shared-bathroom", /\b(bathroom|shower)\b/],
  ["temperature", /\b(thermostat|temperature|heating|a\/c|air conditioning)\b/],
  ["communication", /\b(communicat\w*|check-?ins?|text me)\b/],
  ["conflict-resolution", /\b(conflicts?|disagree\w*|argue|resolve)\b/],
];

export function detectTopic(text: string): NegotiationTopic | null {
  const t = text.toLowerCase();
  return TOPIC_PATTERNS.find(([, re]) => re.test(t))?.[0] ?? null;
}

const PROPOSAL_WORDS = /\b(propose|how about|what if|can we|could we|let'?s|i(?:'d| would) like|i want|we should|i suggest|i(?:'d)? prefer|would you|are you ok|do you mind|okay with|ok with)\b/i;

export function looksLikeProposal(text: string, topic: NegotiationTopic | null): boolean {
  if (!topic) return false;
  const c = constraintsOf(text);
  return PROPOSAL_WORDS.test(text) || c.quietStart !== null || c.nights !== null;
}

export function isSafeText(text: string): boolean {
  return !screenProtectedLanguage(text).flagged && !mentionsProtectedTerm(text) && !detectPromptInjection(text);
}

const REDIRECT = "I'd rather keep this about everyday household habits: noise, cleaning, guests, the kitchen and bills. What would you like to settle first?";

// -- scripted (deterministic) responder ----------------------------------------------

export function scriptedReply(p: Persona, input: JordanTurnInput): JordanReply {
  const base = { topic: null, proposalText: null, counterText: null, overridden: false } as const;
  if (!isSafeText(input.message)) return { ...base, message: REDIRECT, stance: "discuss" };
  const topic = detectTopic(input.message);
  if (!looksLikeProposal(input.message, topic) || !topic) {
    const hint = input.scenario ? `About "${input.scenario.title}": ${input.scenario.friction} I'd like us to find something that works for both of us. What would you propose?` : "Happy to talk it through. Which topic should we start with: quiet hours, cleaning, guests, the kitchen or bills? Tell me what you'd like to propose.";
    return { ...base, message: hint, stance: "discuss", topic };
  }
  const proposalText = input.message.trim().slice(0, 500);
  const v = evaluate(p, topic, proposalText);
  if (v.ok) return { ...base, message: "That works for me. I'm happy to agree to that wording.", stance: "accept", topic, proposalText };
  const counter = counterFor(p, topic);
  return counter
    ? { ...base, message: `I can't quite do that: ${v.reason}. How about this instead? ${counter}`, stance: "counter", topic, proposalText, counterText: counter }
    : { ...base, message: `I'm not comfortable with that, because ${v.reason}.`, stance: "reject", topic, proposalText };
}

// -- model output: validation and deterministic guard --------------------------------

export interface ModelReply {
  message: string;
  stance: Stance;
  topic: NegotiationTopic | null;
  isProposal: boolean;
  proposalText: string | null;
  counterText: string | null;
}

const STANCES: Stance[] = ["accept", "counter", "reject", "discuss"];
const optText = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);

export function parseModelReply(raw: unknown): ModelReply | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const message = optText(r.message, 700);
  if (!message || !STANCES.includes(r.stance as Stance)) return null;
  const topic = r.topic === null || r.topic === undefined ? null : ALL_TOPICS.includes(r.topic as NegotiationTopic) ? (r.topic as NegotiationTopic) : undefined;
  if (topic === undefined) return null;
  return { message, stance: r.stance as Stance, topic, isProposal: r.isProposal === true, proposalText: optText(r.proposalText, 500), counterText: optText(r.counterText, 500) };
}

/** Combine the model's wording with the deterministic constraints. The persona's verdict always wins. */
export function finalizeReply(p: Persona, input: JordanTurnInput, model: ModelReply): JordanReply {
  const fallback = scriptedReply(p, input);
  if (!isSafeText(input.message)) return fallback;
  const messageOk = isSafeText(model.message);
  const topic = model.topic ?? detectTopic(input.message);

  if (!(model.isProposal && topic)) {
    // Not a proposal: only conversation is allowed. A claimed accept/counter/reject has nothing to act on.
    return { message: messageOk ? model.message : fallback.message, stance: "discuss", topic, proposalText: null, counterText: null, overridden: model.stance !== "discuss" };
  }

  const raw = input.message.trim().slice(0, 500);
  const proposalText = model.proposalText && sameConstraints(model.proposalText, raw) ? model.proposalText : raw;
  const violated = !evaluate(p, topic, raw).ok || !evaluate(p, topic, proposalText).ok;
  const counterOk = model.counterText !== null && isSafeText(model.counterText) && evaluate(p, topic, model.counterText).ok;

  if (violated) {
    const counter = counterOk ? model.counterText : counterFor(p, topic);
    const keepModelMessage = messageOk && model.stance !== "accept" && (counter === model.counterText || !counter);
    const reason = evaluate(p, topic, raw).reason || evaluate(p, topic, proposalText).reason;
    return {
      message: keepModelMessage ? model.message : counter ? `I can't quite do that: ${reason}. How about this instead? ${counter}` : `I'm not comfortable with that, because ${reason}.`,
      stance: counter ? "counter" : "reject",
      topic, proposalText, counterText: counter ?? null,
      overridden: model.stance === "accept" || (!!counter && counter !== model.counterText && model.stance === "counter"),
    };
  }
  if (model.stance === "counter" && !counterOk) return { message: messageOk ? model.message : fallback.message, stance: "discuss", topic, proposalText, counterText: null, overridden: true };
  return { message: messageOk ? model.message : fallback.message, stance: model.stance, topic, proposalText, counterText: model.stance === "counter" ? model.counterText : null, overridden: !messageOk };
}

// -- request validation (shared by server and tests) ---------------------------------

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").slice(0, max).trim() : "");

export function parseTurnInput(raw: unknown): JordanTurnInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const personaId = typeof r.personaId === "string" && PERSONAS[r.personaId] ? r.personaId : null;
  const message = clip(r.message, MAX_MESSAGE_CHARS);
  if (!personaId || !message) return null;
  const topics = (v: unknown) => (Array.isArray(v) ? v.filter((t): t is NegotiationTopic => ALL_TOPICS.includes(t as NegotiationTopic)).slice(0, ALL_TOPICS.length) : []);
  const history: ChatTurn[] = (Array.isArray(r.history) ? r.history : [])
    .slice(-MAX_HISTORY)
    .map((h) => ({ role: (h as ChatTurn)?.role === "jordan" ? ("jordan" as const) : ("user" as const), text: clip((h as ChatTurn)?.text, MAX_MESSAGE_CHARS) }))
    .filter((h) => h.text && isSafeText(h.text));
  const sc = r.scenario as Record<string, unknown> | undefined;
  const scenario = sc && SCENARIO_IDS.includes(String(sc.id)) ? { id: String(sc.id), title: clip(sc.title, 120), situation: clip(sc.situation, 400), friction: clip(sc.friction, 400) } : undefined;
  const compatibility = (Array.isArray(r.compatibility) ? r.compatibility : []).slice(0, 6).map((c) => clip(c, 160)).filter(Boolean);
  return { personaId, message, history, openTopics: topics(r.openTopics), scenario, flaggedTopics: topics(r.flaggedTopics), compatibility };
}

/** Strict check of a reply received from the server before the client trusts it. */
export function parseJordanReply(raw: unknown): JordanReply | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const message = optText(r.message, 1200);
  if (!message || !STANCES.includes(r.stance as Stance)) return null;
  const topic = r.topic === null ? null : ALL_TOPICS.includes(r.topic as NegotiationTopic) ? (r.topic as NegotiationTopic) : undefined;
  if (topic === undefined || typeof r.overridden !== "boolean") return null;
  const proposalText = r.proposalText === null ? null : optText(r.proposalText, 500);
  const counterText = r.counterText === null ? null : optText(r.counterText, 500);
  if ((r.proposalText !== null && !proposalText) || (r.counterText !== null && !counterText)) return null;
  if (!isSafeText(message) || (proposalText && !isSafeText(proposalText)) || (counterText && !isSafeText(counterText))) return null;
  return { message, stance: r.stance as Stance, topic, proposalText, counterText, overridden: r.overridden };
}

// -- applying a reply to the deterministic state machine -------------------------------

export interface AppliedTurn {
  session: Session;
  /** Plain-language notes about what the state machine did (or why it could not). */
  notes: string[];
}

/**
 * The only place a fictional roommate's stance becomes a state change. It uses the same transitions a real
 * participant would (propose, approve, reject, edit), so revision checks and per-version approvals still apply.
 * The result is a SIMULATION: nothing here is real consent.
 */
export function applyJordanTurn(session: Session, me: string, jordan: string, reply: JordanReply): AppliedTurn {
  const notes: string[] = [];
  if (!reply.topic || !reply.proposalText) return { session, notes };
  const topic = reply.topic;
  try {
    let s = proposeTerm(session, me, topic, reply.proposalText, session.revision);
    const term = s.terms[s.terms.length - 1];
    notes.push(`Your proposal was added under "${topic.replace(/-/g, " ")}".`);
    if (reply.stance === "accept") {
      s = approveTerm(s, jordan, term.id, term.version, s.revision);
      notes.push("Simulated: Jordan (fictional) accepted it. This is not real consent.");
    } else if (reply.stance === "counter" && reply.counterText) {
      s = editTerm(s, jordan, term.id, reply.counterText, s.revision);
      const edited = s.terms.find((t) => t.id === term.id)!;
      s = approveTerm(s, jordan, edited.id, edited.version, s.revision);
      notes.push("Simulated: Jordan (fictional) countered with new wording. Accept it, edit it, or reject it.");
    } else if (reply.stance === "reject") {
      s = rejectTerm(s, jordan, term.id, s.revision);
      notes.push("Simulated: Jordan (fictional) rejected it.");
    } else {
      s = markDiscussing(s, jordan, term.id, s.revision);
      notes.push("Marked as under discussion.");
    }
    return { session: s, notes };
  } catch (e) {
    const why = e instanceof NegotiationError && e.code === "topic-not-opted-in" ? "That topic isn't open yet. Save it under the topics you're comfortable discussing first." : "That proposal couldn't be added.";
    return { session, notes: [why] };
  }
}

/** Simulated final approval: Jordan "approves" only when everything proposed has been agreed by both. */
export function jordanWouldApproveFinal(session: Session, unresolvedCount: number, agreedCount: number): boolean {
  return session.status === "active" && agreedCount > 0 && unresolvedCount === 0;
}
