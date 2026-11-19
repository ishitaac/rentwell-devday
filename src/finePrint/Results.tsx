import type { DrawerState } from "./FinePrint";
import { Breakdown } from "./Breakdown";
import { Hero } from "./Hero";
import type { AnalysisResult, CostScenario, QuoteRef } from "./lib/types";
import { QuestionList } from "./QuestionList";

export interface ResultsProps {
  analysis: AnalysisResult;
  notice?: string;
  scenario: CostScenario;
  onScenario: (s: CostScenario) => void;
  highlightKey: string | null;
  onHighlight: (key: string | null) => void;
  drawer: DrawerState | null;
  onDrawer: (d: DrawerState | null) => void;
  addedQuestions: string[];
  onAddQuestion: (q: string) => void;
  onStartOver: () => void;
}

/** State 3: results. Left column = numbers and breakdown; right column = Ask Fine Print. */
export function Results(props: ResultsProps) {
  const { analysis } = props;
  const chargeCount = analysis.findings.filter((f) => f.verified).length;
  const openClause = (clauseId: string, refs: QuoteRef[]) => props.onDrawer({ clauseId, refs });

  return (
    <main className="fp-main">
      <div className="fp-results">
        <div className="fp-left">
          <div className="fp-topline">
            <p className="eyebrow">Fine Print found {chargeCount} charges and terms, each linked to its clause.</p>
            <button className="fp-link" onClick={props.onStartOver}>Read another lease</button>
          </div>
          <p className="fp-disclaimer">
            AI-generated. Not legal advice.{analysis.isFictionalSample ? " Fictional sample." : ""}
            {analysis.meta.unverifiedCount > 0 && (
              <span title="Claims whose quote could not be found in the lease are left out of every total.">
                {" "}· {analysis.meta.unverifiedCount} claim{analysis.meta.unverifiedCount === 1 ? "" : "s"} could not be verified and {analysis.meta.unverifiedCount === 1 ? "was" : "were"} left out.
              </span>
            )}
          </p>
          {props.notice && <p className="fp-alert fp-alert-soft" role="status">{props.notice}</p>}
          <Hero analysis={analysis} scenario={props.scenario} onScenario={props.onScenario} onOpenClause={openClause} />
          <Breakdown
            analysis={analysis}
            highlightKey={props.highlightKey}
            onOpenClause={openClause}
          />
          <QuestionList questions={analysis.questions} added={props.addedQuestions} />
        </div>
      </div>
    </main>
  );
}
