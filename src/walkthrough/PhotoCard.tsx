import { MAX_NOTE_CHARS } from "./lib/session";
import type { Shot } from "./lib/shots";
import type { Observation, Severity, ShotAnalysis } from "./lib/types";

export const SEVERITY_META: Record<Severity, { label: string; icon: string; className: string }> = {
  stop_and_verify: { label: "Stop and verify", icon: "■", className: "is-stop" },
  priority: { label: "Priority", icon: "▲", className: "is-priority" },
  follow_up: { label: "Follow up", icon: "●", className: "is-follow" },
};

export function SeverityChip({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span className={`wt-chip ${meta.className}`}>
      <span aria-hidden="true">{meta.icon}</span> {meta.label}
    </span>
  );
}

function ObservationRow({ observation }: { observation: Observation }) {
  const isConcern = observation.finding === "concern_visible";
  return (
    <li className={`wt-obs${isConcern ? " is-concern" : ""}`}>
      <div className="wt-obs-head">
        {isConcern && observation.severity ? (
          <SeverityChip severity={observation.severity} />
        ) : (
          <span className="wt-chip is-none">
            <span aria-hidden="true">○</span> No concern visible
          </span>
        )}
        <span className="wt-muted">Confidence: {observation.confidence}</span>
      </div>
      <p>
        {isConcern ? "Possible concern in photo: " : ""}
        {observation.description}
        {observation.locationHint ? (
          <span className="wt-muted"> ({observation.locationHint})</span>
        ) : null}
      </p>
      {observation.capNote && <p className="wt-cap-note">{observation.capNote}</p>}
      <p className="wt-cannot">
        <strong>What this photo can't show:</strong> {observation.cannotJudge}
      </p>
    </li>
  );
}

function formatTaken(at: string | null, source: string): string | null {
  if (!at) return null;
  const date = new Date(at);
  const text = Number.isNaN(date.getTime())
    ? at
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return source === "device_exif"
    ? `Photo taken ${text} (from device)`
    : `File date ${text} (from device)`;
}

interface PhotoCardProps {
  shot: Shot;
  analysis: ShotAnalysis | undefined;
  photoUrl: string | undefined;
  taken: { at: string | null; source: string } | undefined;
  note: string;
  editable: boolean;
  onNote: (note: string) => void;
  onRetry?: () => void;
}

export function PhotoCard({
  shot,
  analysis,
  photoUrl,
  taken,
  note,
  editable,
  onNote,
  onRetry,
}: PhotoCardProps) {
  const takenText = taken ? formatTaken(taken.at, taken.source) : null;
  return (
    <article className="wt-card" id={`wt-shot-${shot.id}`}>
      <div className="wt-card-media">
        {photoUrl ? (
          <img src={photoUrl} alt={`Photo: ${shot.label}`} />
        ) : (
          <div className="wt-card-placeholder">No photo</div>
        )}
      </div>
      <div className="wt-card-body">
        <h3>{shot.label}</h3>
        {takenText && <p className="wt-micro">{takenText}</p>}
        {!analysis && <p className="wt-muted">Not analyzed.</p>}
        {analysis?.state === "failed" && (
          <div className="wt-gap-inline">
            <p>
              <strong>Could not analyze</strong> ({analysis.reason}). Counted as not checked.
            </p>
            {onRetry && (
              <button className="wt-btn wt-btn-small" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}
        {analysis?.state === "ok" && !analysis.result.assessable && (
          <p className="wt-gap-inline">
            <strong>Cannot assess:</strong> {analysis.result.notAssessableReason}. Counted as not
            checked; try a closer or brighter photo.
          </p>
        )}
        {analysis?.state === "ok" && analysis.result.assessable && (
          <ul className="wt-obs-list">
            {analysis.result.observations.length === 0 && (
              <li className="wt-muted">Nothing specific noted for this shot.</li>
            )}
            {analysis.result.observations.map((observation, index) => (
              <ObservationRow key={index} observation={observation} />
            ))}
          </ul>
        )}
        {(editable || note) && (
          <label className="wt-note">
            <span>
              Your note <em>(Renter-recorded, unverified)</em>
            </span>
            {editable ? (
              <textarea
                value={note}
                maxLength={MAX_NOTE_CHARS}
                rows={2}
                placeholder="e.g. Agent said this will be repainted by 1/5"
                onChange={(event) => onNote(event.target.value)}
              />
            ) : (
              <p>{note}</p>
            )}
          </label>
        )}
      </div>
    </article>
  );
}
