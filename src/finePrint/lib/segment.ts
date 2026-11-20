import type { Clause } from "./types";

/**
 * Splits lease text into clauses with stable ids:
 *   "SECTION 4. ..."  sets the section heading
 *   "4.2 ..."         clause id "s4.2", label "§ 4.2"
 *   "EXHIBIT A. ..."  clause id "exA", label "Exhibit A"
 * Text before the first section (banner, parties) becomes the "preamble" clause; the
 * banner is kept in the source and only hidden at display time. Leases with no numbered
 * structure fall back to one clause per paragraph ("p1", "¶ 1").
 */

const SECTION_RE = /^SECTION\s+(\d+)\.?\s*(.*)$/i;
const CLAUSE_RE = /^(\d+)\.(\d+)\.?\s+(.*)$/;
const EXHIBIT_RE = /^EXHIBIT\s+([A-Z0-9]+)\.?\s*(.*)$/i;
const CONNECTORS = "of|and|or|the|to|in|for|on|&";
const INLINE_HEADING_RE = new RegExp(
  `^([A-Z][A-Za-z'’-]*(?:\\s+(?:[A-Z][A-Za-z'’-]*|${CONNECTORS})){0,4})\\.\\s`,
);
const FICTIONAL_BANNER_RE = /FICTIONAL SAMPLE/i;

interface Draft {
  id: string;
  section: string;
  heading?: string;
  lines: string[];
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function isFictionalSample(text: string): boolean {
  return FICTIONAL_BANNER_RE.test(text.slice(0, 600));
}

export function titleCase(text: string): string {
  const small = new Set(CONNECTORS.split("|"));
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (i > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function isCapsHeading(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return (
    line.length >= 4 &&
    line.length <= 60 &&
    letters.length >= 3 &&
    letters === letters.toUpperCase() &&
    !line.startsWith("*")
  );
}

function slug(text: string): string {
  return text.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function finish(draft: Draft): Clause | null {
  const text = draft.lines.join("\n").replace(/\n{2,}/g, "\n").trim();
  if (!text) return null;
  return draft.heading
    ? { id: draft.id, section: draft.section, heading: draft.heading, text }
    : { id: draft.id, section: draft.section, text };
}

function paragraphs(text: string): Clause[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => ({ id: `p${i + 1}`, section: `¶ ${i + 1}`, text: p }));
}

export function segmentLease(raw: string): Clause[] {
  const text = normalizeNewlines(raw);
  const lines = text.split("\n");
  const hasStructure = lines.some((l) => SECTION_RE.test(l.trim()) || CLAUSE_RE.test(l.trim()));
  if (!hasStructure) return paragraphs(text);

  const clauses: Clause[] = [];
  let current: Draft = { id: "preamble", section: "Preamble", lines: [] };
  let sectionHeading: string | undefined;
  let seenSection = false;

  const flush = (next: Draft) => {
    const done = finish(current);
    if (done) clauses.push(done);
    current = next;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const section = line.match(SECTION_RE);
    const clause = line.match(CLAUSE_RE);
    const exhibit = line.match(EXHIBIT_RE);

    if (section) {
      seenSection = true;
      sectionHeading = section[2] ? titleCase(section[2]) : undefined;
      flush({ id: `s${section[1]}`, section: `§ ${section[1]}`, heading: sectionHeading, lines: [] });
    } else if (clause) {
      const body = clause[3];
      const inline = body.match(INLINE_HEADING_RE);
      flush({
        id: `s${clause[1]}.${clause[2]}`,
        section: `§ ${clause[1]}.${clause[2]}`,
        heading: inline ? inline[1] : sectionHeading,
        lines: [body],
      });
    } else if (exhibit) {
      flush({
        id: `ex${exhibit[1].toUpperCase()}`,
        section: `Exhibit ${exhibit[1].toUpperCase()}`,
        heading: exhibit[2] ? titleCase(exhibit[2]) : undefined,
        lines: [],
      });
    } else if (seenSection && isCapsHeading(line)) {
      flush({ id: slug(line) || `h${clauses.length}`, section: titleCase(line), lines: [] });
    } else {
      current.lines.push(line);
    }
  }
  flush({ id: "", section: "", lines: [] });
  return dedupeIds(clauses);
}

function dedupeIds(clauses: Clause[]): Clause[] {
  const seen = new Map<string, number>();
  return clauses.map((c) => {
    const count = seen.get(c.id) ?? 0;
    seen.set(c.id, count + 1);
    return count === 0 ? c : { ...c, id: `${c.id}-${count + 1}` };
  });
}
