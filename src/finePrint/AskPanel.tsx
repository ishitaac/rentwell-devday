import { useState } from "react";
import { askFinePrint } from "./api";
import { rowKeyForTopic } from "./lib/groups";
import {
  applyWhatIf,
  type AskReply,
  fallbackRoute,
  findingCitation,
  legalReply,
  NOT_INCLUDED_TOPIC,
  notIncludedReply,
  notInLeaseReply,
  offTopicReply,
  preRoute,
  quoteOnlyReply,
  resolveLane,
  SUGGESTION_CHIPS,
  whatIfReply,
} from "./lib/lanes";
import type { AnalysisResult, CostScenario, QuoteRef } from "./lib/types";

interface Props {
  analysis: AnalysisResult;
  scenario: CostScenario;
  onScenario: (s: CostScenario) => void;
  onHighlight: (key: string | null) => void;
  onOpenClause: (clauseId: string, refs: QuoteRef[]) => void;
  onAddQuestion: (q: string) => void;
}

const LANE_LABEL: Record<AskReply["lane"], string> = {
  IN_LEASE: "From your lease",
  NOT_IN_LEASE: "Not in this lease",
  LEGAL_JUDGMENT: "Not legal advice",
  WHAT_IF: "What-if",
  OFF_TOPIC: "Off topic",
};

/** Offline path: the same lanes and templates, with quotes instead of model prose. */
function localReply(question: string, analysis: AnalysisResult): AskReply {
  const route = fallbackRoute(question);
  const lane = resolveLane(route, analysis.topics);
  if (lane === "OFF_TOPIC") return offTopicReply(route.ack);
  if (lane === "LEGAL_JUDGMENT") {
    return legalReply(route.topic, analysis.topics, analysis.clauses, findingCitation(question, analysis.findings, analysis.clauses));
  }
  if (lane === "NOT_IN_LEASE") return notInLeaseReply(route.topic!);
  if (lane === "WHAT_IF") return whatIfReply(route.whatIf);
  if (route.topic === NOT_INCLUDED_TOPIC) return notIncludedReply(analysis);
  return quoteOnlyReply(route.topic!, analysis.topics, analysis.clauses);
}

/** "Ask Fine Print": one question in, one answer card out. A new question replaces the last. */
export function AskPanel({ analysis, scenario, onScenario, onHighlight, onOpenClause, onAddQuestion }: Props) {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<AskReply | null>(null);
  const [pending, setPending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const finish = (r: AskReply) => {
    let final = r;
    if (r.lane === "WHAT_IF" && r.whatIf) {
      const result = applyWhatIf(analysis, scenario, r.whatIf);
      onScenario(result.scenario);
      final = { ...r, text: result.message };
    } else if (r.topic === NOT_INCLUDED_TOPIC) {
      final = notIncludedReply(analysis);
    }
    setReply(final);
    setAdded(false);
    const key = final.topic && final.topic !== NOT_INCLUDED_TOPIC ? rowKeyForTopic(analysis, final.topic) : null;
    onHighlight(key);
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setInput("");
    const local = preRoute(q);
    // Lanes that need no model run instantly and work offline.
    if (local && (local.lane !== "IN_LEASE" || local.topic === NOT_INCLUDED_TOPIC)) {
      finish(local.lane === "WHAT_IF" ? whatIfReply(local.whatIf) : localReply(q, analysis));
      return;
    }
    setPending(true);
    try {
      finish(
        await askFinePrint({
          question: q,
          analysis: { topics: analysis.topics, charges: analysis.findings.filter((f) => f.verified).map((f) => ({ id: f.id, label: f.label })) },
          leaseClauses: analysis.clauses,
        }),
      );
    } catch {
      finish(localReply(q, analysis));
    } finally {
      setPending(false);
    }
  };

  const caution = reply && (reply.lane === "LEGAL_JUDGMENT" || reply.lane === "NOT_IN_LEASE" || reply.text.startsWith("I couldn't verify"));

  return (
    <>
      <button className="btn-primary fp-ask-sheet-toggle" onClick={() => setSheetOpen(true)} aria-expanded={sheetOpen} aria-controls="fp-ask">
        Ask Fine Print
      </button>
      <aside className={`fp-ask-panel ${sheetOpen ? "is-open" : ""}`} id="fp-ask" aria-label="Ask Fine Print">
        <section className="fp-ask card">
          <button className="btn-secondary fp-ask-close" onClick={() => setSheetOpen(false)}>Close</button>
          <div>
            <h2>Ask Fine Print</h2>
            <p className="fp-muted">Answers come only from this lease, with the clause quoted.</p>
          </div>
          <div className="fp-chips">
            {SUGGESTION_CHIPS.map((chip) => (
              <button key={chip} className="fp-chip" onClick={() => ask(chip)} disabled={pending}>{chip}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }}>
            <label htmlFor="fp-ask-input" className="fp-sr-only">Your question about the lease</label>
            <input
              id="fp-ask-input"
              type="text"
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Can I sublet in the summer?"
              autoComplete="off"
            />
            <button className="btn-primary" type="submit" disabled={pending || !input.trim()}>{pending ? "Reading..." : "Ask"}</button>
          </form>

          <div aria-live="polite">
            {reply && (
              <article className={`fp-answer ${caution ? "is-caution" : ""}`}>
                {reply.lane !== "OFF_TOPIC" && <span className="fp-lane">{LANE_LABEL[reply.lane]}</span>}
                <p>{reply.text}</p>
                {reply.citations.map((c) => (
                  <blockquote key={`${c.clauseId}-${c.quote}`} className="fp-quote">
                    “{c.quote}”
                    <div className="fp-quote-source">
                      <button className="fp-section-link" onClick={() => onOpenClause(c.clauseId, [c])}>{c.section}</button>
                    </div>
                  </blockquote>
                ))}
                {reply.addQuestion && (
                  <button
                    className="btn-secondary"
                    disabled={added}
                    onClick={() => {
                      onAddQuestion(reply.addQuestion!);
                      setAdded(true);
                    }}
                  >
                    {added ? "Added to landlord questions" : "Add to landlord questions"}
                  </button>
                )}
                {reply.chips.length > 0 && (
                  <div className="fp-chips">
                    <span className="fp-muted">Try:</span>
                    {reply.chips.map((chip) => (
                      <button key={chip} className="fp-chip" onClick={() => ask(chip)}>{chip}</button>
                    ))}
                  </div>
                )}
              </article>
            )}
          </div>
        </section>
      </aside>
    </>
  );
}
