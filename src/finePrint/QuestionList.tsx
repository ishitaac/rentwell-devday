import { useState } from "react";
import { questionsAsEmail } from "./lib/questions";

interface Props {
  questions: string[];
  added: string[];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** "Build my landlord question list": pick questions, copy as a list or as an email. */
export function QuestionList({ questions, added }: Props) {
  const all = [...added, ...questions.filter((q) => !added.includes(q))];
  const [open, setOpen] = useState(false);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const chosen = all.filter((q) => !unchecked.has(q));

  const copy = async (asEmail: boolean) => {
    const text = asEmail ? questionsAsEmail(chosen) : chosen.map((q, i) => `${i + 1}. ${q}`).join("\n");
    setStatus((await copyText(text)) ? (asEmail ? "Email copied." : "List copied.") : "Couldn't copy. Select the text and copy it instead.");
  };

  if (!open) {
    return (
      <div className="fp-questions-cta">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          Build my landlord question list
        </button>
        <span className="fp-muted">{all.length} questions, from gaps, conflicts and unclear terms.</span>
      </div>
    );
  }

  return (
    <section className="fp-questions card" aria-labelledby="fp-q-title">
      <header className="fp-group-head">
        <div>
          <h2 id="fp-q-title">Questions for your landlord</h2>
          <p>{chosen.length} selected. Uncheck any you don't need.</p>
        </div>
      </header>
      <ol className="fp-q-list">
        {all.map((q) => (
          <li key={q}>
            <label>
              <input
                type="checkbox"
                checked={!unchecked.has(q)}
                onChange={() =>
                  setUnchecked((set) => {
                    const next = new Set(set);
                    if (next.has(q)) next.delete(q);
                    else next.add(q);
                    return next;
                  })
                }
              />
              <span>
                {q}
                {added.includes(q) && <em className="fp-added"> Added from Ask</em>}
              </span>
            </label>
          </li>
        ))}
      </ol>
      <div className="fp-q-actions">
        <button className="btn-primary" onClick={() => copy(false)} disabled={chosen.length === 0}>
          Copy list
        </button>
        <button className="btn-secondary" onClick={() => copy(true)} disabled={chosen.length === 0}>
          Copy as email
        </button>
        <span role="status" className="fp-muted">{status}</span>
      </div>
    </section>
  );
}
