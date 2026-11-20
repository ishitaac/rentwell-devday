import { useMemo } from "react";
import { PhotoCard, SEVERITY_META } from "./PhotoCard";
import { QuestionsPanel } from "./QuestionsPanel";
import { buildQuestions, standardQuestions } from "./lib/questions";
import { allShots, UNIT_TYPES } from "./lib/shots";
import { NO_CONCERNS_LINE, summarize } from "./lib/summarize";
import type { ResultsView } from "./view";

export const SAFETY_LINE =
  "If you smell gas, see smoke, or notice active sparking, leave the area and contact the property representative, your utility, or emergency services.";
export const FOOTER_LINE =
  "Possible observations from photos. Not an inspection, diagnosis, or safety certification. Fair Rent and your costs are unchanged.";

interface ResultsProps {
  view: ResultsView;
  saving: boolean;
  saveMessage: string | null;
  onNote: (shotId: string, note: string) => void;
  onRetry: (shotId: string) => void;
  onSave: () => void;
  onBack: () => void;
  onStartOver: () => void;
}

export function Results({
  view,
  saving,
  saveMessage,
  onNote,
  onRetry,
  onSave,
  onBack,
  onStartOver,
}: ResultsProps) {
  const config = UNIT_TYPES[view.unitType];
  const summary = useMemo(
    () => summarize(view.unitType, view.analyses),
    [view.unitType, view.analyses],
  );
  const questions = useMemo(() => buildQuestions(summary), [summary]);
  const byShot = new Map(view.analyses.map((entry) => [entry.shotId, entry]));
  const shownShots = allShots(view.unitType).filter(
    (shot) => byShot.has(shot.id) || view.photoUrls[shot.id],
  );
  const editable = view.source !== "record";

  return (
    <section className="wt-section wt-results">
      {view.source === "sample" && (
        <p className="wt-sample-banner" role="note">
          <strong>Sample</strong> ·{" "}
          {view.isIllustrated
            ? "Illustrated shots and a saved example result. "
            : "Saved result from labeled test photos. "}
          Not a real rental.
        </p>
      )}
      {view.source === "record" && (
        <p className="wt-sample-banner" role="note">
          <strong>Saved walkthrough</strong> · recorded{" "}
          {view.recordCreatedAt ? new Date(view.recordCreatedAt).toLocaleString() : "earlier"}. View
          only.
        </p>
      )}

      <p className="wt-eyebrow">
        Walkthrough from your photos · {config.label}
        {view.rental?.name ? ` · ${view.rental.name}` : ""}
      </p>
      <h1 className="wt-status">{summary.statusLabel}</h1>
      {summary.showNoConcernsLine && <p className="wt-lede">{NO_CONCERNS_LINE}</p>}

      <dl className="wt-counts">
        {(["stop_and_verify", "priority", "follow_up"] as const).map((severity) => {
          const count =
            severity === "stop_and_verify"
              ? summary.stopAndVerifyCount
              : severity === "priority"
                ? summary.priorityCount
                : summary.followUpCount;
          return (
            <div key={severity} className={`wt-count ${SEVERITY_META[severity].className}`}>
              <dt>
                <span aria-hidden="true">{SEVERITY_META[severity].icon}</span>{" "}
                {SEVERITY_META[severity].label}
              </dt>
              <dd>{count}</dd>
            </div>
          );
        })}
        <div className="wt-count is-gap">
          <dt>Not checked</dt>
          <dd>{summary.notCheckedCount}</dd>
        </div>
      </dl>
      <p className="wt-muted">
        {summary.coverageText}. Coverage describes the photos taken, not the home's quality.
      </p>
      <p className="wt-safety" role="note">
        {SAFETY_LINE}
      </p>

      <div className="wt-results-grid">
        <div className="wt-cards">
          {shownShots.map((shot) => (
            <PhotoCard
              key={shot.id}
              shot={shot}
              analysis={byShot.get(shot.id)}
              photoUrl={view.photoUrls[shot.id]}
              taken={view.takenAt[shot.id]}
              note={view.notes[shot.id] ?? ""}
              editable={editable}
              onNote={(note) => onNote(shot.id, note)}
              onRetry={view.source === "live" ? () => onRetry(shot.id) : undefined}
            />
          ))}
        </div>

        <aside className="wt-side">
          <section className="wt-panel" aria-labelledby="wt-gaps-title">
            <h2 id="wt-gaps-title">Gaps: not taken or not assessable</h2>
            {summary.gaps.length === 0 ? (
              <p className="wt-muted">Every required shot was assessable.</p>
            ) : (
              <ul className="wt-gaps">
                {summary.gaps.map((gap) => (
                  <li key={gap.shotId}>
                    <strong>{gap.label}</strong>
                    <span>{gap.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <QuestionsPanel
            unitType={view.unitType}
            unitTypeLabel={config.label}
            questions={questions}
            standard={standardQuestions(view.unitType)}
            rentalName={view.rental?.name ?? null}
          />

          {view.source !== "record" && (
            <section className="wt-panel">
              <h2>Keep a copy for move-out</h2>
              <p className="wt-muted">
                Saves a ZIP to your device with your photos, the dates they were taken, your notes,
                and these observations. Reopen it at move-out if there's a deposit dispute. RentWell
                doesn't keep a copy.
              </p>
              <button className="wt-btn wt-btn-primary" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save walkthrough (.zip)"}
              </button>
              {saveMessage && (
                <p className="wt-micro" aria-live="polite">
                  {saveMessage}
                </p>
              )}
            </section>
          )}
        </aside>
      </div>

      <div className="wt-actions">
        {view.source === "live" && (
          <button className="wt-btn" onClick={onBack}>
            Back to photos
          </button>
        )}
        <button className="wt-btn wt-btn-ghost" onClick={onStartOver}>
          Start a new walkthrough
        </button>
      </div>
      <footer className="wt-footer">{FOOTER_LINE}</footer>
    </section>
  );
}
