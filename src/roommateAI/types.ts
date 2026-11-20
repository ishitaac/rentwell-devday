/**
 * Shared types and the single field registry for the AI roommate feature.
 * The registry is the ONLY set of inputs matching, simulation and AI extraction may touch,
 * so protected characteristics cannot enter by accident.
 */

export type Priority = "required" | "preferred" | "flexible";
export type FieldSource = "user-form" | "user-text" | "ai-extracted";
export type Uncertainty = "low" | "medium" | "high";
export type ClarificationStatus = "none" | "asked" | "answered" | "skipped";

export type FieldValue = string | number;

export interface ProfileField {
  value: FieldValue;
  priority: Priority;
  source: FieldSource;
  uncertainty: Uncertainty;
  clarification: ClarificationStatus;
  /** Only confirmed fields are ever used for matching or simulation. */
  confirmed: boolean;
  /** AI/text extraction may suggest "required"; the user must opt in during confirmation. */
  suggestedRequired?: boolean;
}

type OrdinalDef = { kind: "ordinal"; values: readonly string[] } | { kind: "scale"; min: number; max: number };
type CategoricalDef = { kind: "categorical"; values: readonly string[] };
type NumberDef = { kind: "number"; min: number; max: number };
type MonthDef = { kind: "month" };

export type FieldDef = (OrdinalDef | CategoricalDef | NumberDef | MonthDef) & {
  group: "housing" | "schedule" | "shared-space" | "social";
  label: string;
};

export const FIELD_DEFS = {
  // housing (objective)
  budgetMax: { kind: "number", min: 300, max: 5000, group: "housing", label: "Monthly budget (your share)" },
  moveInMonth: { kind: "month", group: "housing", label: "Move-in month" },
  leaseMonths: { kind: "number", min: 1, max: 36, group: "housing", label: "Lease length (months)" },
  bedroom: { kind: "categorical", values: ["private", "shared"], group: "housing", label: "Bedroom" },
  bathroom: { kind: "categorical", values: ["private", "shared"], group: "housing", label: "Bathroom" },
  roommateCount: { kind: "number", min: 1, max: 6, group: "housing", label: "Number of roommates" },
  furnished: { kind: "categorical", values: ["yes", "no", "either"], group: "housing", label: "Furnished" },
  parking: { kind: "categorical", values: ["yes", "no", "either"], group: "housing", label: "Parking needed" },
  // schedule
  sleep: { kind: "ordinal", values: ["early", "standard", "late"], group: "schedule", label: "Sleep schedule" },
  quietStartHour: { kind: "number", min: 20, max: 24, group: "schedule", label: "Quiet hours start (hour, 24 = midnight)" },
  noiseTolerance: { kind: "scale", min: 1, max: 5, group: "schedule", label: "Noise tolerance" },
  workFromHome: { kind: "ordinal", values: ["rarely", "some", "most"], group: "schedule", label: "Work/study from home" },
  // shared-space
  cleanliness: { kind: "scale", min: 1, max: 5, group: "shared-space", label: "Tidiness" },
  cookwareSharing: { kind: "categorical", values: ["separate", "flexible", "shared"], group: "shared-space", label: "Cookware & utensils" },
  cookingFrequency: { kind: "ordinal", values: ["rarely", "sometimes", "daily"], group: "shared-space", label: "Cooking at home" },
  smokingInShared: { kind: "categorical", values: ["no", "outside-only", "ok"], group: "shared-space", label: "Smoking/vaping in shared areas" },
  temperature: { kind: "ordinal", values: ["cool", "moderate", "warm"], group: "shared-space", label: "Home temperature" },
  // social
  guestFrequency: { kind: "ordinal", values: ["rarely", "sometimes", "often"], group: "social", label: "Guests over" },
  overnightGuests: { kind: "ordinal", values: ["never", "sometimes", "often"], group: "social", label: "Overnight guests" },
  expenseSplit: { kind: "categorical", values: ["equal", "by-use", "flexible"], group: "social", label: "Shared expenses" },
  conflictStyle: { kind: "categorical", values: ["talk-soon", "scheduled", "written"], group: "social", label: "Handling disagreements" },
} as const satisfies Record<string, FieldDef>;

export type FieldKey = keyof typeof FIELD_DEFS;
export const FIELD_KEYS = Object.keys(FIELD_DEFS) as FieldKey[];
export const HOUSING_KEYS: FieldKey[] = FIELD_KEYS.filter((k) => FIELD_DEFS[k].group === "housing");

export interface LocationContext {
  state?: string; // two-letter, e.g. "UT"
  city?: string;
  zip?: string;
  neighborhoods?: string[];
}

export interface RoommateProfile {
  profileId: string;
  /** True for fictional fixtures. Never true for a real user's profile. */
  demo: boolean;
  displayName: string;
  /** Whether this person already has housing (host) or is searching. */
  hasHousing: boolean;
  location: LocationContext;
  fields: Partial<Record<FieldKey, ProfileField>>;
}

export function isFieldKey(value: string): value is FieldKey {
  return Object.prototype.hasOwnProperty.call(FIELD_DEFS, value);
}

/** Validate a raw value against the registry. Returns the normalized value or null. */
export function normalizeValue(key: FieldKey, raw: unknown): FieldValue | null {
  const def: FieldDef = FIELD_DEFS[key];
  switch (def.kind) {
    case "ordinal":
    case "categorical":
      return typeof raw === "string" && def.values.includes(raw) ? raw : null;
    case "scale":
    case "number": {
      const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
      return Number.isFinite(n) && n >= def.min && n <= def.max ? Math.round(n) : null;
    }
    case "month":
      return typeof raw === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw) ? raw : null;
  }
}

export function makeField(
  value: FieldValue,
  opts: Partial<Omit<ProfileField, "value">> = {},
): ProfileField {
  return {
    value,
    priority: "preferred",
    source: "user-form",
    uncertainty: "low",
    clarification: "none",
    confirmed: false,
    ...opts,
  };
}

/** The only accessor matching/simulation use: confirmed fields only. */
export function confirmed(profile: RoommateProfile, key: FieldKey): ProfileField | undefined {
  const field = profile.fields[key];
  return field && field.confirmed ? field : undefined;
}
