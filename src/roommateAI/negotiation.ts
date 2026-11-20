import { detectPromptInjection, screenProtectedLanguage } from "./compliance";

/**
 * Roommate Negotiator state machine. Pure and storage-agnostic so a server can enforce it.
 *
 * Every transition takes the acting user id and is checked against the session's two participants;
 * approvals are recorded per user and never inferred. Claude never appears here: it may suggest
 * wording elsewhere, but only a participant's explicit action changes state.
 */

export type NegotiationTopic =
  | "quiet-hours"
  | "cleaning"
  | "kitchen-cookware"
  | "overnight-guests"
  | "shared-purchases"
  | "utilities-expenses"
  | "shared-bathroom"
  | "temperature"
  | "communication"
  | "conflict-resolution";

export const TOPIC_LABELS: Record<NegotiationTopic, string> = {
  "quiet-hours": "Quiet hours",
  cleaning: "Cleaning responsibilities",
  "kitchen-cookware": "Kitchen & cookware boundaries",
  "overnight-guests": "Overnight guests",
  "shared-purchases": "Shared purchases",
  "utilities-expenses": "Utilities & household expenses",
  "shared-bathroom": "Shared bathroom expectations",
  temperature: "Household temperature",
  communication: "Communication preferences",
  "conflict-resolution": "Conflict-resolution routines",
};

export const ALL_TOPICS = Object.keys(TOPIC_LABELS) as NegotiationTopic[];

export type TermStatus = "proposed" | "under-discussion" | "accepted-by-one" | "accepted-by-both" | "rejected" | "revised";
export type ConsentState = "pending" | "consented" | "declined" | "withdrawn";
export type SessionStatus = "invited" | "active" | "declined" | "withdrawn" | "finalized";

export type NegotiationErrorCode =
  | "forbidden"
  | "not-found"
  | "conflict"
  | "invalid-state"
  | "invalid-input"
  | "discriminatory-content"
  | "prompt-injection"
  | "no-consent"
  | "topic-not-opted-in";

export class NegotiationError extends Error {
  constructor(readonly code: NegotiationErrorCode, message: string) {
    super(message);
    this.name = "NegotiationError";
  }
}

export interface Term {
  id: string;
  topic: NegotiationTopic;
  text: string;
  version: number;
  proposedBy: string;
  /** Approved version number per participant; null = not approved (or invalidated by an edit). */
  approvals: Record<string, number | null>;
  rejectedBy: string[];
  discussing: boolean;
  revised: boolean;
}

export interface Session {
  id: string;
  participants: [string, string];
  status: SessionStatus;
  consent: Record<string, ConsentState>;
  /** Topics each participant is comfortable discussing. A topic is open only if both opted in. */
  topicOptIn: Record<string, NegotiationTopic[]>;
  terms: Term[];
  /** Monotonic counter for optimistic concurrency. */
  revision: number;
  /** Digest of the summary each participant approved; null until they approve. */
  finalApprovals: Record<string, string | null>;
  nextTermNumber: number;
}

export const MAX_TERM_CHARS = 500;
export const MAX_TERMS = 60;

// -- helpers -----------------------------------------------------------------

function assertParticipant(session: Session, actor: string): void {
  if (!session.participants.includes(actor)) throw new NegotiationError("forbidden", "Not a participant in this session.");
}

function assertActive(session: Session): void {
  if (session.status !== "active") throw new NegotiationError("invalid-state", `Session is ${session.status}.`);
}

function assertRevision(session: Session, expected: number): void {
  if (session.revision !== expected) throw new NegotiationError("conflict", "The session changed. Reload and try again.");
}

function other(session: Session, actor: string): string {
  return session.participants[0] === actor ? session.participants[1] : session.participants[0];
}

function bump(session: Session, patch: Partial<Session>): Session {
  return { ...session, ...patch, revision: session.revision + 1 };
}

function validateText(text: unknown): string {
  if (typeof text !== "string") throw new NegotiationError("invalid-input", "Text is required.");
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TERM_CHARS) throw new NegotiationError("invalid-input", `Text must be 1–${MAX_TERM_CHARS} characters.`);
  if (detectPromptInjection(trimmed)) throw new NegotiationError("prompt-injection", "That text can't be used here.");
  if (screenProtectedLanguage(trimmed).flagged) {
    throw new NegotiationError("discriminatory-content", "Household expectations can't be based on who someone is. Describe the habit or rule you'd like to agree on instead.");
  }
  return trimmed;
}

export function termStatus(term: Term, participants: readonly [string, string]): TermStatus {
  const approved = participants.filter((p) => term.approvals[p] === term.version).length;
  if (term.rejectedBy.length > 0) return "rejected";
  if (approved === 2) return "accepted-by-both";
  if (approved === 1) return "accepted-by-one";
  if (term.revised) return "revised";
  return term.discussing ? "under-discussion" : "proposed";
}

// -- lifecycle -----------------------------------------------------------------

/** The initiator must explicitly consent; the invitee stays "pending" until they respond. */
export function createSession(id: string, initiator: string, invitee: string, initiatorConsents: boolean): Session {
  if (initiator === invitee) throw new NegotiationError("invalid-input", "Choose a different person to invite.");
  if (!initiatorConsents) throw new NegotiationError("no-consent", "You must consent before inviting someone.");
  return {
    id,
    participants: [initiator, invitee],
    status: "invited",
    consent: { [initiator]: "consented", [invitee]: "pending" },
    topicOptIn: { [initiator]: [], [invitee]: [] },
    terms: [],
    revision: 0,
    finalApprovals: { [initiator]: null, [invitee]: null },
    nextTermNumber: 1,
  };
}

export function respondToInvitation(session: Session, actor: string, accept: boolean, expectedRevision: number): Session {
  assertParticipant(session, actor);
  assertRevision(session, expectedRevision);
  if (session.status !== "invited" || session.consent[actor] !== "pending") throw new NegotiationError("invalid-state", "No pending invitation for you.");
  if (!accept) return bump(session, { status: "declined", consent: { ...session.consent, [actor]: "declined" } });
  return bump(session, { status: "active", consent: { ...session.consent, [actor]: "consented" } });
}

export function setTopicOptIn(session: Session, actor: string, topics: NegotiationTopic[], expectedRevision: number): Session {
  assertParticipant(session, actor);
  assertRevision(session, expectedRevision);
  if (session.status !== "invited" && session.status !== "active") throw new NegotiationError("invalid-state", `Session is ${session.status}.`);
  if (session.consent[actor] !== "consented") throw new NegotiationError("no-consent", "Consent is required first.");
  const clean = [...new Set(topics)].filter((t) => ALL_TOPICS.includes(t));
  // Withdrawing a topic closes it: terms on topics no longer open to BOTH people are removed.
  const topicOptIn = { ...session.topicOptIn, [actor]: clean };
  const open = openTopics({ ...session, topicOptIn });
  const terms = session.terms.filter((t) => open.includes(t.topic));
  return bump(session, { topicOptIn, terms, finalApprovals: clearFinal(session) });
}

export function openTopics(session: Session): NegotiationTopic[] {
  const [a, b] = session.participants;
  return session.topicOptIn[a].filter((t) => session.topicOptIn[b].includes(t));
}

export function proposeTerm(session: Session, actor: string, topic: NegotiationTopic, text: string, expectedRevision: number): Session {
  assertParticipant(session, actor);
  assertRevision(session, expectedRevision);
  assertActive(session);
  if (!openTopics(session).includes(topic)) throw new NegotiationError("topic-not-opted-in", "Both people need to opt in to this topic first.");
  if (session.terms.length >= MAX_TERMS) throw new NegotiationError("invalid-input", "Too many terms.");
  const clean = validateText(text);
  const [a, b] = session.participants;
  const term: Term = {
    id: `t${session.nextTermNumber}`,
    topic,
    text: clean,
    version: 1,
    proposedBy: actor,
    approvals: { [a]: null, [b]: null },
    rejectedBy: [],
    discussing: false,
    revised: false,
  };
  return bump(session, { terms: [...session.terms, term], nextTermNumber: session.nextTermNumber + 1, finalApprovals: clearFinal(session) });
}

function updateTerm(session: Session, termId: string, fn: (t: Term) => Term): Session {
  const idx = session.terms.findIndex((t) => t.id === termId);
  if (idx < 0) throw new NegotiationError("not-found", "Term not found.");
  const terms = session.terms.slice();
  terms[idx] = fn(session.terms[idx]);
  return bump(session, { terms, finalApprovals: clearFinal(session) });
}

function clearFinal(session: Session): Record<string, string | null> {
  return { [session.participants[0]]: null, [session.participants[1]]: null };
}

/** Editing a term bumps its version, clears BOTH approvals and any rejection, and marks it revised. */
export function editTerm(session: Session, actor: string, termId: string, text: string, expectedRevision: number): Session {
  assertParticipant(session, actor);
  assertRevision(session, expectedRevision);
  assertActive(session);
  const clean = validateText(text);
  return updateTerm(session, termId, (t) => ({
    ...t,
    text: clean,
    version: t.version + 1,
    approvals: { [session.participants[0]]: null, [session.participants[1]]: null },
    rejectedBy: [],
    revised: true,
  }));
}

/** Approval is bound to the version the user saw; approving a stale version fails. */
export function approveTerm(session: Session, actor: string, termId: string, version: number, expectedRevision: number): Session {
  assertParticipant(session, actor);
  assertRevision(session, expectedRevision);
  assertActive(session);
  return updateTerm(session, termId, (t) => {
    if (t.version !== version) throw new NegotiationError("conflict", "This term was edited. Review the latest version.");
    return { ...t, approvals: { ...t.approvals, [actor]: version }, rejectedBy: t.rejectedBy.filter((p) => p !== actor) };
  });
}

export function rejectTerm(session: Session, actor: string, termId: string, expectedRevision: number): Session {
  assertParticipant(session, actor);
  assertRevision(session, expectedRevision);
  assertActive(session);
  return updateTerm(session, termId, (t) => ({
    ...t,
    approvals: { ...t.approvals, [actor]: null },
    rejectedBy: t.rejectedBy.includes(actor) ? t.rejectedBy : [...t.rejectedBy, actor],
  }));
}

export function markDiscussing(session: Session, actor: string, termId: string, expectedRevision: number): Session {
  assertParticipant(session, actor);
  assertRevision(session, expectedRevision);
  assertActive(session);
  return updateTerm(session, termId, (t) => ({ ...t, discussing: true }));
}

/** Either participant may leave at any time. After this, nothing else changes. */
export function withdraw(session: Session, actor: string): Session {
  assertParticipant(session, actor);
  if (session.status === "withdrawn" || session.status === "declined") return session;
  return bump(session, { status: "withdrawn", consent: { ...session.consent, [actor]: "withdrawn" }, finalApprovals: clearFinal(session) });
}

// -- summary & final approval ----------------------------------------------------

export const HOUSEHOLD_DISCLAIMER =
  "This is a voluntary household discussion summary. It is not a lease, a legal contract, or a substitute for landlord or property approval, and it does not override any law, lease obligation or accommodation right.";

export interface HouseholdSummary {
  title: "Shared Household Expectations";
  date: string;
  participants: Array<{ id: string; name: string }>;
  agreed: Array<{ topic: string; text: string }>;
  unresolved: Array<{ topic: string; text: string; status: TermStatus }>;
  confirmation: Record<string, "approved" | "not-yet-approved">;
  digest: string;
  disclaimer: string;
}

/** FNV-1a 32-bit. A change detector for "what exactly did you approve?", not a security primitive. */
export function digestOf(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function buildSummary(session: Session, names: Record<string, string>, date: string): HouseholdSummary {
  assertParticipant(session, session.participants[0]);
  const agreed = session.terms.filter((t) => termStatus(t, session.participants) === "accepted-by-both").map((t) => ({ topic: TOPIC_LABELS[t.topic], text: t.text }));
  const unresolved = session.terms
    .filter((t) => termStatus(t, session.participants) !== "accepted-by-both")
    .map((t) => ({ topic: TOPIC_LABELS[t.topic], text: t.text, status: termStatus(t, session.participants) }));
  const digest = digestOf(JSON.stringify({ agreed, unresolved: unresolved.map((u) => [u.topic, u.text]) }));
  return {
    title: "Shared Household Expectations",
    date,
    participants: session.participants.map((id) => ({ id, name: names[id] ?? "Participant" })),
    agreed,
    unresolved,
    confirmation: Object.fromEntries(session.participants.map((p) => [p, session.finalApprovals[p] === digest ? "approved" : "not-yet-approved"])) as HouseholdSummary["confirmation"],
    digest,
    disclaimer: HOUSEHOLD_DISCLAIMER,
  };
}

/** Each participant approves the exact summary digest they were shown. Both matching => finalized. */
export function approveFinal(session: Session, actor: string, digest: string, names: Record<string, string>, date: string, expectedRevision: number): Session {
  assertParticipant(session, actor);
  assertRevision(session, expectedRevision);
  assertActive(session);
  const current = buildSummary(session, names, date);
  if (current.agreed.length === 0) throw new NegotiationError("invalid-state", "There is nothing both of you have agreed to yet.");
  if (digest !== current.digest) throw new NegotiationError("conflict", "The summary changed since you reviewed it.");
  const finalApprovals = { ...session.finalApprovals, [actor]: digest };
  const done = session.participants.every((p) => finalApprovals[p] === digest);
  return bump(session, { finalApprovals, status: done ? "finalized" : session.status });
}

// -- access-controlled view & storage ------------------------------------------------

/** Only participants may read a session; everyone else gets "not-found" so existence is not leaked. */
export function viewFor(session: Session | undefined, actor: string): Session {
  if (!session || !session.participants.includes(actor)) throw new NegotiationError("not-found", "Session not found.");
  return session;
}

/**
 * In-memory store with atomic update (single-threaded read-modify-write). For tests and local development only:
 * it is not durable and not shared between processes. A production store must provide an equivalent atomic update
 * (e.g. a database transaction with the same revision check).
 */
export class InMemorySessionStore {
  private sessions = new Map<string, Session>();

  create(session: Session): void {
    if (this.sessions.has(session.id)) throw new NegotiationError("conflict", "Session already exists.");
    this.sessions.set(session.id, session);
  }

  get(id: string, actor: string): Session {
    return viewFor(this.sessions.get(id), actor);
  }

  update(id: string, actor: string, fn: (s: Session) => Session): Session {
    const next = fn(viewFor(this.sessions.get(id), actor));
    this.sessions.set(id, next);
    return next;
  }

  delete(id: string, actor: string): void {
    viewFor(this.sessions.get(id), actor);
    this.sessions.delete(id);
  }
}
