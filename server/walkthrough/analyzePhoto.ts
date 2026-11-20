import { findShot, UNIT_TYPES } from "../../src/walkthrough/lib/shots.js";
import type { PhotoRequest, PhotoResult } from "../../src/walkthrough/lib/types.js";
import { UNIT_TYPE_IDS } from "../../src/walkthrough/lib/types.js";
import { validatePhotoResult } from "../../src/walkthrough/lib/validate.js";
import { ModelError } from "../anthropic.js";
import { buildUserText, PhotoOutputSchema, SYSTEM_PROMPT } from "./prompt.js";
import { callVision, type VisionFn } from "./vision.js";

/** Analyze one photo: model call, then code validation. One retry if the model used a banned word. */

export const PHOTO_BUDGET_MS = 24_000;
const MIN_RETRY_MS = 6_000;
/** About 3 MB of JPEG; the browser sends ~1 MB. Keeps us well under the platform body limit. */
export const MAX_IMAGE_BASE64_CHARS = 4_000_000;

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export function parsePhotoRequest(body: unknown): PhotoRequest {
  if (!body || typeof body !== "object")
    throw new InputError("Send JSON with unitType, shotId, and imageBase64.");
  const { unitType, shotId, imageBase64 } = body as Record<string, unknown>;
  if (typeof unitType !== "string" || !(UNIT_TYPE_IDS as readonly string[]).includes(unitType)) {
    throw new InputError("Unknown home type.");
  }
  const type = unitType as PhotoRequest["unitType"];
  if (typeof shotId !== "string" || !findShot(type, shotId))
    throw new InputError("Unknown shot for this home type.");
  if (typeof imageBase64 !== "string" || imageBase64.length < 100)
    throw new InputError("Missing photo.");
  if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) throw new InputError("Photo is too large.");
  if (!imageBase64.startsWith("/9j/") || !/^[A-Za-z0-9+/]+=*$/.test(imageBase64)) {
    throw new InputError("Photo must be a JPEG.");
  }
  return { unitType: type, shotId, imageBase64 };
}

export async function analyzePhoto(
  request: PhotoRequest,
  vision: VisionFn = callVision,
  now: () => number = Date.now,
): Promise<PhotoResult> {
  const shot = findShot(request.unitType, request.shotId);
  if (!shot) throw new InputError("Unknown shot for this home type.");
  const deadline = now() + PHOTO_BUDGET_MS;
  const text = buildUserText(UNIT_TYPES[request.unitType], shot);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadline - now();
    if (attempt > 0 && remaining < MIN_RETRY_MS) break;
    const raw = await vision({
      system: SYSTEM_PROMPT,
      text:
        attempt === 0
          ? text
          : `${text}\nYour previous answer used a word that is not allowed. Describe only what is visible without verdict words or hazard names.`,
      imageBase64: request.imageBase64,
      schema: PhotoOutputSchema,
      timeoutMs: remaining,
    });
    const outcome = validatePhotoResult(raw, request.unitType, request.shotId);
    if (outcome.ok) return outcome.result;
    if (outcome.code !== "banned_word")
      throw new ModelError("bad_output", "Photo result failed validation");
  }
  throw new ModelError("bad_output", "Photo result used wording we do not show");
}
