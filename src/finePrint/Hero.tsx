import { OCCUPANT_CHOICES, roundHalfUpDollars } from "./lib/costs";
import { formatDollars } from "./lib/format";
import type { AnalysisResult, CostScenario, QuoteRef } from "./lib/types";
import { useCountUp } from "./useCountUp";

interface Props {
  analysis: AnalysisResult;
  scenario: CostScenario;
  onScenario: (s: CostScenario) => void;
  onOpenClause: (clauseId: string, refs: QuoteRef[]) => void;
}

function sharesText(shares: number[]): string {
  if (shares.length === 0) return "";
  if (shares.length === 1) return "All yours.";
  if (shares.every((s) => s === shares[0])) return `${formatDollars(shares[0] * 100)} each.`;
  return `${shares.map((s) => formatDollars(s * 100)).join(" / ")} split ${shares.length} ways.`;
}

/** Hero: real monthly cost vs advertised rent, occupants, estimates toggle, rent-step line. */
export function Hero({ analysis, scenario, onScenario, onOpenClause }: Props) {
  const { costs, clauses } = analysis;
  const displayed = costs.displayedMonthlyCents;
  const animated = useCountUp(displayed === null ? 0 : roundHalfUpDollars(displayed));
  const section = (id: string) => clauses.find((c) => c.id === id)?.section ?? id;
  const laterPhase = costs.phases.find((p) => costs.baseRentCents !== null && p.rentCents !== costs.baseRentCents);
  const scheduleClauseId = analysis.rentSchedule[0]?.clauseId;
  const rentConflict = laterPhase ? analysis.conflicts.find((c) => c.clauseIds.includes(scheduleClauseId)) : undefined;
  const conflictOther = rentConflict?.clauseIds.find((id) => id !== scheduleClauseId);
  const overLimit = costs.occupancyLimit && scenario.occupants > costs.occupancyLimit.max ? costs.occupancyLimit : null;
  const excluded = analysis.findings.filter((f) => scenario.excludedFindingIds.includes(f.id));

  if (displayed === null || costs.baseRentCents === null) {
    return (
      <section className="fp-hero card">
        <h1 className="fp-hero-title">Fine Print couldn't find the base rent in this lease.</h1>
        <p className="fp-hero-sub">The charges below are still linked to their clauses. Ask the landlord to confirm the monthly rent.</p>
      </section>
    );
  }

  return (
    <section className="fp-hero card" aria-labelledby="fp-hero-title">
      <h1 id="fp-hero-title" className="fp-hero-title">
        The real cost is <span className="fp-hero-number">${animated.toLocaleString("en-US")}</span> a month.
        {displayed !== costs.baseRentCents && <span className="fp-hero-not"> Not {formatDollars(costs.baseRentCents)}.</span>}
      </h1>
      <span className="fp-sr-only" aria-live="polite">
        Real monthly cost {formatDollars(displayed)}
      </span>

      <div className="fp-occupants">
        <span id="fp-occ-label">People sharing</span>
        <div role="radiogroup" aria-labelledby="fp-occ-label" className="fp-segmented">
          {OCCUPANT_CHOICES.map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={scenario.occupants === n}
              className={scenario.occupants === n ? "is-on" : ""}
              onClick={() => onScenario({ ...scenario, occupants: n })}
            >
              {n}
            </button>
          ))}
        </div>
        <strong className="fp-each">{sharesText(costs.perPersonDollars)}</strong>
      </div>

      {overLimit && (
        <p className="fp-caution" role="status">
          This lease allows {overLimit.max} people max (
          <button className="fp-link" onClick={() => onOpenClause(overLimit.clauseId, [])}>{section(overLimit.clauseId)}</button>
          ). The split is shown anyway.
        </p>
      )}

      <ul className="fp-hero-lines">
        {costs.estimateCents > 0 && (
          <li>
            <label className="fp-toggle">
              <input
                type="checkbox"
                checked={scenario.includeEstimates}
                onChange={(e) => onScenario({ ...scenario, includeEstimates: e.target.checked })}
              />
              <span>
                {scenario.includeEstimates ? "Includes" : "Plus"} about {formatDollars(costs.estimateCents)}/mo estimated utilities.
                {" "}Not a fixed charge.
              </span>
            </label>
          </li>
        )}
        {laterPhase && (
          <li>
            Rises to <strong>{formatDollars(laterPhase.totalCents)}</strong> in months {laterPhase.fromMonth}–{laterPhase.toMonth}
            {" "}(<button className="fp-link" onClick={() => onOpenClause(analysis.rentSchedule[0].clauseId, analysis.rentSchedule)}>
              {section(analysis.rentSchedule[0].clauseId)}
            </button>).
            {rentConflict && conflictOther && (
              <button className="fp-chip fp-chip-amber" onClick={() => onOpenClause(conflictOther, rentConflict.refs)}>
                Conflicts with {section(conflictOther)}
              </button>
            )}
          </li>
        )}
        {costs.unknowns.length > 0 && (
          <li className="fp-muted">
            Not counted because the lease doesn't price them: {costs.unknowns.map((u) => u.label.toLowerCase()).join(", ")}.
          </li>
        )}
        {excluded.length > 0 && (
          <li>
            Leaving out {excluded.map((f) => f.label.toLowerCase()).join(", ")} (what-if).{" "}
            <button className="fp-link" onClick={() => onScenario({ ...scenario, excludedFindingIds: [] })}>Undo</button>
          </li>
        )}
      </ul>
    </section>
  );
}
