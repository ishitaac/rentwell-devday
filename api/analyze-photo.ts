import { ModelError } from "../server/anthropic.js";
import { clientIp, errorResponse, jsonResponse, readJson } from "../server/http.js";
import { analyzePhoto, InputError, parsePhotoRequest } from "../server/walkthrough/analyzePhoto.js";
import { visionModel } from "../server/walkthrough/vision.js";

/** POST /api/analyze-photo { unitType, shotId, imageBase64 } -> PhotoResult. GET is a health check. */

const STATUS_BY_CODE: Record<ModelError["code"], number> = {
  no_key: 503,
  timeout: 504,
  rate_limited: 429,
  refused: 422,
  bad_output: 502,
  upstream: 502,
};

// Separate from Fine Print's limiter: one walkthrough is 6 to 13 photos.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_PHOTOS = 60;
const hits = new Map<string, number[]>();

function isPhotoRateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  const limited = recent.length >= RATE_MAX_PHOTOS;
  hits.set(ip, limited ? recent : [...recent, now]);
  return limited;
}

export function GET(): Response {
  return jsonResponse(200, {
    ok: true,
    service: "walkthrough",
    model: visionModel(),
    hasModelKey: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

export async function POST(request: Request): Promise<Response> {
  if (isPhotoRateLimited(clientIp(request))) {
    return errorResponse(429, "rate_limited", "Too many photos. Try again in a few minutes.");
  }
  try {
    const photo = parsePhotoRequest(await readJson(request));
    return jsonResponse(200, await analyzePhoto(photo));
  } catch (error) {
    if (error instanceof InputError) return errorResponse(400, "invalid_input", error.message);
    if (error instanceof ModelError) {
      // Never log the image; the error code is enough.
      console.error(`[analyze-photo] ${error.code}`);
      return errorResponse(STATUS_BY_CODE[error.code], error.code, error.message);
    }
    console.error("[analyze-photo] internal");
    return errorResponse(500, "internal", "Something went wrong reading this photo.");
  }
}
