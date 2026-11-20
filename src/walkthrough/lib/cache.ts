import type { PhotoResult, UnitType } from "./types.js";

/**
 * Result cache keyed by a hash of the resized image bytes (plus the shot it was taken for),
 * so re-analyzing the same photo is free and gives the same answer.
 * In memory, mirrored to sessionStorage when available. Never stores the image itself.
 */

const STORAGE_PREFIX = "rentwell.walkthrough.result.";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function cacheKey(imageHash: string, unitType: UnitType, shotId: string): string {
  return `${unitType}:${shotId}:${imageHash}`;
}

export class ResultCache {
  private readonly memory = new Map<string, PhotoResult>();

  constructor(private readonly store: KeyValueStore | null = null) {}

  get(key: string): PhotoResult | null {
    const hit = this.memory.get(key);
    if (hit) return hit;
    try {
      const stored = this.store?.getItem(STORAGE_PREFIX + key);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as PhotoResult;
      this.memory.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  set(key: string, result: PhotoResult): void {
    this.memory.set(key, result);
    try {
      this.store?.setItem(STORAGE_PREFIX + key, JSON.stringify(result));
    } catch {
      // Storage full or blocked: the in-memory copy is enough.
    }
  }
}

function sessionStore(): KeyValueStore | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export const resultCache = new ResultCache(sessionStore());
