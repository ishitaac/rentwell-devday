import { useRef } from "react";
import { photoSrc } from "./image";
import type { CaptureState } from "./lib/session";
import { UNIT_TYPES, type Shot } from "./lib/shots";

interface CaptureProps {
  state: CaptureState;
  preparing: number;
  error: string | null;
  onPickSlot: (shotId: string, file: File) => void;
  onBulk: (files: File[]) => void;
  onAssign: (photoId: string, shotId: string) => void;
  onClearSlot: (shotId: string) => void;
  onRemoveTray: (photoId: string) => void;
  onChangeType: () => void;
  onBackToTour: () => void;
  onAnalyze: () => void;
}

function Slot({
  shot,
  state,
  onPick,
  onClear,
}: {
  shot: Shot;
  state: CaptureState;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const photo = state.photos[state.slots[shot.id] ?? ""];
  return (
    <li className={`wt-slot${photo ? " has-photo" : ""}`}>
      <div className="wt-slot-thumb">
        {photo ? (
          <img src={photoSrc(photo)} alt={`Your photo: ${shot.label}`} />
        ) : (
          <span aria-hidden="true">{shot.id}</span>
        )}
      </div>
      <div className="wt-slot-body">
        <strong>{shot.label}</strong>
        <span className="wt-muted">{shot.hint}</span>
        <div className="wt-slot-actions">
          <button className="wt-btn wt-btn-small" onClick={() => input.current?.click()}>
            {photo ? "Retake / replace" : "Add photo"}
          </button>
          {photo && (
            <button className="wt-btn wt-btn-small wt-btn-ghost" onClick={onClear}>
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label={`Photo for ${shot.label}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
    </li>
  );
}

export function Capture(props: CaptureProps) {
  const { state } = props;
  const config = UNIT_TYPES[state.unitType];
  const bulkInput = useRef<HTMLInputElement>(null);
  const assignedCount = Object.keys(state.slots).length;
  const requiredDone = config.required.filter((shot) => state.slots[shot.id]).length;
  const allShots = [...config.required, ...config.optional];
  const emptyShots = allShots.filter((shot) => !state.slots[shot.id]);

  return (
    <section className="wt-section">
      <div className="wt-capture-head">
        <div>
          <p className="wt-eyebrow">Shot list · {config.label}</p>
          <h2>Take or upload about 6 photos</h2>
          <p className="wt-muted">
            {requiredDone} of {config.required.length} required shots added. Missing shots are
            listed as gaps, never as passes.
          </p>
        </div>
        <div className="wt-head-links">
          <button className="wt-link" onClick={props.onBackToTour}>
            Back to the guided tour
          </button>
          <button className="wt-link" onClick={props.onChangeType}>
            Change home type
          </button>
        </div>
      </div>

      {props.error && (
        <p className="wt-alert" role="alert">
          {props.error}
        </p>
      )}

      <ol className="wt-slots">
        {config.required.map((shot) => (
          <Slot
            key={shot.id}
            shot={shot}
            state={state}
            onPick={(file) => props.onPickSlot(shot.id, file)}
            onClear={() => props.onClearSlot(shot.id)}
          />
        ))}
      </ol>

      <details className="wt-optional">
        <summary>Add more shots (optional)</summary>
        <ul className="wt-slots">
          {config.optional.map((shot) => (
            <Slot
              key={shot.id}
              shot={shot}
              state={state}
              onPick={(file) => props.onPickSlot(shot.id, file)}
              onClear={() => props.onClearSlot(shot.id)}
            />
          ))}
        </ul>
      </details>

      <div className="wt-tray">
        <div className="wt-tray-head">
          <div>
            <strong>Already took photos?</strong>
            <span className="wt-muted">
              {" "}
              Pick several at once, then choose which shot each one is.
            </span>
          </div>
          <button className="wt-btn wt-btn-small" onClick={() => bulkInput.current?.click()}>
            Pick several photos
          </button>
          <input
            ref={bulkInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length) props.onBulk(files);
            }}
          />
        </div>
        {state.tray.length > 0 && (
          <ul className="wt-tray-list">
            {state.tray.map((photoId) => {
              const photo = state.photos[photoId];
              if (!photo) return null;
              return (
                <li key={photoId} className="wt-tray-item">
                  <img src={photoSrc(photo)} alt={`Unassigned photo ${photo.fileName}`} />
                  <label>
                    <span className="wt-sr-only">This photo is</span>
                    <select
                      value=""
                      onChange={(event) =>
                        event.target.value && props.onAssign(photoId, event.target.value)
                      }
                    >
                      <option value="">This is… choose a shot</option>
                      {allShots.map((shot) => (
                        <option key={shot.id} value={shot.id}>
                          {shot.label}
                          {state.slots[shot.id] ? " (replace)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="wt-link" onClick={() => props.onRemoveTray(photoId)}>
                    Discard
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {state.tray.length > 0 && emptyShots.length > 0 && (
          <p className="wt-micro">Unassigned photos are not analyzed.</p>
        )}
      </div>

      <div className="wt-sticky-bar">
        <span className="wt-muted" aria-live="polite">
          {props.preparing > 0
            ? `Preparing ${props.preparing} photo${props.preparing > 1 ? "s" : ""}…`
            : `${assignedCount} photo${assignedCount === 1 ? "" : "s"} ready`}
        </span>
        <button
          className="wt-btn wt-btn-primary"
          disabled={assignedCount === 0 || props.preparing > 0}
          onClick={props.onAnalyze}
        >
          Analyze photos
        </button>
      </div>
    </section>
  );
}
