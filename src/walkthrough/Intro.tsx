import { useRef } from "react";
import type { SavedWalkthrough } from "../cloud/walkthroughs";
import { UNIT_TYPES } from "./lib/shots";
import type { UnitType } from "./lib/types";
import type { RentalContext } from "./view";

interface IntroProps {
  rental: RentalContext | null;
  error: string | null;
  onStart: () => void;
  onDemo: () => void;
  onSample: () => void;
  onOpenRecord: (file: File) => void;
  account?: { displayName: string } | null;
  onSignIn?: () => void;
  saved?: SavedWalkthrough[] | null;
  savedError?: string | null;
  openingId?: string | null;
  onOpenSaved?: (saved: SavedWalkthrough) => void;
  onDeleteSaved?: (saved: SavedWalkthrough) => void;
}

function unitLabel(unitType: string): string {
  return UNIT_TYPES[unitType as UnitType]?.label ?? unitType;
}

export function Intro({
  rental,
  error,
  onStart,
  onDemo,
  onSample,
  onOpenRecord,
  account = null,
  onSignIn,
  saved = null,
  savedError = null,
  openingId = null,
  onOpenSaved,
  onDeleteSaved,
}: IntroProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <section className="wt-intro">
      <p className="wt-eyebrow">Walkthrough · Price, paper, place</p>
      <h1>Touring this place? Check what you can see.</h1>
      <p className="wt-lede">Fine Print reads the paper. Walkthrough checks the place.</p>
      {rental && (
        <p className="wt-rental-chip">
          Touring <strong>{rental.name}</strong>
          {rental.rent ? ` · $${rental.rent.toLocaleString()}/mo` : ""}{" "}
          <span>(for display only)</span>
        </p>
      )}
      <div className="wt-disclosure" role="note">
        <strong>Renter observations from photos.</strong> Not an inspection, safety check, or
        verification. Avoid people, personal items, and license plates in your photos.
        <br />
        {account
          ? "Photos are analyzed in memory. They are stored only if you choose Save to my account, privately, and you can delete them any time."
          : "Photos are analyzed in memory and not stored by RentWell. You can save your own copy to your device."}
      </div>
      {error && (
        <p className="wt-alert" role="alert">
          {error}
        </p>
      )}
      <ol className="wt-howto">
        <li>
          <strong>Walk it room by room.</strong> About 6 stops, each with what to look for.
        </li>
        <li>
          <strong>Snap a photo, tap a quick check.</strong> Photos are read while you keep walking.
        </li>
        <li>
          <strong>Leave with your questions.</strong> Plus a copy to keep for move-out.
        </li>
      </ol>
      <div className="wt-actions">
        <button className="wt-btn wt-btn-primary" onClick={onStart}>
          Start the tour
        </button>
        <button className="wt-btn" onClick={onDemo}>
          Try the demo tour
        </button>
        <button className="wt-btn" onClick={onSample}>
          See sample results
        </button>
        <button className="wt-btn wt-btn-ghost" onClick={() => fileInput.current?.click()}>
          Open a saved walkthrough
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onOpenRecord(file);
          }}
        />
      </div>
      {account ? (
        <section className="wt-panel wt-saved" aria-labelledby="wt-saved-title">
          <h2 id="wt-saved-title">Your saved walkthroughs</h2>
          {savedError && <p className="wt-alert">{savedError}</p>}
          {saved === null ? (
            <p className="wt-micro">Loading…</p>
          ) : saved.length === 0 ? (
            <p className="wt-micro">
              None yet. Finish a tour and choose <strong>Save to my account</strong>.
            </p>
          ) : (
            <ul className="wt-saved-list">
              {saved.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.rentalName ?? unitLabel(item.unitType)}</strong>
                    <span className="wt-micro">
                      {new Date(item.recordedAt).toLocaleDateString()} · {unitLabel(item.unitType)}{" "}
                      · {item.photoCount} photo{item.photoCount === 1 ? "" : "s"}
                      {item.isSample ? " · sample" : ""}
                    </span>
                  </div>
                  <div className="wt-saved-actions">
                    <button
                      className="wt-btn"
                      onClick={() => onOpenSaved?.(item)}
                      disabled={openingId !== null}
                    >
                      {openingId === item.id ? "Opening…" : "Open"}
                    </button>
                    <button
                      className="wt-btn wt-btn-ghost"
                      onClick={() => onDeleteSaved?.(item)}
                      aria-label={`Delete saved walkthrough from ${new Date(item.recordedAt).toLocaleDateString()}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="wt-micro">
          Saved walkthroughs open on this device only. Nothing is uploaded.
          {onSignIn && (
            <>
              {" "}
              <button className="wt-link" onClick={onSignIn}>
                Sign in
              </button>{" "}
              to keep them in your account.
            </>
          )}
        </p>
      )}
    </section>
  );
}
