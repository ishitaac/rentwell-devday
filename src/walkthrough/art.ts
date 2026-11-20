import type { ArtKey } from "./lib/shots";

/**
 * Simple illustrations, one per kind of stop. Used as the "what to frame" example on each tour
 * stop and as the demo tour's sample photo. Always visibly labeled; never presented as a real photo.
 */

const lines = (n: number, gap: number, color: string) =>
  Array.from(
    { length: n },
    (_, i) => `<path d="M0 ${i * gap}h400" stroke="${color}" stroke-width="2"/>`,
  ).join("");

const SCENES: Record<ArtKey, string> = {
  sink: `<rect width="400" height="300" fill="#e9ecef"/><rect x="40" y="20" width="320" height="70" fill="#cfd8dc"/><ellipse cx="200" cy="55" rx="90" ry="22" fill="#9aa5ab"/><rect x="40" y="90" width="320" height="200" fill="#f1e8dc" stroke="#b9a891" stroke-width="4"/><rect x="60" y="110" width="280" height="165" fill="#5d5048"/><path d="M200 110v60h-40v50" stroke="#c7c9cc" stroke-width="14" fill="none"/><path d="M160 220v40" stroke="#c7c9cc" stroke-width="14"/><circle cx="160" cy="228" r="9" fill="#a0673a" opacity=".8"/>`,
  ceiling: `<rect width="400" height="300" fill="#f4f1ea"/><path d="M0 0h400v90L200 130 0 90z" fill="#fbfaf6"/><path d="M0 90l200 40 200-40" stroke="#d6d0c4" stroke-width="3" fill="none"/><path d="M200 130v170" stroke="#e1dbcf" stroke-width="3"/><rect x="250" y="160" width="110" height="110" fill="#cde3ef" stroke="#fff" stroke-width="8"/><path d="M290 40c30-18 70-6 82 14 10 18-8 30-34 26-20 14-56 10-62-8-8-14 0-26 14-32z" fill="#b08a5a" opacity=".55"/>`,
  tub: `<rect width="400" height="300" fill="#e3eef2"/><g>${lines(8, 26, "#cbdde4")}</g><rect x="20" y="190" width="360" height="100" rx="14" fill="#fff" stroke="#c9d3d8" stroke-width="4"/><path d="M24 192h352" stroke="#c7b48a" stroke-width="6" stroke-dasharray="40 10 12 8"/><circle cx="330" cy="120" r="12" fill="#b0bec5"/>`,
  window: `<rect width="400" height="300" fill="#f3f0e8"/><rect x="90" y="30" width="220" height="220" fill="#bfe0f2" stroke="#fff" stroke-width="16"/><path d="M200 30v220M90 140h220" stroke="#fff" stroke-width="10"/><rect x="74" y="250" width="252" height="20" fill="#e8e2d6"/>`,
  floor: `<rect width="400" height="300" fill="#efe9df"/><rect y="150" width="400" height="30" fill="#fff" stroke="#d9d2c6" stroke-width="3"/><g fill="#c49a6c">${Array.from({ length: 6 }, (_, i) => `<rect y="${180 + i * 20}" width="400" height="19" opacity="${0.8 + (i % 2) * 0.15}"/>`).join("")}</g><path d="M230 200c20 4 40 2 60-4" stroke="#7b5d3f" stroke-width="5" opacity=".6" fill="none"/>`,
  appliances: `<rect width="400" height="300" fill="#f3f0e8"/><rect y="230" width="400" height="70" fill="#d8cdbb"/><rect x="50" y="40" width="130" height="240" rx="6" fill="#e9edf0" stroke="#b9c2c8" stroke-width="4"/><path d="M50 130h130" stroke="#b9c2c8" stroke-width="4"/><rect x="160" y="60" width="8" height="50" rx="3" fill="#9aa3a9"/><rect x="220" y="150" width="140" height="130" fill="#e9edf0" stroke="#b9c2c8" stroke-width="4"/><g fill="#5b5b5b"><circle cx="255" cy="165" r="12"/><circle cx="325" cy="165" r="12"/></g><rect x="235" y="195" width="110" height="70" fill="#2f3438"/>`,
  stairs: `<rect width="400" height="300" fill="#f2efe8"/>${Array.from({ length: 6 }, (_, i) => `<rect x="${60 + i * 40}" y="${250 - i * 40}" width="${300 - i * 40}" height="40" fill="${i % 2 ? "#c9a97f" : "#b8966b"}"/>`).join("")}<path d="M50 230L290 30" stroke="#6d5843" stroke-width="8"/>${Array.from({ length: 6 }, (_, i) => `<path d="M${70 + i * 40} ${213 - i * 33}v40" stroke="#6d5843" stroke-width="4"/>`).join("")}`,
  exterior: `<rect width="400" height="300" fill="#dbeaf5"/><path d="M60 120L200 40l140 80z" fill="#6b5b53"/><rect x="80" y="120" width="240" height="150" fill="#e7dccb"/><g>${Array.from({ length: 7 }, (_, i) => `<path d="M80 ${135 + i * 20}h240" stroke="#d3c4ad" stroke-width="2"/>`).join("")}</g><rect x="180" y="190" width="45" height="80" fill="#7a5a3c"/><rect x="100" y="150" width="50" height="40" fill="#bfe0f2"/><rect x="255" y="150" width="50" height="40" fill="#bfe0f2"/><path d="M70 122h120l10 8" stroke="#8d9aa3" stroke-width="6" fill="none"/><rect x="160" y="270" width="85" height="10" fill="#bcb3a5"/><rect y="280" width="400" height="20" fill="#9cc58a"/>`,
  yard: `<rect width="400" height="300" fill="#dbeaf5"/><rect y="150" width="400" height="150" fill="#9cc58a"/><rect x="0" y="80" width="160" height="80" fill="#e7dccb"/><g fill="#c7a77d">${Array.from({ length: 8 }, (_, i) => `<rect x="${200 + i * 25}" y="110" width="14" height="60"/>`).join("")}</g><path d="M200 130h200" stroke="#c7a77d" stroke-width="6"/><ellipse cx="120" cy="210" rx="70" ry="16" fill="#8fb3c9" opacity=".8"/><circle cx="330" cy="80" r="40" fill="#5f8f4e"/><rect x="324" y="110" width="12" height="50" fill="#6d5843"/>`,
  mechanical: `<rect width="400" height="300" fill="#e6e4df"/><rect y="250" width="400" height="50" fill="#cfcac0"/><rect x="90" y="60" width="110" height="195" rx="50" fill="#d9dde0" stroke="#aab2b8" stroke-width="4"/><path d="M145 60V20" stroke="#8d969c" stroke-width="10"/><rect x="240" y="90" width="110" height="165" fill="#c9ced2" stroke="#9aa3a9" stroke-width="4"/><path d="M260 120h70M260 140h70" stroke="#9aa3a9" stroke-width="3"/><ellipse cx="145" cy="258" rx="55" ry="7" fill="#a0673a" opacity=".5"/>`,
  hallway: `<rect width="400" height="300" fill="#efece6"/><path d="M0 0l120 80h160L400 0z" fill="#f8f6f2"/><path d="M0 300l120-90h160l120 90z" fill="#b8a993"/><rect x="120" y="80" width="160" height="130" fill="#dcd5ca"/><rect x="175" y="110" width="50" height="100" fill="#7a5a3c"/><rect x="185" y="88" width="30" height="12" fill="#3c8f4a"/>`,
  outlet: `<rect width="400" height="300" fill="#f1ede6"/><rect x="140" y="70" width="120" height="170" rx="10" fill="#fbfaf7" stroke="#d6d0c4" stroke-width="4"/><g fill="#5b5b5b"><rect x="180" y="105" width="8" height="22"/><rect x="212" y="105" width="8" height="22"/><circle cx="200" cy="140" r="6"/><rect x="180" y="175" width="8" height="22"/><rect x="212" y="175" width="8" height="22"/><circle cx="200" cy="210" r="6"/></g>`,
  garage: `<rect width="400" height="300" fill="#dbeaf5"/><rect x="40" y="70" width="320" height="210" fill="#e7dccb"/><rect x="80" y="110" width="240" height="170" fill="#f4f1ea" stroke="#c9bda9" stroke-width="4"/><g>${Array.from({ length: 6 }, (_, i) => `<path d="M80 ${138 + i * 28}h240" stroke="#d6cbb8" stroke-width="3"/>`).join("")}</g><rect y="280" width="400" height="20" fill="#b9b2a6"/>`,
  anything: `<rect width="400" height="300" fill="#f1ede6"/><rect x="150" y="80" width="100" height="140" rx="10" fill="#fbfaf7" stroke="#d6d0c4" stroke-width="4"/><g fill="#5b5b5b"><rect x="185" y="110" width="7" height="20"/><rect x="208" y="110" width="7" height="20"/><rect x="185" y="165" width="7" height="20"/><rect x="208" y="165" width="7" height="20"/></g><ellipse cx="225" cy="120" rx="26" ry="18" fill="#8a6a44" opacity=".35"/>`,
};

const toDataUrl = (body: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${body}<rect x="250" y="272" width="146" height="24" rx="6" fill="#ffffff" opacity=".85"/><text x="390" y="289" text-anchor="end" font-family="sans-serif" font-size="13" font-weight="700" fill="#0f766e">${label}</text></svg>`,
  )}`;

/** "What to frame" picture for a tour stop. */
export const exampleArt = (key: ArtKey) => toDataUrl(SCENES[key], "EXAMPLE");

/** Stand-in photo for the demo tour and the Sample. */
export const sampleArt = (key: ArtKey) =>
  toDataUrl(key === "appliances" ? DARK_KITCHEN : SCENES[key], "SAMPLE PHOTO");

/** The Sample's "too dark" photo, so the demo shows how a gap looks. */
const DARK_KITCHEN = `<rect width="400" height="300" fill="#15191c"/><rect x="50" y="40" width="130" height="240" fill="#1d2226"/><rect x="220" y="150" width="140" height="130" fill="#20262a"/><circle cx="300" cy="80" r="8" fill="#2a3035"/>`;
