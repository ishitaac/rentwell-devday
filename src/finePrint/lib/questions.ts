import { topicById } from "./checklist.js";
import type { Clause, CostSummary, Flag, TopicStatus } from "./types";

/** Landlord questions are templated in code (spec §6.7: more reliable than a model call). */

function sections(flag: Flag, byId: Map<string, Clause>): string {
  const labels = flag.clauseIds.map((id) => byId.get(id)?.section).filter(Boolean);
  return labels.length > 0 ? ` (${labels.join(", ")})` : "";
}

export function buildQuestions(input: {
  topics: TopicStatus[];
  conflicts: Flag[];
  clarifications: Flag[];
  unknowns: CostSummary["unknowns"];
  clauses: Clause[];
}): string[] {
  const byId = new Map(input.clauses.map((c) => [c.id, c]));
  const questions = [
    ...input.conflicts.map((c) => `These terms disagree${sections(c, byId)}: ${c.text} Which one applies?`),
    ...input.unknowns.map((u) => `${u.label} isn't priced in the lease. What has it cost for this unit over the last 12 months?`),
    ...input.clarifications.map((c) => `Can you clarify this${sections(c, byId)}? ${c.text}`),
    ...input.topics
      .filter((topic) => topic.status === "not_found")
      .map((topic) => topicById(topic.topic)?.question)
      .filter((q): q is string => Boolean(q)),
  ];
  return [...new Set(questions)];
}

export function questionsAsEmail(questions: string[], propertyName = "the lease"): string {
  const list = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return `Subject: Questions before signing ${propertyName}\n\nHi,\n\nBefore I sign, could you help me with a few questions about ${propertyName}?\n\n${list}\n\nThank you!`;
}
