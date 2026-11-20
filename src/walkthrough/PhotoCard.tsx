import { useEffect, useRef } from "react";
import { MAX_NOTE_CHARS, type QuickAnswer } from "./lib/session";
import { isMiscShot, type Shot } from "./lib/shots";
import type { Observation, Severity, ShotAnalysis, Zone } from "./lib/types";

export const SEVERITY_META: Record<Severity, { label: string; icon: string; className: string }> = {
  stop_and_verify: { label: "Stop and verify", icon: "■", className: "is-stop" },
  priority: { label: "Priority", icon: "▲", className: "is-priority" },
  follow_up: { label: "Follow up", icon: "●", className: "is-follow" },
};

const RANK: Record<Severity, number> = { stop_and_verify: 3, priority: 2, follow_up: 1 };

export function topConcern(analysis: ShotAnalysis | undefined): Observation | null {
  if (analysis?.state !== "ok") return null;
  return (
    analysis.result.observations
      .filter((o) => o.finding === "concern_visible" && o.severity)
      .sort((a, b) => RANK[b.severity!] - RANK[a.severity!])[0] ?? null
  );
}

const ZONE_POS: Record<Zone, [number, number]> = {
  top_left: [0, 0],
  top_center: [1, 0],
  top_right: [2, 0],
  middle_left: [0, 1],
  center: [1, 1],
  middle_right: [2, 1],
  bottom_left: [0, 2],
  bottom_center: [1, 2],
  bottom_right: [2, 2],
};

/** Shades one ninth of the photo. Only drawn when code kept the zone (medium or high confidence). */
export function ZoneOverlay({
  observation,
  withCaption,
}: {
  observation: Observation | null;
  withCaption?: boolean;
}) {
  if (!observation?.zone || !observation.severity) return null;
  const [col, row] = ZONE_POS[observation.zone];
  const meta = SEVERITY_META[observation.severity];
  const caption =
    observation.severity === "stop_and_verify"
      ? "Check this area in person before you sign."
      : "Use your eyes on this box 👀";
  return (
    <>
      <span
        className={`wt-zone ${meta.className}`}
        style={{ left: `${col * 33.333}%`, top: `${row * 33.333}%` }}
        aria-hidden="true"
      />
      {withCaption && (
        <span className="wt-zone-caption">
          {caption} <em>(approximate area)</em>
        </span>
      )}
    </>
  );
}

function tileBadge(analysis: ShotAnalysis | undefined, pending: boolean, top: Observation | null) {
  if (pending) return { icon: "…", text: "Reading", className: "is-pending" };
  if (!analysis) return { icon: "○", text: "Not analyzed", className: "is-none" };
  if (analysis.state === "failed") return { icon: "○", text: "Couldn't read", className: "is-gap" };
  if (!analysis.result.assessable) return { icon: "○", text: "Can't assess", className: "is-gap" };
  if (top?.severity) {
    const meta = SEVERITY_META[top.severity];
    return { icon: meta.icon, text: meta.label, className: meta.className };
  }
  return { icon: "✓", text: "Nothing flagged", className: "is-clear" };
}

function tileCaption(analysis: ShotAnalysis | undefined, top: Observation | null): string {
  if (top) return top.headline;
  if (analysis?.state === "ok" && !analysis.result.assessable) return "Retake closer or brighter";
  if (analysis?.state === "failed") return "Shows as a gap";
  return "No concern visible";
}

interface TileProps {
  shot: Shot;
  analysis: ShotAnalysis | undefined;
  pending: boolean;
  photoUrl: string | undefined;
  onOpen: () => void;
}

export function PhotoTile({ shot, analysis, pending, photoUrl, onOpen }: TileProps) {
  const top = topConcern(analysis);
  const badge = tileBadge(analysis, pending, top);
  const extra =
    analysis?.state === "ok"
      ? analysis.result.observations.filter((o) => o.finding === "concern_visible").length - 1
      : 0;
  return (
    <button
      className="wt-tile"
      id={`wt-shot-${shot.id}`}
      onClick={onOpen}
      aria-label={`${shot.short}: ${badge.text}. ${tileCaption(analysis, top)}. Open details`}
    >
      <span className="wt-tile-media">
        {photoUrl ? (
          <img src={photoUrl} alt="" />
        ) : (
          <span className="wt-card-placeholder">No photo</span>
        )}
        <ZoneOverlay observation={top} />
        <span className={`wt-tile-badge ${badge.className}`}>
          <span aria-hidden="true">{badge.icon}</span> {badge.text}
        </span>
      </span>
      <span className="wt-tile-text">
        <strong>{tileCaption(analysis, top)}</strong>
        <span>
          {isMiscShot(shot.id) ? "Anything else" : shot.short}
          {extra > 0 ? ` · +${extra} more` : ""}
        </span>
      </span>
    </button>
  );
}

function formatTaken(at: string | null, source: string): string | null {
  if (!at) return null;
  const date = new Date(at);
  const text = Number.isNaN(date.getTime())
    ? at
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return source === "device_exif"
    ? `Taken ${text} (from device)`
    : `File date ${text} (from device)`;
}

const ANSWER_TEXT: Record<QuickAnswer, string> = { yes: "✓ Yes", no: "✕ No", skip: "– Skipped" };

interface DetailProps {
  shot: Shot;
  analysis: ShotAnalysis | undefined;
  pending: boolean;
  photoUrl: string | undefined;
  taken: { at: string | null; source: string } | undefined;
  note: string;
  quickCheck: QuickAnswer | undefined;
  prompt: string | undefined;
  editable: boolean;
  onNote: (note: string) => void;
  onRetry?: () => void;
  onClose: () => void;
}

export function ShotDetail(props: DetailProps) {
  const { shot, analysis } = props;
  const closeRef = useRef<HTMLButtonElement>(null);
  const top = topConcern(analysis);
  const takenText = props.taken ? formatTaken(props.taken.at, props.taken.source) : null;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]);

  const observations = analysis?.state === "ok" ? analysis.result.observations : [];
  return (
    <div className="wt-sheet-backdrop" onClick={props.onClose}>
      <div
        className="wt-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wt-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wt-sheet-head">
          <h2 id="wt-sheet-title">{isMiscShot(shot.id) ? "Anything else" : shot.short}</h2>
          <button ref={closeRef} className="wt-btn wt-btn-small" onClick={props.onClose}>
            Close
          </button>
        </div>
        <div className="wt-sheet-media">
          {props.photoUrl ? (
            <img src={props.photoUrl} alt={`Photo: ${shot.label}`} />
          ) : (
            <div className="wt-card-placeholder">No photo</div>
          )}
          <ZoneOverlay observation={top} withCaption />
        </div>
        {takenText && <p className="wt-micro">{takenText}</p>}
        {props.prompt && <p className="wt-prompt">You asked: “{props.prompt}”</p>}

        {props.pending && <p className="wt-muted">Still reading this photo…</p>}
        {analysis?.state === "failed" && (
          <div className="wt-gap-inline">
            <p>Couldn't read this photo ({analysis.reason}). Counted as not checked.</p>
            {props.onRetry && (
              <button className="wt-btn wt-btn-small" onClick={props.onRetry}>
                Retry
              </button>
            )}
          </div>
        )}
        {analysis?.state === "ok" && !analysis.result.assessable && (
          <p className="wt-gap-inline">
            Can't assess: {analysis.result.notAssessableReason}. Try a closer or brighter photo.
          </p>
        )}

        {observations.length > 0 && (
          <ul className="wt-points">
            {observations.map((o, i) => (
              <li key={i} className={o.severity ? SEVERITY_META[o.severity].className : "is-clear"}>
                <span aria-hidden="true">{o.severity ? SEVERITY_META[o.severity].icon : "✓"}</span>
                <span>
                  <strong>{o.headline}</strong>
                  {o.severity ? ` · ${SEVERITY_META[o.severity].label}` : ""}
                  {o.locationHint && o.locationHint !== "whole photo" ? (
                    <span className="wt-muted"> · {o.locationHint}</span>
                  ) : null}
                  <span className="wt-cannot">
                    Can't tell from photo: {o.cannotJudge.replace(/\.$/, "")}
                  </span>
                  {o.capNote && <span className="wt-cap-note">{o.capNote}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {shot.quickCheck && props.quickCheck && (
          <p className={`wt-check-line${props.quickCheck === "no" ? " is-no" : ""}`}>
            Your check · {shot.quickCheck.label}: <strong>{ANSWER_TEXT[props.quickCheck]}</strong>
          </p>
        )}

        {observations.length > 0 && (
          <details className="wt-details">
            <summary>Details</summary>
            <ul>
              {observations.map((o, i) => (
                <li key={i}>
                  {o.description} <span className="wt-muted">(confidence: {o.confidence})</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {(props.editable || props.note) && (
          <label className="wt-note">
            <span>
              Your note <em>(Renter-recorded, unverified)</em>
            </span>
            {props.editable ? (
              <textarea
                value={props.note}
                maxLength={MAX_NOTE_CHARS}
                rows={2}
                placeholder="e.g. Agent said this will be repainted by 1/5"
                onChange={(event) => props.onNote(event.target.value)}
              />
            ) : (
              <p>{props.note}</p>
            )}
          </label>
        )}
      </div>
    </div>
  );
}
