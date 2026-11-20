import { useState } from "react";
import { formatEmail, formatQuestionList, type LandlordQuestion } from "./lib/questions";
import { findShot } from "./lib/shots";
import type { UnitType } from "./lib/types";

interface QuestionsPanelProps {
  unitType: UnitType;
  unitTypeLabel: string;
  questions: LandlordQuestion[];
  standard: string[];
  rentalName: string | null;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function QuestionsPanel({
  unitType,
  unitTypeLabel,
  questions,
  standard,
  rentalName,
}: QuestionsPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const all = [...questions.map((q) => q.text), ...standard];

  const copy = async (kind: "list" | "email") => {
    const text =
      kind === "list" ? formatQuestionList(all) : formatEmail(all, { rentalName, unitTypeLabel });
    setCopied((await copyText(text)) ? kind : "failed");
    window.setTimeout(() => setCopied(null), 2500);
  };

  return (
    <section className="wt-panel" aria-labelledby="wt-questions-title">
      <div className="wt-panel-head">
        <h2 id="wt-questions-title">Questions for the landlord</h2>
        <div className="wt-panel-actions">
          <button className="wt-btn wt-btn-small" onClick={() => copy("list")}>
            Copy
          </button>
          <button className="wt-btn wt-btn-small" onClick={() => copy("email")}>
            Copy as email
          </button>
        </div>
      </div>
      <p className="wt-muted" aria-live="polite">
        {copied === "failed"
          ? "Copy didn't work in this browser. Select the text instead."
          : copied
            ? "Copied."
            : "Generated from templates, not by AI."}
      </p>
      {questions.length > 0 ? (
        <ol className="wt-questions">
          {questions.map((question) => (
            <li key={question.id}>
              {question.text}
              {question.sourceShotId && (
                <a className="wt-source" href={`#wt-shot-${question.sourceShotId}`}>
                  From photo: {findShot(unitType, question.sourceShotId)?.label}
                </a>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="wt-muted">No questions came from your photos.</p>
      )}
      <h3 className="wt-subhead">Also ask for this type of home</h3>
      <p className="wt-micro">
        Standard questions for this type of home, not findings. Fine Print can check what your lease
        says.
      </p>
      <ol className="wt-questions wt-questions-standard" start={questions.length + 1}>
        {standard.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
      <p className="wt-micro">
        Anything the landlord tells you later is renter-recorded and unverified until it's in
        writing.
      </p>
    </section>
  );
}
