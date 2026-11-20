import { useMemo, useState } from "react";
import { buildGroups, type Badge, type Row } from "./lib/groups";
import type { AnalysisResult, QuoteRef } from "./lib/types";

interface Props {
  analysis: AnalysisResult;
  highlightKey: string | null;
  onOpenClause: (clauseId: string, refs: QuoteRef[]) => void;
}

const BADGE_CLASS: Record<Badge, string> = {
  Stated: "is-stated",
  Estimate: "is-estimate",
  Conditional: "is-conditional",
  "Not found": "is-missing",
  "Needs clarification": "is-clarify",
};

function sectionsFor(row: Row, analysis: AnalysisResult) {
  const ids = [...new Set(row.refs.map((r) => r.clauseId))];
  return ids.map((id) => ({ id, label: analysis.clauses.find((c) => c.id === id)?.section ?? id }));
}

/** Grouped breakdown (spec §9): each row has a label, amount, badge, and § link. */
const COLLAPSED_ROWS = 6;

export function Breakdown({ analysis, highlightKey, onOpenClause }: Props) {
  const groups = useMemo(() => buildGroups(analysis), [analysis]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // A highlighted row (from the bar or the Ask panel) must never be hidden in a collapsed group.
  const isOpen = (id: string, rows: Row[]) =>
    expanded.has(id) || rows.length <= COLLAPSED_ROWS + 1 || rows.slice(COLLAPSED_ROWS).some((r) => r.key === highlightKey);

  return (
    <div className="fp-groups">
      {groups.map((group) => (
        <section key={group.id} className="fp-group card" aria-labelledby={`fp-g-${group.id}`}>
          <header className="fp-group-head">
            <div>
              <h2 id={`fp-g-${group.id}`}>{group.title}</h2>
              <p>{group.hint}</p>
            </div>
            {group.subtotals.length > 0 && (
              <dl className="fp-subtotals">
                {group.subtotals.map((s) => (
                  <div key={s.label}>
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </header>
          <ul className="fp-rows" id={`fp-rows-${group.id}`}>
            {(isOpen(group.id, group.rows) ? group.rows : group.rows.slice(0, COLLAPSED_ROWS)).map((row) => (
              <li
                key={row.key}
                data-row={row.key}
                className={`fp-row ${highlightKey === row.key ? "is-highlighted" : ""} ${row.excluded ? "is-excluded" : ""}`}
              >
                <div className="fp-row-main">
                  <span className="fp-row-label">{row.label}</span>
                  {row.detail && <span className="fp-row-detail">{row.detail}</span>}
                </div>
                <div className="fp-row-side">
                  {row.amount && <span className="fp-row-amount">{row.amount}</span>}
                  <span className={`fp-badge ${BADGE_CLASS[row.badge]}`}>{row.badge}</span>
                  {sectionsFor(row, analysis).map((s) => (
                    <button
                      key={s.id}
                      className="fp-section-link"
                      onClick={() => onOpenClause(s.id, row.refs.filter((r) => r.clauseId === s.id))}
                      aria-label={`Show ${s.label} in the lease`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {!isOpen(group.id, group.rows) && (
            <button
              className="fp-link fp-show-all"
              aria-controls={`fp-rows-${group.id}`}
              aria-expanded="false"
              onClick={() => setExpanded((s) => new Set(s).add(group.id))}
            >
              Show all {group.rows.length}
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
