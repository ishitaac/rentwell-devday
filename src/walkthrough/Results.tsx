import { useCallback, useMemo, useState } from "react";
import { PhotoTile, SEVERITY_META, ShotDetail } from "./PhotoCard";
import { QuestionsPanel } from "./QuestionsPanel";
import { buildQuestions, standardQuestions } from "./lib/questions";
import { allShots, findShot, UNIT_TYPES } from "./lib/shots";
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

function Banner({ view }: { view: ResultsView }) {
  if (view.source === "sample") {
    return (
      <p className="wt-sample-banner" role="note">
        <strong>Sample</strong> ·{" "}
        {view.isIllustrated
          ? "illustrated photos and saved example results"
          : "saved results from labeled test photos"}
        . Not a real rental.
      </p>
    );
  }
  if (view.source === "record") {
    return (
      <p className="wt-sample-banner" role="note">
        <strong>Saved walkthrough</strong> · recorded{" "}
        {view.recordCreatedAt ? new Date(view.recordCreatedAt).toLocaleString() : "earlier"}. View
        only.
      </p>
    );
  }
  return null;
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
    () =>
      summarize(view.unitType, view.analyses, {
        skipped: view.skipped,
        quickChecks: view.quickChecks,
      }),
    [view.unitType, view.analyses, view.skipped, view.quickChecks],
  );
  const questions = useMemo(() => buildQuestions(summary), [summary]);
  const [openShot, setOpenShot] = useState<string | null>(null);
  const closeDetail = useCallback(() => setOpenShot(null), []);
  const byShot = new Map(view.analyses.map((entry) => [entry.shotId, entry]));
  const pending = new Set(view.pending);
  const shownShots = allShots(view.unitType).filter(
    (shot) => byShot.has(shot.id) || pending.has(shot.id) || view.photoUrls[shot.id],
  );
  const opened = openShot ? findShot(view.unitType, openShot) : undefined;

  const chips = [
    { key: "stop", ...SEVERITY_META.stop_and_verify, count: summary.stopAndVerifyCount },
    { key: "priority", ...SEVERITY_META.priority, count: summary.priorityCount },
    { key: "follow", ...SEVERITY_META.follow_up, count: summary.followUpCount },
  ].filter((chip) => chip.count > 0);

  return (
    <section className="wt-section wt-results">
      <Banner view={view} />
      <p className="wt-eyebrow">
        Your walkthrough · {config.label}
        {view.rental?.name ? ` · ${view.rental.name}` : ""}
      </p>
      <h1 className="wt-status">{summary.statusLabel}</h1>
      {summary.showNoConcernsLine && <p className="wt-lede">{NO_CONCERNS_LINE}</p>}

      <ul className="wt-chips" aria-label="Counts">
        {chips.map((chip) => (
          <li key={chip.key} className={`wt-chip ${chip.className}`}>
            <span aria-hidden="true">{chip.icon}</span> {chip.count} {chip.label}
          </li>
        ))}
        {summary.renterFlags.length > 0 && (
          <li className="wt-chip is-you">
            <span aria-hidden="true">✋</span> {summary.renterFlags.length} you noticed
          </li>
        )}
        <li className="wt-chip is-none">
          <span aria-hidden="true">○</span> {summary.notCheckedCount} not checked
        </li>
      </ul>
      <p className="wt-micro">
        {summary.coverageText}
        {view.pending.length > 0 ? ` · reading ${view.pending.length} more…` : ""}. Tap a photo for
        details.
      </p>

      <div className="wt-results-grid">
        <div className="wt-tiles">
          {shownShots.map((shot) => (
            <PhotoTile
              key={shot.id}
              shot={shot}
              analysis={byShot.get(shot.id)}
              pending={pending.has(shot.id)}
              photoUrl={view.photoUrls[shot.id]}
              onOpen={() => setOpenShot(shot.id)}
            />
          ))}
        </div>

        <aside className="wt-side">
          {summary.renterFlags.length > 0 && (
            <section className="wt-panel">
              <h2>You noticed</h2>
              <ul className="wt-compact">
                {summary.renterFlags.map((flag) => (
                  <li key={flag.shotId}>
                    <span aria-hidden="true">✕</span> {flag.label}: no
                  </li>
                ))}
              </ul>
              <p className="wt-micro">Your quick checks. Renter-recorded, unverified.</p>
            </section>
          )}

          {summary.gaps.length > 0 && (
            <section className="wt-panel">
              <h2>Gaps ({summary.gaps.length})</h2>
              <ul className="wt-compact">
                {summary.gaps.map((gap) => (
                  <li key={gap.shotId}>
                    <span aria-hidden="true">○</span>{" "}
                    <strong>{findShot(view.unitType, gap.shotId)?.short ?? gap.label}</strong> ·{" "}
                    {gap.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <QuestionsPanel
            unitTypeLabel={config.label}
            questions={questions}
            standard={standardQuestions(view.unitType)}
            rentalName={view.rental?.name ?? null}
          />

          {view.source !== "record" && (
            <section className="wt-panel">
              <h2>Keep a copy for move-out</h2>
              <p className="wt-micro">
                Photos, dates, your notes and checks, in a ZIP on your device. RentWell keeps
                nothing.
              </p>
              <button
                className="wt-btn wt-btn-primary"
                onClick={onSave}
                disabled={saving || view.pending.length > 0}
              >
                {saving
                  ? "Saving…"
                  : view.pending.length > 0
                    ? "Finishing photos…"
                    : "Save walkthrough (.zip)"}
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

      <p className="wt-safety" role="note">
        {SAFETY_LINE}
      </p>
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

      {opened && (
        <ShotDetail
          shot={opened}
          analysis={byShot.get(opened.id)}
          pending={pending.has(opened.id)}
          photoUrl={view.photoUrls[opened.id]}
          taken={view.takenAt[opened.id]}
          note={view.notes[opened.id] ?? ""}
          quickCheck={view.quickChecks[opened.id]}
          prompt={view.prompts[opened.id]}
          editable={view.source !== "record"}
          onNote={(note) => onNote(opened.id, note)}
          onRetry={view.source === "live" ? () => onRetry(opened.id) : undefined}
          onClose={closeDetail}
        />
      )}
    </section>
  );
}
