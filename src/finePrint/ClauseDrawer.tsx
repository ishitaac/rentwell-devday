import { useEffect, useRef } from "react";
import type { DrawerState } from "./FinePrint";
import type { Clause } from "./lib/types";
import { findQuote } from "./lib/verify";

interface Props {
  clauses: Clause[];
  state: DrawerState;
  onClose: () => void;
}

const BANNER_LINE = /^\*\*\*.*\*\*\*$/;

/** The sample's test banner is hidden here for display only; the source text keeps it. */
function displayText(clause: Clause): string {
  const lines = clause.text.split("\n");
  if (clause.id === "preamble" && BANNER_LINE.test(lines[0]?.trim() ?? "")) {
    const firstBlankOrHeading = lines.findIndex((l, i) => i > 0 && /^[A-Z][A-Z\s]+$/.test(l.trim()));
    return lines.slice(firstBlankOrHeading > 0 ? firstBlankOrHeading : 1).join("\n");
  }
  return lines.filter((l) => !BANNER_LINE.test(l.trim())).join("\n");
}

/** Splits text into plain and highlighted parts for every quote that is found in it. */
function highlightParts(text: string, quotes: string[]): { text: string; mark: boolean }[] {
  const spans = quotes
    .map((q) => findQuote(q, text))
    .filter((s): s is { start: number; end: number } => s !== null)
    .sort((a, b) => a.start - b.start);
  const parts: { text: string; mark: boolean }[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.end <= cursor) continue;
    const start = Math.max(span.start, cursor);
    if (start > cursor) parts.push({ text: text.slice(cursor, start), mark: false });
    parts.push({ text: text.slice(start, span.end), mark: true });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), mark: false });
  return parts;
}

/** Full lease in a side drawer, scrolled to the clause with the quoted text highlighted. */
export function ClauseDrawer({ clauses, state, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const targetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    targetRef.current?.scrollIntoView({ block: "start" });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [state, onClose]);

  const target = clauses.find((c) => c.id === state.clauseId);

  return (
    <>
      <div className="fp-drawer-backdrop" onClick={onClose} />
      <div className="fp-drawer" role="dialog" aria-modal="true" aria-labelledby="fp-drawer-title">
        <header>
          <h2 id="fp-drawer-title">{target ? `${target.section}${target.heading ? ` · ${target.heading}` : ""}` : "Lease"}</h2>
          <button ref={closeRef} className="fp-drawer-close" onClick={onClose} aria-label="Close lease">
            ×
          </button>
        </header>
        <div className="fp-drawer-body">
          {clauses.map((clause) => {
            const isTarget = clause.id === state.clauseId;
            const text = displayText(clause);
            const quotes = state.refs.filter((r) => r.clauseId === clause.id).map((r) => r.quote);
            return (
              <section
                key={clause.id}
                ref={isTarget ? targetRef : undefined}
                className={`fp-clause ${isTarget ? "is-target" : ""}`}
                aria-current={isTarget ? "true" : undefined}
              >
                <h3>
                  {clause.section}
                  {clause.heading ? ` · ${clause.heading}` : ""}
                </h3>
                <p>
                  {highlightParts(text, quotes).map((part, i) =>
                    part.mark ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
                  )}
                </p>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
