import { useState } from "react";
import { formatEmail, formatQuestionList, type LandlordQuestion } from "./lib/questions";

interface QuestionsPanelProps {
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

/** Short lines on screen; Copy and Copy as email use the full wording. */
export function QuestionsPanel({
  unitTypeLabel,
  questions,
  standard,
  rentalName,
}: QuestionsPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showStandard, setShowStandard] = useState(false);
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
        <h2 id="wt-questions-title">Ask the landlord ({questions.length})</h2>
        <div className="wt-panel-actions">
          <button className="wt-btn wt-btn-small" onClick={() => copy("list")}>
            Copy
          </button>
          <button className="wt-btn wt-btn-small" onClick={() => copy("email")}>
            Copy as email
          </button>
        </div>
      </div>
      <p className="wt-micro" aria-live="polite">
        {copied === "failed"
          ? "Copy didn't work in this browser."
          : copied
            ? "Copied, in full sentences."
            : "From templates, not AI. Copy gives full sentences."}
      </p>
      {questions.length > 0 ? (
        <ul className="wt-qlist">
          {questions.map((question) => (
            <li key={question.id}>
              {question.sourceShotId ? (
                <a href={`#wt-shot-${question.sourceShotId}`}>{question.short}</a>
              ) : (
                question.short
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="wt-muted">Nothing from your photos.</p>
      )}
      <button
        className="wt-link"
        onClick={() => setShowStandard((v) => !v)}
        aria-expanded={showStandard}
      >
        {showStandard ? "Hide" : "+"} {standard.length} standard questions for this type of home
      </button>
      {showStandard && (
        <ul className="wt-qlist wt-qlist-standard">
          {standard.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
