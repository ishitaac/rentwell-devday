import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { findShot, UNIT_TYPES } from "./shots.js";
import type { CapturedPhoto } from "./session.js";
import { MAX_NOTE_CHARS } from "./session.js";
import type { PhotoResult, ShotAnalysis, UnitType } from "./types.js";
import { UNIT_TYPE_IDS } from "./types.js";
import { validatePhotoResult } from "./validate.js";

/**
 * A walkthrough record the renter saves to their own device: photos + walkthrough.json in a ZIP.
 * Meant to be reopened at move-out (view-only). Nothing is uploaded or stored by RentWell.
 * Lazy-loaded so fflate only ships when the renter saves or opens a record.
 */

export const RECORD_FORMAT = "rentwell-walkthrough";
export const RECORD_VERSION = 1;
const MAX_RECORD_BYTES = 40 * 1024 * 1024;
const JSON_NAME = "walkthrough.json";

export const RECORD_DISCLAIMER =
  "Renter-made record of a rental tour. Photos were taken by the renter. Observations are possible observations generated from photos, not an inspection, diagnosis, or safety certification. Notes are renter-recorded and unverified.";

export interface RecordShot {
  shotId: string;
  label: string;
  photoFile: string | null;
  photoTakenAt: string | null;
  photoTakenAtSource: CapturedPhoto["takenAtSource"];
  renterNote: string | null;
  analysis: { state: "ok"; result: PhotoResult } | { state: "failed"; reason: string } | null;
}

export interface WalkthroughRecord {
  format: typeof RECORD_FORMAT;
  version: number;
  createdAt: string;
  unitType: UnitType;
  rental: { name: string | null; rent: number | null } | null;
  isSample: boolean;
  disclaimer: string;
  shots: RecordShot[];
}

export interface RecordInput {
  unitType: UnitType;
  photos: Record<string, CapturedPhoto>;
  slots: Record<string, string>;
  notes: Record<string, string>;
  analyses: ShotAnalysis[];
  rental: { name: string | null; rent: number | null } | null;
  isSample: boolean;
  now?: Date;
}

/** An opened record, ready to render. Photos come back as data URLs. */
export interface OpenedRecord {
  record: WalkthroughRecord;
  photoUrls: Record<string, string>;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function buildRecord(input: RecordInput): { record: WalkthroughRecord; zip: Uint8Array } {
  const analyses = new Map(input.analyses.map((entry) => [entry.shotId, entry]));
  const files: Record<string, Uint8Array> = {};
  const config = UNIT_TYPES[input.unitType];
  const shots: RecordShot[] = [...config.required, ...config.optional]
    .filter((shot) => config.required.includes(shot) || input.slots[shot.id])
    .map((shot) => {
      const photo = input.photos[input.slots[shot.id] ?? ""];
      const photoFile = photo ? `photos/${shot.id}.jpg` : null;
      if (photo && photoFile) files[photoFile] = base64ToBytes(photo.base64);
      const analysis = analyses.get(shot.id);
      return {
        shotId: shot.id,
        label: shot.label,
        photoFile,
        photoTakenAt: photo?.takenAt ?? null,
        photoTakenAtSource: photo?.takenAtSource ?? "none",
        renterNote: input.notes[shot.id] ?? null,
        analysis: analysis
          ? analysis.state === "ok"
            ? { state: "ok", result: analysis.result }
            : { state: "failed", reason: analysis.reason }
          : null,
      };
    });

  const record: WalkthroughRecord = {
    format: RECORD_FORMAT,
    version: RECORD_VERSION,
    createdAt: (input.now ?? new Date()).toISOString(),
    unitType: input.unitType,
    rental: input.rental,
    isSample: input.isSample,
    disclaimer: RECORD_DISCLAIMER,
    shots,
  };
  files[JSON_NAME] = strToU8(JSON.stringify(record, null, 2));
  files["README.txt"] = strToU8(
    `RentWell Walkthrough record\nCreated ${record.createdAt}\n\n${RECORD_DISCLAIMER}\n\nOpen walkthrough.json in RentWell (Walkthrough > Open a saved walkthrough) to view it again.\n`,
  );
  // Photos are already JPEG-compressed; store them without recompressing.
  return { record, zip: zipSync(files, { level: 0 }) };
}

export class RecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordError";
  }
}

const optionalString = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.slice(0, max) : null;

function parseShot(
  raw: unknown,
  unitType: UnitType,
  files: Record<string, Uint8Array>,
): [RecordShot, string | null] | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const shotId = typeof data.shotId === "string" ? data.shotId : "";
  const shot = findShot(unitType, shotId);
  if (!shot) return null;

  const photoFile = `photos/${shot.id}.jpg`;
  const photoBytes = files[photoFile];
  const analysisRaw = data.analysis as {
    state?: unknown;
    result?: unknown;
    reason?: unknown;
  } | null;
  let analysis: RecordShot["analysis"] = null;
  if (analysisRaw?.state === "ok") {
    // Imported files are untrusted: every result goes back through the validator.
    const outcome = validatePhotoResult(analysisRaw.result, unitType, shot.id);
    analysis = outcome.ok
      ? { state: "ok", result: outcome.result }
      : { state: "failed", reason: "Saved result could not be read" };
  } else if (analysisRaw?.state === "failed") {
    analysis = {
      state: "failed",
      reason: optionalString(analysisRaw.reason, 120) ?? "Could not analyze",
    };
  }
  const source = data.photoTakenAtSource;
  return [
    {
      shotId: shot.id,
      label: shot.label,
      photoFile: photoBytes ? photoFile : null,
      photoTakenAt: optionalString(data.photoTakenAt, 40),
      photoTakenAtSource: source === "device_exif" || source === "file_date" ? source : "none",
      renterNote: optionalString(data.renterNote, MAX_NOTE_CHARS),
      analysis,
    },
    photoBytes ? `data:image/jpeg;base64,${bytesToBase64(photoBytes)}` : null,
  ];
}

export function openRecord(zipBytes: Uint8Array): OpenedRecord {
  if (zipBytes.byteLength > MAX_RECORD_BYTES)
    throw new RecordError("That file is too large to be a walkthrough record.");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes, {
      filter: (file) => file.name === JSON_NAME || /^photos\/[A-Z0-9]{2,4}\.jpg$/.test(file.name),
    });
  } catch {
    throw new RecordError("That file isn't a walkthrough record (.zip).");
  }
  const jsonBytes = files[JSON_NAME];
  if (!jsonBytes) throw new RecordError("This ZIP has no walkthrough.json.");

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(strFromU8(jsonBytes)) as Record<string, unknown>;
  } catch {
    throw new RecordError("walkthrough.json could not be read.");
  }
  if (data.format !== RECORD_FORMAT)
    throw new RecordError("This isn't a RentWell walkthrough record.");
  const unitType = data.unitType;
  if (typeof unitType !== "string" || !(UNIT_TYPE_IDS as readonly string[]).includes(unitType)) {
    throw new RecordError("The record has an unknown home type.");
  }
  const type = unitType as UnitType;
  const shots: RecordShot[] = [];
  const photoUrls: Record<string, string> = {};
  for (const raw of Array.isArray(data.shots) ? data.shots : []) {
    const parsed = parseShot(raw, type, files);
    if (!parsed) continue;
    shots.push(parsed[0]);
    if (parsed[1]) photoUrls[parsed[0].shotId] = parsed[1];
  }
  const rentalRaw = data.rental as { name?: unknown; rent?: unknown } | null;
  return {
    record: {
      format: RECORD_FORMAT,
      version: typeof data.version === "number" ? data.version : RECORD_VERSION,
      createdAt: optionalString(data.createdAt, 40) ?? "unknown",
      unitType: type,
      rental: rentalRaw
        ? {
            name: optionalString(rentalRaw.name, 120),
            rent: typeof rentalRaw.rent === "number" ? rentalRaw.rent : null,
          }
        : null,
      isSample: data.isSample === true,
      disclaimer: RECORD_DISCLAIMER,
      shots,
    },
    photoUrls,
  };
}

export function recordAnalyses(record: WalkthroughRecord): ShotAnalysis[] {
  return record.shots.flatMap((shot): ShotAnalysis[] => {
    if (!shot.analysis) return [];
    return shot.analysis.state === "ok"
      ? [{ shotId: shot.shotId, state: "ok", result: shot.analysis.result }]
      : [{ shotId: shot.shotId, state: "failed", reason: shot.analysis.reason }];
  });
}

export function recordFileName(record: WalkthroughRecord): string {
  const date = record.createdAt.slice(0, 10);
  return `rentwell-walkthrough-${date}.zip`;
}
