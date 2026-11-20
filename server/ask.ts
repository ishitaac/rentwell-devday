import {
  type AskReply,
  type AskRequest,
  type Citation,
  fallbackRoute,
  legalReply,
  matchTopic,
  NOT_INCLUDED_TOPIC,
  notInLeaseReply,
  offTopicReply,
  preRoute,
  quoteOnlyReply,
  resolveLane,
  type RouteDecision,
  UNVERIFIED_LINE,
  whatIfReply,
} from "../src/finePrint/lib/lanes.js";
import type { Clause, TopicStatus } from "../src/finePrint/lib/types.js";
import { canonicalRef, normalizeForMatch, numbersIn } from "../src/finePrint/lib/verify.js";
import { callStructured, models } from "./anthropic.js";
import { ANSWER_SYSTEM, formatClauses, ROUTER_SYSTEM } from "./prompts.js";
import { AnswerSchema, type AnswerOutput, RouterSchema, type RouterOutput } from "./schemas.js";

const MAX_ANSWER_SENTENCES = 3;

async function routeWithModel(question: string, topics: TopicStatus[]): Promise<RouteDecision> {
  const topicList = topics.map((t) => `${t.topic}: ${t.label}`).join("\n");
  const out: RouterOutput = await callStructured({
    model: models.router(),
    system: ROUTER_SYSTEM,
    user: `<topics>\n${topicList}\n</topics>\n<message>\n${question}\n</message>`,
    schema: RouterSchema,
    effort: "low",
    maxTokens: 2_000,
  });
  const known = out.topic && topics.some((t) => t.topic === out.topic) ? out.topic : null;
  return { lane: out.lane, topic: known, whatIf: out.whatIf, ack: out.ack };
}

function firstSentences(text: string, n: number): string {
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  return sentences.slice(0, n).join(" ");
}

/** Every dollar figure in the prose must appear in a cited quote: no model arithmetic. */
function amountsBackedByQuotes(answer: string, citations: Citation[]): boolean {
  const dollars = (answer.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) ?? []).map((d) => Number(d.replace(/[$,\s]/g, "")));
  const quoted = citations.flatMap((c) => numbersIn(normalizeForMatch(c.quote)));
  return dollars.every((d) => quoted.some((q) => Math.abs(q - d) < 0.005));
}

async function answerInLease(question: string, topic: string | null, topics: TopicStatus[], clauses: Clause[]): Promise<AskReply> {
  const out: AnswerOutput = await callStructured({
    model: models.main(),
    system: ANSWER_SYSTEM,
    user: `${formatClauses(clauses)}\n\n<question>\n${question}\n</question>`,
    schema: AnswerSchema,
    effort: "low",
    maxTokens: 4_000,
  });
  if (!out.answer) {
    return topic
      ? quoteOnlyReply(topic, topics, clauses)
      : { ...notInLeaseReply(""), text: "The lease doesn't say. Worth asking before you sign.", addQuestion: question };
  }

  const byId = new Map(clauses.map((c) => [c.id, c]));
  const citations: Citation[] = [];
  for (const ref of out.citations.slice(0, 2)) {
    const verified = canonicalRef(ref, byId);
    if (!verified) return withheld(topic); // any failed quote withholds the whole answer
    citations.push({ ...verified, section: byId.get(ref.clauseId)!.section });
  }
  const text = firstSentences(out.answer, MAX_ANSWER_SENTENCES);
  if (citations.length === 0 || !amountsBackedByQuotes(text, citations)) return withheld(topic);

  return { lane: "IN_LEASE", text, topic, citations, whatIf: null, chips: [], addQuestion: null, source: "model" };
}

function withheld(topic: string | null): AskReply {
  return { lane: "IN_LEASE", text: UNVERIFIED_LINE, topic, citations: [], whatIf: null, chips: [], addQuestion: null, source: "model" };
}

/**
 * One question in, one reply out. Code picks the lane and the template; the model only
 * classifies (router) and, for IN_LEASE, writes up to 3 sentences backed by verified quotes.
 */
export async function answerQuestion({ question, analysis, leaseClauses }: AskRequest): Promise<AskReply> {
  const { topics } = analysis;
  let decision = preRoute(question);
  if (!decision) {
    try {
      decision = await routeWithModel(question, topics);
    } catch {
      decision = fallbackRoute(question);
    }
  }
  if (decision.lane === "IN_LEASE" && !decision.topic) decision = { ...decision, topic: matchTopic(question) };
  if (decision.lane === "LEGAL_JUDGMENT" && !decision.topic) decision = { ...decision, topic: matchTopic(question) };

  const lane = resolveLane(decision, topics);
  switch (lane) {
    case "OFF_TOPIC":
      return offTopicReply(decision.ack);
    case "NOT_IN_LEASE":
      return notInLeaseReply(decision.topic!);
    case "LEGAL_JUDGMENT":
      return legalReply(decision.topic, topics, leaseClauses);
    case "WHAT_IF":
      // Scenario math runs in the browser (costs.ts); the server only returns the change.
      return whatIfReply(decision.whatIf);
    case "IN_LEASE":
      if (decision.topic === NOT_INCLUDED_TOPIC) {
        return { lane, text: "", topic: NOT_INCLUDED_TOPIC, citations: [], whatIf: null, chips: [], addQuestion: null, source: "local" };
      }
      try {
        return await answerInLease(question, decision.topic, topics, leaseClauses);
      } catch {
        return decision.topic ? quoteOnlyReply(decision.topic, topics, leaseClauses) : withheld(null);
      }
  }
}
