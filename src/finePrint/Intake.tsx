import { useState } from "react";
import { MAX_LEASE_CHARS_CLIENT } from "./limits";

interface Props {
  value: string;
  onChange: (text: string) => void;
  onAnalyze: () => void;
  onSample: () => void;
  error: { code: string; message: string } | null;
}

const ERROR_COPY: Record<string, string> = {
  timeout: "Reading this lease took too long. Try again, or try the sample lease.",
  rate_limited: "Fine Print is busy right now. Give it a minute and try again.",
  no_key: "Live analysis isn't set up on this deployment yet. The sample lease still works.",
  network: "Fine Print couldn't be reached. Check your connection, or try the sample lease.",
};

/** State 1: one front door. Paste box + drop zone, sample button, one line of explanation. */
export function Intake({ value, onChange, onAnalyze, onSample, error }: Props) {
  const [dragging, setDragging] = useState(false);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const tooLong = value.length > MAX_LEASE_CHARS_CLIENT;
  const tooShort = value.trim().length < 50;

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      onChange(await file.text());
      setFileNote(null);
    } else {
      setFileNote("Only plain text works for now. Open the PDF, copy all the text, and paste it here.");
    }
  };

  return (
    <main className="fp-main">
      <section className="fp-intake">
        <p className="eyebrow">Fine Print</p>
        <h1>Know what you pay. Understand what you sign.</h1>
        <p className="fp-lede">
          Paste your lease. Fine Print finds every charge, shows the real monthly cost, and tells you what the lease
          doesn't say, with each claim linked to the exact clause.
        </p>

        {error && (
          <div className="fp-alert" role="alert">
            <strong>We couldn't read that lease.</strong> {ERROR_COPY[error.code] ?? error.message}
          </div>
        )}

        <div
          className={`fp-drop ${dragging ? "is-dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <label htmlFor="fp-lease" className="fp-label">
            Paste your lease text, or drop a .txt file
          </label>
          <textarea
            id="fp-lease"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="RESIDENTIAL LEASE AGREEMENT&#10;&#10;SECTION 1. PREMISES AND TERM&#10;1.1 ..."
            aria-describedby="fp-lease-help"
            spellCheck={false}
          />
          <div className="fp-drop-foot" id="fp-lease-help">
            <span className={tooLong ? "fp-over" : ""}>
              {value.length.toLocaleString()} / {MAX_LEASE_CHARS_CLIENT.toLocaleString()} characters
            </span>
            <span>Not stored by RentWell.</span>
          </div>
          {fileNote && <p className="fp-file-note">{fileNote}</p>}
        </div>

        <div className="fp-intake-actions">
          <button className="btn-primary" onClick={onAnalyze} disabled={tooShort || tooLong}>
            {error ? "Try again" : "Read the fine print"}
          </button>
          <button className="btn-secondary" onClick={onSample}>
            Try the sample lease
          </button>
        </div>
        <p className="fp-micro">AI-generated. Not legal advice. The sample lease is fictional.</p>
      </section>
    </main>
  );
}
