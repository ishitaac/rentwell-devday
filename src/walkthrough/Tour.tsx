import { useRef, useState } from "react";
import { exampleArt } from "./art";
import { photoSrc } from "./image";
import type { CaptureState, QuickAnswer } from "./lib/session";
import { MAX_PROMPT_CHARS } from "./lib/session";
import { MISC_SHOTS, UNIT_TYPES, type Shot } from "./lib/shots";

export type ShotStatus = "reading" | "done" | "failed" | "unreadable";

const SKIP_REASONS = ["Locked", "Occupied", "No time", "Not shown to me"];

interface TourProps {
  state: CaptureState;
  stops: Shot[];
  index: number;
  isDemo: boolean;
  status: Record<string, ShotStatus>;
  preparing: boolean;
  error: string | null;
  onPhoto: (shotId: string, file: File, prompt?: string) => void;
  onSamplePhoto: (shotId: string) => void;
  onQuickCheck: (shotId: string, answer: QuickAnswer) => void;
  onSkip: (shotId: string, reason: string) => void;
  onPrompt: (shotId: string, prompt: string) => void;
  onRemove: (shotId: string) => void;
  onGo: (index: number) => void;
  onFinish: () => void;
  onExit: () => void;
}

const STATUS_TEXT: Record<ShotStatus, string> = {
  reading: "Reading…",
  done: "✓ Read",
  failed: "Couldn't read: will show as a gap",
  unreadable: "Can't assess: try a closer, brighter photo",
};

function PhotoButton({
  label,
  onFile,
  primary = true,
}: {
  label: string;
  onFile: (file: File) => void;
  primary?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        className={`wt-btn${primary ? " wt-btn-primary" : ""} wt-btn-wide`}
        onClick={() => input.current?.click()}
      >
        <span aria-hidden="true">📷</span> {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

function QuickCheckRow({
  shot,
  answer,
  onAnswer,
}: {
  shot: Shot;
  answer?: QuickAnswer;
  onAnswer: (a: QuickAnswer) => void;
}) {
  if (!shot.quickCheck) return null;
  const options: [QuickAnswer, string][] = [
    ["yes", "Yes"],
    ["no", "No"],
    ["skip", "Skip"],
  ];
  return (
    <div className="wt-quick" role="group" aria-label={`Quick check: ${shot.quickCheck.question}`}>
      <p>
        <strong>Quick check</strong> <span className="wt-muted">(photo can't show this)</span>
        <br />
        {shot.quickCheck.question}
      </p>
      <div className="wt-quick-buttons">
        {options.map(([value, label]) => (
          <button
            key={value}
            className={`wt-pill${answer === value ? " is-on" : ""}`}
            aria-pressed={answer === value}
            onClick={() => onAnswer(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StopView({ shot, props }: { shot: Shot; props: TourProps }) {
  const [skipping, setSkipping] = useState(false);
  const photo = props.state.photos[props.state.slots[shot.id] ?? ""];
  const status = props.status[shot.id];
  const skipped = props.state.skipped[shot.id];
  return (
    <>
      <figure className="wt-stop-figure">
        <img
          src={photo ? photoSrc(photo) : exampleArt(shot.art)}
          alt={photo ? `Your photo: ${shot.label}` : `Example of what to frame: ${shot.label}`}
        />
        {photo && status && (
          <figcaption className={`wt-stop-status is-${status}`}>{STATUS_TEXT[status]}</figcaption>
        )}
        {!photo && <figcaption className="wt-stop-hint">{shot.hint}</figcaption>}
      </figure>

      <div className="wt-lookfor">
        <strong>Look for</strong>
        <ul>
          {shot.lookFor.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <QuickCheckRow
        shot={shot}
        answer={props.state.quickChecks[shot.id]}
        onAnswer={(a) => props.onQuickCheck(shot.id, a)}
      />

      {skipped && !photo && (
        <p className="wt-skip-note">Skipped: {skipped}. It will show as a gap.</p>
      )}

      <div className="wt-stop-actions">
        <PhotoButton
          label={photo ? "Retake photo" : "Take photo"}
          primary={!photo}
          onFile={(file) => props.onPhoto(shot.id, file)}
        />
        {props.isDemo && !photo && (
          <button className="wt-btn wt-btn-wide" onClick={() => props.onSamplePhoto(shot.id)}>
            Use sample photo (demo)
          </button>
        )}
        {!photo && !skipping && (
          <button className="wt-link" onClick={() => setSkipping(true)}>
            Can't access this?
          </button>
        )}
      </div>
      {skipping && !photo && (
        <div className="wt-skip" role="group" aria-label="Why can't you take this photo?">
          {SKIP_REASONS.map((reason) => (
            <button
              key={reason}
              className={`wt-pill${skipped === reason ? " is-on" : ""}`}
              onClick={() => {
                props.onSkip(shot.id, reason);
                setSkipping(false);
                props.onGo(props.index + 1);
              }}
            >
              {reason}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function AnythingElse({ props }: { props: TourProps }) {
  const taken = MISC_SHOTS.filter((shot) => props.state.slots[shot.id]);
  const next = MISC_SHOTS.find((shot) => !props.state.slots[shot.id]);
  const [draft, setDraft] = useState("");
  return (
    <>
      <p className="wt-lede-small">
        Noticed something we didn't ask about? Snap it and say what caught your eye. You'll get a
        second opinion from the photo, not a verdict.
      </p>
      {taken.length > 0 && (
        <ul className="wt-misc-list">
          {taken.map((shot) => {
            const photo = props.state.photos[props.state.slots[shot.id]];
            const status = props.status[shot.id];
            return (
              <li key={shot.id}>
                <img src={photoSrc(photo)} alt="Your extra photo" />
                <div>
                  <p>{props.state.prompts[shot.id] || <span className="wt-muted">No note</span>}</p>
                  {status && (
                    <span className={`wt-stop-status is-${status}`}>{STATUS_TEXT[status]}</span>
                  )}
                </div>
                <button className="wt-link" onClick={() => props.onRemove(shot.id)}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {next ? (
        <div className="wt-misc-new">
          <label className="wt-note">
            <span>What caught your eye? (optional)</span>
            <input
              type="text"
              value={draft}
              maxLength={MAX_PROMPT_CHARS}
              placeholder="e.g. Is this outlet cover discolored?"
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <PhotoButton
            label={taken.length ? "Add another photo" : "Take photo"}
            primary={false}
            onFile={(file) => {
              props.onPrompt(next.id, draft);
              props.onPhoto(next.id, file, draft);
              setDraft("");
            }}
          />
          {props.isDemo && (
            <button
              className="wt-btn wt-btn-wide"
              onClick={() => {
                props.onPrompt(next.id, draft || "Is this outlet cover discolored?");
                props.onSamplePhoto(next.id);
                setDraft("");
              }}
            >
              Use sample photo (demo)
            </button>
          )}
        </div>
      ) : (
        <p className="wt-muted">That's the limit of three extra photos.</p>
      )}
    </>
  );
}

export function Tour(props: TourProps) {
  const { stops, index, state } = props;
  const shot = stops[index];
  const isLast = index === stops.length - 1;
  const isMisc = MISC_SHOTS.some((m) => m.id === shot.id);
  const config = UNIT_TYPES[state.unitType];

  return (
    <section className="wt-section wt-tour">
      {props.isDemo && (
        <p className="wt-sample-banner" role="note">
          <strong>Demo tour</strong> · tap "Use sample photo" at each stop. Results will be labeled
          Sample.
        </p>
      )}
      <div className="wt-tour-head">
        <p className="wt-eyebrow">
          {config.label} · Stop {index + 1} of {stops.length}
        </p>
        <button className="wt-link" onClick={props.onExit}>
          Already toured? Upload photos
        </button>
      </div>
      <div className="wt-progress-bar" aria-hidden="true">
        {stops.map((stop, i) => (
          <span key={stop.id} className={i < index ? "is-done" : i === index ? "is-current" : ""} />
        ))}
      </div>
      <h2>{isMisc ? "Anything else?" : shot.short}</h2>

      {props.error && (
        <p className="wt-alert" role="alert">
          {props.error}
        </p>
      )}
      {props.preparing && (
        <p className="wt-muted" aria-live="polite">
          Preparing photo…
        </p>
      )}

      {isMisc ? (
        <AnythingElse props={props} />
      ) : (
        <StopView key={shot.id} shot={shot} props={props} />
      )}

      <div className="wt-sticky-bar">
        <button className="wt-btn" onClick={() => props.onGo(index - 1)} disabled={index === 0}>
          Back
        </button>
        {isLast ? (
          <button className="wt-btn wt-btn-primary" onClick={props.onFinish}>
            See results
          </button>
        ) : (
          <button className="wt-btn wt-btn-primary" onClick={() => props.onGo(index + 1)}>
            {state.slots[shot.id] || state.skipped[shot.id] ? "Next stop" : "Skip for now"}
          </button>
        )}
      </div>
    </section>
  );
}
