import { looksLikeInjection } from "./injection.js";
import type { Clause, Finding, QuoteRef, RentPhase } from "./types";

/**
 * Code-side verification of every model claim. A quote passes only if, after normalizing
 * whitespace, curly quotes and dashes, it appears verbatim inside the clause it cites.
 * A finding also needs every number it claims (amount, percent, per-day, multiple,
 * quantity) to appear in its own quote, so a real quote cannot carry an invented amount.
 */

export const MIN_QUOTE_CHARS = 8;

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

export function normalizeForMatch(text: string): string {
  return text
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes text while remembering, for each normalized character, its index in the
 * original. That lets a match in normalized space map back to an exact original substring.
 */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = normalizeForMatch(text[i]) || " ";
    if (ch === " ") {
      pendingSpace = norm.length > 0;
      continue;
    }
    if (pendingSpace) {
      norm += " ";
      map.push(i - 1);
      pendingSpace = false;
    }
    norm += ch;
    map.push(i);
  }
  return { norm, map };
}

/**
 * Locates a model quote inside clause text. Matching ignores whitespace, curly-quote, dash,
 * and letter-case differences; the result points at the exact original substring, which is
 * what the app displays and highlights. Never the model's own string.
 */
export function findQuote(quote: string, clauseText: string): { start: number; end: number } | null {
  const q = normalizeForMatch(quote).toLowerCase();
  if (q.length < MIN_QUOTE_CHARS || q.includes("...") || q.includes("…")) return null;
  const { norm, map } = normalizeWithMap(clauseText);
  const at = norm.toLowerCase().indexOf(q);
  if (at < 0) return null;
  return { start: map[at], end: map[at + q.length - 1] + 1 };
}

export function quoteInClause(quote: string, clauseText: string): boolean {
  return findQuote(quote, clauseText) !== null;
}

/** The exact lease substring a quote refers to, or null if it is not in the clause. */
export function canonicalQuote(quote: string, clauseText: string): string | null {
  const span = findQuote(quote, clauseText);
  return span ? clauseText.slice(span.start, span.end) : null;
}

/** Every number written in the text, as digits or as a small number word. */
export function numbersIn(text: string): number[] {
  const digits = (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, "")));
  const words = (text.toLowerCase().match(/[a-z]+/g) ?? [])
    .filter((w) => w in NUMBER_WORDS)
    .map((w) => NUMBER_WORDS[w]);
  return [...digits, ...words].filter((n) => Number.isFinite(n));
}

function hasNumber(numbers: number[], target: number): boolean {
  return numbers.some((n) => Math.abs(n - target) < 0.005);
}

/** Returns the ref with its quote replaced by the exact lease text, or null if unverified. */
export function canonicalRef(ref: QuoteRef, clausesById: Map<string, Clause>): QuoteRef | null {
  const clause = clausesById.get(ref.clauseId);
  const quote = clause ? canonicalQuote(ref.quote, clause.text) : null;
  return quote ? { clauseId: ref.clauseId, quote } : null;
}

export function verifyQuoteRef(ref: QuoteRef, clausesById: Map<string, Clause>): boolean {
  return canonicalRef(ref, clausesById) !== null;
}

type Unverified = Omit<Finding, "verified" | "verifyFailure">;

export function verifyFinding(finding: Unverified, clausesById: Map<string, Clause>): Finding {
  const fail = (reason: string): Finding => ({ ...finding, verified: false, verifyFailure: reason });
  const clause = clausesById.get(finding.clauseId);
  if (!clause) return fail(`clause ${finding.clauseId} does not exist`);
  if (looksLikeInjection(clause.text)) return fail("clause contains instructions aimed at software");
  const quote = canonicalQuote(finding.quote, clause.text);
  if (!quote) return fail("quote not found in clause");

  const numbers = numbersIn(normalizeForMatch(quote));
  const claimed: [string, number | null | undefined][] = [
    ["amount", finding.amount],
    ["percent", finding.percent],
    ["perDayAmount", finding.perDayAmount],
    ["rentMultiple", finding.rentMultiple],
    ["quantity", finding.quantity],
  ];
  for (const [field, value] of claimed) {
    if (value !== null && value !== undefined && !hasNumber(numbers, value)) {
      return fail(`${field} ${value} not in quote`);
    }
  }
  return { ...finding, quote, verified: true };
}

/** Returns the phase with its canonical quote, or null if the quote or its numbers fail. */
export function verifyRentPhase(phase: RentPhase, clausesById: Map<string, Clause>): RentPhase | null {
  const ref = canonicalRef(phase, clausesById);
  if (!ref) return null;
  const numbers = numbersIn(normalizeForMatch(ref.quote));
  const ok = [phase.amount, phase.fromMonth, phase.toMonth].every((n) => hasNumber(numbers, n));
  return ok ? { ...phase, quote: ref.quote } : null;
}
