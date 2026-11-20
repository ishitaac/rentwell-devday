import { formatDollars } from "./lib/format";
import type { AnalysisResult } from "./lib/types";

interface Props {
  analysis: AnalysisResult;
  highlightKey: string | null;
  onHighlight: (key: string | null) => void;
}

const COLORS = ["#08685f", "#0c8a7d", "#2aa394", "#4fb8aa", "#7ccbbf", "#a6ddd4", "#c9ebe5", "#5e9c95"];
const ESTIMATE_COLOR = "#f5b544";

/** Stacked bar: base rent plus each monthly charge. Hover, focus or tap highlights its row. */
export function CostBar({ analysis, highlightKey, onHighlight }: Props) {
  const { costs, findings } = analysis;
  if (costs.baseRentCents === null || costs.displayedMonthlyCents === null) return null;
  const baseRent = findings.find((f) => f.verified && f.kind === "base_rent");
  const segments = [
    { key: baseRent?.id ?? "rent", label: "Base rent", cents: costs.baseRentCents, color: COLORS[0] },
    ...costs.monthlyLines.map((l, i) => ({ key: l.findingId, label: l.label, cents: l.cents, color: COLORS[(i + 1) % COLORS.length] })),
    ...(costs.scenario.includeEstimates
      ? costs.estimateLines.map((l) => ({ key: l.findingId, label: `${l.label} (estimate)`, cents: l.cents, color: ESTIMATE_COLOR }))
      : []),
  ];
  const total = costs.displayedMonthlyCents;

  return (
    <div className="fp-bar-wrap">
      <div className="fp-bar" role="group" aria-label="What makes up the monthly cost">
        {segments.map((s) => (
          <button
            key={s.key}
            className={highlightKey === s.key ? "is-on" : ""}
            style={{ width: `${(s.cents / total) * 100}%`, background: s.color }}
            aria-label={`${s.label}: ${formatDollars(s.cents)} a month`}
            title={`${s.label}: ${formatDollars(s.cents)}`}
            onMouseEnter={() => onHighlight(s.key)}
            onFocus={() => onHighlight(s.key)}
            onClick={() => onHighlight(s.key)}
          />
        ))}
      </div>
      <div className="fp-bar-legend" aria-hidden="true">
        {segments.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label} {formatDollars(s.cents)}
          </span>
        ))}
      </div>
    </div>
  );
}
