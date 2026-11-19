import type { RentalDecisionRecord } from "./rentalDecision";

export type DemoRole = "renter" | "property-manager";
export type DecisionOrigin = "listings" | "rental-entry" | "manager";
export type OptionalPlanStatus = "not-started" | "selected" | "reviewed" | "skipped";
export type ManagerPilotChoice = "started" | "requested";

export type DemoSession = {
  role: DemoRole;
  email: string;
  displayName: string;
  companyName?: string;
};

export type RoommateSelection = {
  profileId: string;
  displayName: string;
  compatibilityScore: number;
  decisionId: string | null;
};

export type SavedRentalPlan = {
  version: 1;
  ownerEmail: string;
  decision: RentalDecisionRecord;
  decisionOrigin: DecisionOrigin;
  roommate: RoommateSelection | null;
  roommateStatus: "not-started" | "selected" | "skipped";
  advisorReviewedDecisionId: string | null;
  advisorStatus: "not-started" | "reviewed" | "skipped";
  savedAt: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StorageReadResult<T> =
  | { ok: true; value: T | null }
  | { ok: false; value: null; error: string };
export type StorageWriteResult = { ok: true } | { ok: false; error: string };

export const DEMO_STORAGE_KEYS = {
  renterSession: "rentwell.demo.session.renter",
  managerSession: "rentwell.demo.session.manager",
  savedPlans: "rentwell.demo.saved-plans.v1",
  managerPilot: "rentwell.demo.manager-pilot",
} as const;

const STORAGE_ERROR = "Browser storage is unavailable.";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayNameFromEmail(email: string): string {
  const localPart = normalizeEmail(email).split("@")[0] || "Demo renter";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isDemoSession(value: unknown, role: DemoRole): value is DemoSession {
  return (
    isRecord(value) &&
    value.role === role &&
    typeof value.email === "string" &&
    value.email.length > 0 &&
    typeof value.displayName === "string" &&
    value.displayName.length > 0 &&
    (value.companyName === undefined || typeof value.companyName === "string")
  );
}

function isRentalDecision(value: unknown): value is RentalDecisionRecord {
  return (
    isRecord(value) &&
    typeof value.decisionId === "string" &&
    typeof value.title === "string" &&
    typeof value.askingRent === "number" &&
    Array.isArray(value.recurringFees) &&
    isRecord(value.capabilities)
  );
}

function isRoommateSelection(value: unknown): value is RoommateSelection {
  return (
    isRecord(value) &&
    typeof value.profileId === "string" &&
    typeof value.displayName === "string" &&
    typeof value.compatibilityScore === "number" &&
    (value.decisionId === null || typeof value.decisionId === "string")
  );
}

function isSavedRentalPlan(value: unknown): value is SavedRentalPlan {
  if (!isRecord(value) || value.version !== 1) return false;
  const origins = ["listings", "rental-entry", "manager"];
  const roommateStatuses = ["not-started", "selected", "skipped"];
  const advisorStatuses = ["not-started", "reviewed", "skipped"];
  return (
    typeof value.ownerEmail === "string" &&
    isRentalDecision(value.decision) &&
    origins.includes(String(value.decisionOrigin)) &&
    (value.roommate === null || isRoommateSelection(value.roommate)) &&
    roommateStatuses.includes(String(value.roommateStatus)) &&
    (value.advisorReviewedDecisionId === null ||
      typeof value.advisorReviewedDecisionId === "string") &&
    advisorStatuses.includes(String(value.advisorStatus)) &&
    typeof value.savedAt === "string"
  );
}

function sessionKey(role: DemoRole): string {
  return role === "renter" ? DEMO_STORAGE_KEYS.renterSession : DEMO_STORAGE_KEYS.managerSession;
}

export function createDemoSession(
  email: string,
  role: DemoRole,
  companyName?: string,
): DemoSession {
  const normalizedEmail = normalizeEmail(email);
  return {
    role,
    email: normalizedEmail,
    displayName: displayNameFromEmail(normalizedEmail),
    ...(companyName?.trim() ? { companyName: companyName.trim() } : {}),
  };
}

export function loadDemoSession(
  storage: StorageLike,
  role: DemoRole,
): StorageReadResult<DemoSession> {
  try {
    const parsed = parseRecord(storage.getItem(sessionKey(role)));
    return { ok: true, value: isDemoSession(parsed, role) ? parsed : null };
  } catch {
    return { ok: false, value: null, error: STORAGE_ERROR };
  }
}

export function saveDemoSession(storage: StorageLike, session: DemoSession): StorageWriteResult {
  try {
    storage.setItem(sessionKey(session.role), JSON.stringify(session));
    return { ok: true };
  } catch {
    return { ok: false, error: STORAGE_ERROR };
  }
}

export function clearDemoSession(storage: StorageLike, role: DemoRole): StorageWriteResult {
  try {
    storage.removeItem(sessionKey(role));
    return { ok: true };
  } catch {
    return { ok: false, error: STORAGE_ERROR };
  }
}

export function loadSavedPlan(
  storage: StorageLike,
  email: string,
): StorageReadResult<SavedRentalPlan> {
  try {
    const plans = parseRecord(storage.getItem(DEMO_STORAGE_KEYS.savedPlans));
    const plan = plans?.[normalizeEmail(email)];
    return { ok: true, value: isSavedRentalPlan(plan) ? plan : null };
  } catch {
    return { ok: false, value: null, error: STORAGE_ERROR };
  }
}

export function saveSavedPlan(storage: StorageLike, plan: SavedRentalPlan): StorageWriteResult {
  try {
    const plans = parseRecord(storage.getItem(DEMO_STORAGE_KEYS.savedPlans)) ?? {};
    const ownerEmail = normalizeEmail(plan.ownerEmail);
    storage.setItem(
      DEMO_STORAGE_KEYS.savedPlans,
      JSON.stringify({ ...plans, [ownerEmail]: { ...plan, ownerEmail } }),
    );
    return { ok: true };
  } catch {
    return { ok: false, error: STORAGE_ERROR };
  }
}

export function loadManagerPilot(storage: StorageLike): StorageReadResult<ManagerPilotChoice> {
  try {
    const value = storage.getItem(DEMO_STORAGE_KEYS.managerPilot);
    return { ok: true, value: value === "started" || value === "requested" ? value : null };
  } catch {
    return { ok: false, value: null, error: STORAGE_ERROR };
  }
}

export function saveManagerPilot(
  storage: StorageLike,
  choice: ManagerPilotChoice,
): StorageWriteResult {
  try {
    storage.setItem(DEMO_STORAGE_KEYS.managerPilot, choice);
    return { ok: true };
  } catch {
    return { ok: false, error: STORAGE_ERROR };
  }
}

export function resetRentwellDemoData(storage: StorageLike): StorageWriteResult {
  try {
    Object.values(DEMO_STORAGE_KEYS).forEach((key) => storage.removeItem(key));
    return { ok: true };
  } catch {
    return { ok: false, error: STORAGE_ERROR };
  }
}
