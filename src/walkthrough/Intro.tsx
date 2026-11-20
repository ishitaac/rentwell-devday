import { useRef } from "react";
import type { RentalContext } from "./view";

interface IntroProps {
  rental: RentalContext | null;
  error: string | null;
  onStart: () => void;
  onSample: () => void;
  onOpenRecord: (file: File) => void;
}

export function Intro({ rental, error, onStart, onSample, onOpenRecord }: IntroProps) {
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
        Photos are analyzed in memory and not stored by RentWell. You can save your own copy to your
        device.
      </div>
      {error && (
        <p className="wt-alert" role="alert">
          {error}
        </p>
      )}
      <div className="wt-actions">
        <button className="wt-btn wt-btn-primary" onClick={onStart}>
          Start
        </button>
        <button className="wt-btn" onClick={onSample}>
          See a sample
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
      <p className="wt-micro">Saved walkthroughs open on this device only. Nothing is uploaded.</p>
    </section>
  );
}
