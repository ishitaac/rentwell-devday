import { lineCents, roundHalfUpDollars } from "./costs.js";
import type { CostSummary, Finding } from "./types";

/** Display formatting. The only place cents become rounded dollars for the UI. */

export const NOT_STATED = "Not stated in lease";

export function formatDollars(cents: number): string {
  const negative = cents < 0;
  const dollars = roundHalfUpDollars(Math.abs(cents));
  return `${negative ? "-" : ""}$${dollars.toLocaleString("en-US")}`;
}

export function formatPercent(percent: number): string {
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

export function formatPercentExample(p: CostSummary["percentExamples"][number]): string {
  const perDay = p.perDayCents !== undefined ? ` plus ${formatDollars(p.perDayCents)}/day` : "";
  return `${formatPercent(p.percent)} of base rent: ${formatDollars(p.exampleCents)}${perDay}`;
}

const FREQUENCY_SUFFIX: Record<Finding["frequency"], string> = {
  monthly: "/mo",
  one_time: "",
  per_event: " each time",
  per_day: "/day",
  percent: "",
};

/** The amount shown on a finding's row. Unknown is never shown as $0. */
export function formatFindingAmount(f: Finding, occupants = 1): string {
  if (f.percent !== undefined) return formatPercent(f.percent);
  if (f.rentMultiple !== undefined) return `${f.rentMultiple}× rent`;
  if (typeof f.amount !== "number") return NOT_STATED;
  const total = formatDollars(lineCents(f, occupants)) + FREQUENCY_SUFFIX[f.frequency];
  return f.type === "estimate" ? `about ${total}` : total;
}

/** "$45 × 2 adults" style breakdown for multi-unit charges, or null. */
export function formatUnits(f: Finding, occupants: number): string | null {
  if (typeof f.amount !== "number") return null;
  const parts: string[] = [];
  if (f.quantity !== undefined && f.quantity > 1) parts.push(`× ${f.quantity}`);
  if (f.perPerson) parts.push(`× ${occupants} ${occupants === 1 ? "person" : "people"}`);
  return parts.length > 0 ? `${formatDollars(Math.round(f.amount * 100))} ${parts.join(" ")}` : null;
}

export function formatSection(section: string): string {
  return section;
}
