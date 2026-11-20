/**
 * Demo-only sign-in for the property-manager app.
 *
 * This is a client-side gate for the competition demo. It does not protect any
 * data and the demo credentials ship in the page. Real accounts (for example
 * Supabase Auth) are a post-DevDay roadmap item.
 */

export const DEMO_MANAGER_EMAIL = "manager@rentwell.demo";
export const DEMO_MANAGER_PASSWORD = "RentWell-Demo-2026";
export const SESSION_KEY = "rentwell-manager-demo-session";

export type LoginField = "email" | "password" | "form";

export type LoginResult =
  | { ok: true; email: string }
  | { ok: false; field: LoginField; message: string };

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(email: string, password: string): LoginResult {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return { ok: false, field: "email", message: "Enter your work email." };
  }
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return { ok: false, field: "email", message: "Enter a valid email address." };
  }
  if (!password) {
    return { ok: false, field: "password", message: "Enter your password." };
  }
  if (
    trimmedEmail.toLowerCase() !== DEMO_MANAGER_EMAIL ||
    password !== DEMO_MANAGER_PASSWORD
  ) {
    return {
      ok: false,
      field: "form",
      message: "That email and password don't match the demo account.",
    };
  }
  return { ok: true, email: DEMO_MANAGER_EMAIL };
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Returns the signed-in demo email, or null. Never throws (storage can be blocked). */
export function readSession(storage: ReadableStorage | undefined = defaultStorage()): string | null {
  try {
    const value = storage?.getItem(SESSION_KEY);
    return value === DEMO_MANAGER_EMAIL ? value : null;
  } catch {
    return null;
  }
}

export function writeSession(
  email: string,
  storage: WritableStorage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(SESSION_KEY, email);
  } catch {
    /* Session persistence is a convenience only. */
  }
}

export function clearSession(storage: WritableStorage | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(SESSION_KEY);
  } catch {
    /* Nothing to clear if storage is unavailable. */
  }
}
