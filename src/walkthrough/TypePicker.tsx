import { UNIT_TYPES } from "./lib/shots";
import { UNIT_TYPE_IDS, type UnitType } from "./lib/types";

const ICONS: Record<UnitType, React.ReactNode> = {
  apartment: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3" />
    </>
  ),
  townhome: (
    <>
      <path d="M2 21V10l5-4 5 4 5-4 5 4v11" />
      <path d="M7 21v-5M17 21v-5M12 10v11M2 21h20" />
    </>
  ),
  single_family: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v11h14V10M10 21v-6h4v6" />
    </>
  ),
};

interface TypePickerProps {
  value: UnitType;
  onChange: (unitType: UnitType) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function TypePicker({ value, onChange, onContinue, onBack }: TypePickerProps) {
  return (
    <section className="wt-section">
      <button className="wt-link" onClick={onBack}>
        ← Back
      </button>
      <h2>What kind of place are you touring?</h2>
      <p className="wt-muted">We'll show the right shots.</p>
      <div className="wt-type-grid" role="radiogroup" aria-label="Type of home">
        {UNIT_TYPE_IDS.map((id) => {
          const config = UNIT_TYPES[id];
          const selected = id === value;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={selected}
              className={`wt-type-card${selected ? " is-selected" : ""}`}
              onClick={() => onChange(id)}
            >
              <svg
                viewBox="0 0 24 24"
                width="32"
                height="32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[id]}
              </svg>
              <span className="wt-type-title">{config.label}</span>
              <span className="wt-type-desc">{config.description}</span>
              {selected && <span className="wt-type-check">✓ Selected</span>}
            </button>
          );
        })}
      </div>
      <div className="wt-actions">
        <button className="wt-btn wt-btn-primary" onClick={onContinue}>
          Start the tour
        </button>
      </div>
    </section>
  );
}
