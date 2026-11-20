import sampleLive from "./data/sample-live.json";
import type { ShotAnalysis } from "./lib/types";
import { validatePhotoResult } from "./lib/validate";

/**
 * The offline Sample: a hand-authored apartment walkthrough with illustrated (not real) shots.
 * Always labeled "Sample". If `pnpm cache:walkthrough` has produced real model output from
 * labeled test photos, that is used instead (data/sample-live.json, null by default).
 * Every result still passes through the validator, exactly like a live one.
 */

const svg = (body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${body}<text x="390" y="290" text-anchor="end" font-family="sans-serif" font-size="14" fill="#0f766e" opacity=".8">SAMPLE ILLUSTRATION</text></svg>`,
  )}`;

const ILLUSTRATIONS: Record<string, string> = {
  A1: svg(
    `<rect width="400" height="300" fill="#e9ecef"/><rect x="40" y="20" width="320" height="70" fill="#cfd8dc"/><ellipse cx="200" cy="55" rx="90" ry="22" fill="#9aa5ab"/><rect x="40" y="90" width="320" height="200" fill="#f1e8dc" stroke="#b9a891" stroke-width="4"/><rect x="60" y="110" width="280" height="165" fill="#5d5048"/><path d="M200 110v60h-40v50" stroke="#c7c9cc" stroke-width="14" fill="none"/><path d="M160 220v40" stroke="#c7c9cc" stroke-width="14"/><circle cx="160" cy="228" r="9" fill="#a0673a" opacity=".8"/>`,
  ),
  A2: svg(
    `<rect width="400" height="300" fill="#f4f1ea"/><path d="M0 0h400v90L200 130 0 90z" fill="#fbfaf6"/><path d="M0 90l200 40 200-40" stroke="#d6d0c4" stroke-width="3" fill="none"/><path d="M200 130v170" stroke="#e1dbcf" stroke-width="3"/><rect x="250" y="160" width="110" height="110" fill="#cde3ef" stroke="#fff" stroke-width="8"/><path d="M290 70c30-18 70-6 82 14 10 18-8 30-34 26-20 14-56 10-62-8-8-14 0-26 14-32z" fill="#b08a5a" opacity=".55"/><path d="M300 78c18-8 44-2 52 10" stroke="#8a6a44" stroke-width="3" fill="none" opacity=".5"/>`,
  ),
  A3: svg(
    `<rect width="400" height="300" fill="#e3eef2"/><g stroke="#cbdde4" stroke-width="2">${Array.from({ length: 8 }, (_, i) => `<path d="M0 ${i * 26}h400"/>`).join("")}</g><rect x="20" y="190" width="360" height="100" rx="14" fill="#fff" stroke="#c9d3d8" stroke-width="4"/><path d="M24 192h352" stroke="#c7b48a" stroke-width="6" stroke-dasharray="40 10 12 8"/><circle cx="330" cy="120" r="12" fill="#b0bec5"/>`,
  ),
  A4: svg(
    `<rect width="400" height="300" fill="#f3f0e8"/><rect x="90" y="30" width="220" height="220" fill="#bfe0f2" stroke="#fff" stroke-width="16"/><path d="M200 30v220M90 140h220" stroke="#fff" stroke-width="10"/><rect x="74" y="250" width="252" height="20" fill="#e8e2d6"/>`,
  ),
  A5: svg(
    `<rect width="400" height="300" fill="#efe9df"/><rect y="150" width="400" height="30" fill="#fff" stroke="#d9d2c6" stroke-width="3"/><g fill="#c49a6c">${Array.from({ length: 6 }, (_, i) => `<rect y="${180 + i * 20}" width="400" height="19" opacity="${0.8 + (i % 2) * 0.15}"/>`).join("")}</g><path d="M230 200c20 4 40 2 60-4" stroke="#7b5d3f" stroke-width="5" opacity=".6" fill="none"/>`,
  ),
  A6: svg(
    `<rect width="400" height="300" fill="#15191c"/><rect x="110" y="60" width="120" height="200" fill="#1d2226"/><circle cx="300" cy="80" r="8" fill="#2a3035"/>`,
  ),
};

const SAMPLE_RESULTS: unknown[] = [
  {
    shotId: "A1",
    assessable: true,
    notAssessableReason: null,
    imageQuality: "good",
    observations: [
      {
        category: "water_moisture",
        finding: "concern_visible",
        severity: "follow_up",
        description: "Small rust-colored spot on the drain pipe joint under the sink",
        locationHint: "drain pipe joint at lower left",
        confidence: "medium",
        cannotJudge:
          "Whether the joint leaks when water runs, or the condition behind the back panel",
      },
    ],
  },
  {
    shotId: "A2",
    assessable: true,
    notAssessableReason: null,
    imageQuality: "good",
    observations: [
      {
        category: "walls_ceilings",
        finding: "concern_visible",
        severity: "priority",
        description:
          "Brown staining on the ceiling in the upper right corner, about the size of a dinner plate",
        locationHint: "upper right ceiling corner by the window",
        confidence: "high",
        cannotJudge:
          "Whether moisture is still present above the ceiling, or what caused the staining",
      },
    ],
  },
  {
    shotId: "A3",
    assessable: true,
    notAssessableReason: null,
    imageQuality: "good",
    observations: [
      {
        category: "bathroom_fixtures",
        finding: "concern_visible",
        severity: "follow_up",
        description: "Caulk line along the tub edge looks worn and discolored, with small gaps",
        locationHint: "tub edge along the back wall",
        confidence: "medium",
        cannotJudge: "Whether water gets behind the tub surround",
      },
    ],
  },
  {
    shotId: "A4",
    assessable: true,
    notAssessableReason: null,
    imageQuality: "good",
    observations: [
      {
        category: "windows_doors",
        finding: "no_concern_visible",
        severity: null,
        description: "Window glass, frame, and sill show no visible cracks or peeling",
        locationHint: "whole window",
        confidence: "high",
        cannotJudge: "Whether the window opens, locks, or seals against drafts",
      },
    ],
  },
  {
    shotId: "A5",
    assessable: true,
    notAssessableReason: null,
    imageQuality: "good",
    observations: [
      {
        category: "flooring",
        finding: "concern_visible",
        severity: "priority",
        description:
          "Dark curved mark on the floorboards near the baseboard, possibly a scuff or a scratch",
        locationHint: "floorboards just right of center",
        confidence: "low",
        cannotJudge: "How deep the mark is or whether the board is damaged",
      },
    ],
  },
  {
    shotId: "A6",
    assessable: false,
    notAssessableReason: "photo is too dark to see the appliances",
    imageQuality: "poor",
    observations: [],
  },
];

interface LiveSample {
  results: unknown[];
  photos: Record<string, string>;
}

function validated(results: unknown[]): ShotAnalysis[] {
  return results.flatMap((raw): ShotAnalysis[] => {
    const shotId = (raw as { shotId?: string }).shotId ?? "";
    const outcome = validatePhotoResult(raw, "apartment", shotId);
    return outcome.ok ? [{ shotId, state: "ok", result: outcome.result }] : [];
  });
}

const live = sampleLive as LiveSample | null;

export const SAMPLE = {
  unitType: "apartment" as const,
  rental: { name: "Sample apartment", rent: null },
  analyses: validated(live?.results ?? SAMPLE_RESULTS),
  photos: live?.photos ?? ILLUSTRATIONS,
  notes: { A2: "Agent said the stain is from an old leak that was fixed. (Sample note)" } as Record<
    string,
    string
  >,
  isIllustrated: !live,
};
