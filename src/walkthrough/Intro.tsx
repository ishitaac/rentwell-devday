import { useRef } from "react";
import { sampleArt } from "./art";
import type { RentalContext } from "./view";

interface IntroProps {
  rental: RentalContext | null;
  error: string | null;
  onStart: () => void;
  onDemo: () => void;
  onSample: () => void;
  onOpenRecord: (file: File) => void;
}

const STEPS: [string, string][] = [
  ["Walk it room by room.", "About 6 stops, each with what to look for."],
  ["Snap a photo, tap a quick check.", "Photos are read while you keep walking."],
  ["Leave with your questions.", "Plus a copy to keep for move-out."],
];

const PREVIEW = [
  { art: "ceiling", label: "▲ Ceiling stain" },
  { art: "sink", label: "● Rust at pipe joint" },
  { art: "window", label: "✓ Nothing flagged" },
  { art: "tub", label: "● Worn caulk" },
] as const;

export function Intro({ rental, error, onStart, onDemo, onSample, onOpenRecord }: IntroProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <section className="wt-intro">
      <div className="wt-intro-text">
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
        <ol className="wt-howto">
          {STEPS.map(([title, body]) => (
            <li key={title}>
              <span>
                <strong>{title}</strong> {body}
              </span>
            </li>
          ))}
        </ol>
        {error && (
          <p className="wt-alert" role="alert">
            {error}
          </p>
        )}
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
        <div className="wt-disclosure" role="note">
          <strong>Renter observations from photos.</strong> Not an inspection, safety check, or
          verification. Avoid people, personal items, and license plates in your photos. Photos are
          analyzed in memory and not stored by RentWell; you choose whether to save a copy.
        </div>
      </div>
      <div className="wt-intro-visual" aria-hidden="true">
        {PREVIEW.map((item) => (
          <figure key={item.art}>
            <img src={sampleArt(item.art)} alt="" />
            <figcaption>{item.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
