import type { Category, UnitType } from "./types.js";

/**
 * UNIT_TYPES is the single source of truth for what each kind of home asks for.
 * The renter picks the type; it is never inferred from photos or an address.
 */

export interface Shot {
  id: string;
  /** Title-case label shown on the slot. */
  label: string;
  /** Used inside sentences: "Can I see {askLabel} before I sign?" */
  askLabel: string;
  hint: string;
  category: Category;
  /** Other categories that commonly show up in this shot. visible_safety and water_moisture are always allowed. */
  related: Category[];
}

export interface UnitTypeConfig {
  id: UnitType;
  label: string;
  /** Lower-case, for "The home is a {promptLabel}." */
  promptLabel: string;
  description: string;
  required: Shot[];
  optional: Shot[];
  standardQuestions: string[];
}

const SINK = (id: string): Shot => ({
  id,
  label: "Kitchen sink and under-sink cabinet",
  askLabel: "the kitchen sink and under-sink cabinet",
  hint: "Open the cabinet; include the pipes",
  category: "water_moisture",
  related: ["kitchen_fixtures", "cleanliness_pests"],
});

const BATH = (id: string): Shot => ({
  id,
  label: "Bathroom tub/shower and caulk lines",
  askLabel: "the bathroom tub, shower, and caulk lines",
  hint: "Include the tub edge and ceiling above",
  category: "bathroom_fixtures",
  related: ["walls_ceilings", "cleanliness_pests"],
});

const WINDOW = (id: string, required = true): Shot => ({
  id,
  label: required ? "A window and its frame" : "Window and frame",
  askLabel: "a window and its frame",
  hint: "Include the sill and the glass",
  category: "windows_doors",
  related: ["walls_ceilings"],
});

const MECHANICAL = (id: string, label: string, hint: string): Shot => ({
  id,
  label,
  askLabel: "the water heater and furnace area",
  hint,
  category: "mechanical_visible",
  related: ["flooring"],
});

export const UNIT_TYPES: Record<UnitType, UnitTypeConfig> = {
  apartment: {
    id: "apartment",
    label: "Apartment or condo",
    promptLabel: "apartment or condo",
    description: "A unit in a shared building with hallways and shared walls.",
    required: [
      SINK("A1"),
      {
        id: "A2",
        label: "Ceiling and upper wall corners in the main room",
        askLabel: "the ceiling and upper corners of the main room",
        hint: "Stand back; include two corners",
        category: "walls_ceilings",
        related: [],
      },
      BATH("A3"),
      WINDOW("A4"),
      {
        id: "A5",
        label: "Floor along a wall",
        askLabel: "the floor along the walls",
        hint: "Low angle; include the baseboard",
        category: "flooring",
        related: ["walls_ceilings", "cleanliness_pests"],
      },
      {
        id: "A6",
        label: "Kitchen appliances (stove, fridge)",
        askLabel: "the kitchen appliances",
        hint: "One wide shot",
        category: "appliances",
        related: ["kitchen_fixtures", "cleanliness_pests"],
      },
    ],
    optional: [
      {
        id: "AO1",
        label: "Building entry and hallway",
        askLabel: "the building entry and hallway",
        hint: "Include doors, lighting, and the exit path",
        category: "common_areas",
        related: ["flooring", "walls_ceilings"],
      },
      {
        id: "AO2",
        label: "Balcony or patio door",
        askLabel: "the balcony or patio door",
        hint: "Include the track and the frame",
        category: "windows_doors",
        related: ["exterior"],
      },
      {
        id: "AO3",
        label: "Outlet and switch plate",
        askLabel: "an outlet and switch plate",
        hint: "Close up, with the wall around it",
        category: "visible_safety",
        related: ["walls_ceilings"],
      },
    ],
    standardQuestions: [
      "How are repair requests made and how quickly are they handled?",
      "What are the quiet hours, and how are noise complaints handled?",
    ],
  },
  townhome: {
    id: "townhome",
    label: "Townhome",
    promptLabel: "townhome",
    description: "Multiple floors, its own entry, and shared walls with neighbors.",
    required: [
      SINK("T1"),
      {
        id: "T2",
        label: "Ceiling and upper wall corners on the top floor",
        askLabel: "the ceiling and upper corners on the top floor",
        hint: "Include two corners and any stair opening",
        category: "walls_ceilings",
        related: [],
      },
      BATH("T3"),
      {
        id: "T4",
        label: "Stairs and handrail",
        askLabel: "the stairs and handrail",
        hint: "One shot from the bottom, include the rail",
        category: "visible_safety",
        related: ["flooring"],
      },
      {
        id: "T5",
        label: "Entry door and front exterior",
        askLabel: "the entry door and front exterior",
        hint: "Include the steps, door frame, and siding near the ground",
        category: "exterior",
        related: ["windows_doors"],
      },
      MECHANICAL(
        "T6",
        "Water heater or furnace area, if accessible",
        "Visible condition only, include the floor around it",
      ),
    ],
    optional: [
      {
        id: "TO1",
        label: "Shared wall and ceiling line",
        askLabel: "the shared wall and ceiling line",
        hint: "Where your unit meets the neighbor's",
        category: "walls_ceilings",
        related: [],
      },
      {
        id: "TO2",
        label: "Garage or parking space",
        askLabel: "the garage or parking space",
        hint: "Include the door and the floor",
        category: "exterior",
        related: ["flooring"],
      },
      {
        id: "TO3",
        label: "Patio or yard",
        askLabel: "the patio or yard",
        hint: "Include fences and the ground near the home",
        category: "yard_grounds",
        related: ["exterior"],
      },
      WINDOW("TO4", false),
    ],
    standardQuestions: [
      "Who is responsible for the roof, shared walls, and exterior: the landlord or an HOA?",
      "Do any HOA rules apply to me, and can I get a copy?",
    ],
  },
  single_family: {
    id: "single_family",
    label: "Single-family home",
    promptLabel: "single-family home",
    description: "A detached house with its own exterior, yard, and equipment.",
    required: [
      SINK("H1"),
      {
        id: "H2",
        label: "Ceiling and upper wall corners in the main living area",
        askLabel: "the ceiling and upper corners of the living area",
        hint: "Include two corners",
        category: "walls_ceilings",
        related: [],
      },
      BATH("H3"),
      {
        id: "H4",
        label: "Front and side exterior",
        askLabel: "the front and side exterior",
        hint: "Stand back; include siding, gutters, and roofline as seen from the ground",
        category: "exterior",
        related: ["windows_doors"],
      },
      {
        id: "H5",
        label: "Yard and ground next to the foundation",
        askLabel: "the yard and the ground next to the foundation",
        hint: "Include fences, drainage areas, and any pooling water",
        category: "yard_grounds",
        related: ["exterior"],
      },
      MECHANICAL(
        "H6",
        "Water heater and furnace area",
        "Visible condition only, include the floor around them",
      ),
    ],
    optional: [
      {
        id: "HO1",
        label: "Garage",
        askLabel: "the garage",
        hint: "Include the door and the floor",
        category: "exterior",
        related: ["flooring"],
      },
      {
        id: "HO2",
        label: "Basement or crawlspace entry",
        askLabel: "the basement or crawlspace entry",
        hint: "Only if accessible; include walls and floor",
        category: "water_moisture",
        related: ["walls_ceilings", "flooring"],
      },
      WINDOW("HO3", false),
      {
        id: "HO4",
        label: "Appliances",
        askLabel: "the appliances",
        hint: "One wide shot",
        category: "appliances",
        related: ["kitchen_fixtures"],
      },
    ],
    standardQuestions: [
      "Who handles lawn, snow, and gutters, and who pays for them?",
      "When were the water heater and furnace last serviced, and who pays if they fail?",
    ],
  },
};

export const DEFAULT_UNIT_TYPE: UnitType = "apartment";

export function allShots(unitType: UnitType): Shot[] {
  const config = UNIT_TYPES[unitType];
  return [...config.required, ...config.optional];
}

export function findShot(unitType: UnitType, shotId: string): Shot | undefined {
  return allShots(unitType).find((shot) => shot.id === shotId);
}

export function isRequired(unitType: UnitType, shotId: string): boolean {
  return UNIT_TYPES[unitType].required.some((shot) => shot.id === shotId);
}

const ALWAYS_ALLOWED: Category[] = ["visible_safety", "water_moisture"];

export function allowedCategories(shot: Shot): Category[] {
  return [shot.category, ...shot.related, ...ALWAYS_ALLOWED];
}

export const CATEGORY_LABELS: Record<Category, string> = {
  water_moisture: "water or moisture",
  walls_ceilings: "walls and ceilings",
  flooring: "flooring",
  windows_doors: "windows and doors",
  kitchen_fixtures: "kitchen fixture",
  bathroom_fixtures: "bathroom fixture",
  appliances: "appliance",
  visible_safety: "visible safety",
  cleanliness_pests: "cleanliness or pests",
  exterior: "exterior",
  yard_grounds: "yard and grounds",
  mechanical_visible: "water heater or furnace area",
  common_areas: "shared area",
};
