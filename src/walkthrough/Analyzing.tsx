import { findShot } from "./lib/shots";
import type { UnitType } from "./lib/types";

export type ProgressState = "waiting" | "reading" | "done" | "failed";

interface AnalyzingProps {
  unitType: UnitType;
  progress: Record<string, ProgressState>;
  isSample: boolean;
}

const LABEL: Record<ProgressState, string> = {
  waiting: "waiting",
  reading: "reading…",
  done: "done",
  failed: "could not analyze",
};

export function Analyzing({ unitType, progress, isSample }: AnalyzingProps) {
  const entries = Object.entries(progress);
  const finished = entries.filter(([, state]) => state === "done" || state === "failed").length;
  return (
    <section className="wt-section wt-analyzing" aria-live="polite">
      <p className="wt-eyebrow">{isSample ? "Sample walkthrough" : "Reading your photos"}</p>
      <h2>
        Reading {finished} of {entries.length} photos
      </h2>
      <ul className="wt-progress">
        {entries.map(([shotId, state]) => (
          <li key={shotId} className={`is-${state}`}>
            <span className="wt-progress-dot" aria-hidden="true" />
            Reading {findShot(unitType, shotId)?.label.toLowerCase() ?? shotId}…{" "}
            <strong>{LABEL[state]}</strong>
          </li>
        ))}
      </ul>
      <p className="wt-micro">The model describes what it sees. Code decides every severity.</p>
    </section>
  );
}
