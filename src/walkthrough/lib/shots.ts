import { CATEGORIES, type Category, type UnitType } from "./types.js";

/**
 * UNIT_TYPES is the single source of truth for what each kind of home asks for.
 * The renter picks the type; it is never inferred from photos or an address.
 * A tour walks the required shots in `tourOrder`, then the "Anything else?" stop.
 */

/** A 5-second check for something a photo can't show. "No" means the renter noticed a problem. */
export interface QuickCheck {
  question: string;
  /** Short label for results, e.g. "Hot water and pressure". */
  label: string;
  /** Landlord question added when the renter answers "No". */
  ifNo: string;
}

export interface Shot {
  id: string;
  /** Title-case label shown on the slot. */
  label: string;
  /** Short name for the tour header and results tiles, e.g. "Kitchen sink". */
  short: string;
  /** Used inside sentences: "Can I see {askLabel} before I sign?" */
  askLabel: string;
  hint: string;
  category: Category;
  /** Other categories that commonly show up in this shot. visible_safety and water_moisture are always allowed. */
  related: Category[];
  /** Up to three things to look for while taking the photo. */
  lookFor: string[];
  quickCheck: QuickCheck | null;
  /** Key into the example illustrations. */
  art: ArtKey;
}

export type ArtKey =
  | "sink"
  | "ceiling"
  | "tub"
  | "window"
  | "floor"
  | "appliances"
  | "stairs"
  | "exterior"
  | "yard"
  | "mechanical"
  | "hallway"
  | "outlet"
  | "garage"
  | "anything";

export interface UnitTypeConfig {
  id: UnitType;
  label: string;
  /** Lower-case, for "The home is a {promptLabel}." */
  promptLabel: string;
  description: string;
  required: Shot[];
  optional: Shot[];
  /** Required shot ids in the order you'd walk through this kind of home. */
  tourOrder: string[];
  standardQuestions: string[];
}

const SINK = (id: string): Shot => ({
  id,
  label: "Kitchen sink and under-sink cabinet",
  short: "Kitchen sink",
  askLabel: "the kitchen sink and under-sink cabinet",
  hint: "Open the cabinet; include the pipes",
  category: "water_moisture",
  related: ["kitchen_fixtures", "cleanliness_pests"],
  lookFor: ["Water marks or drips", "Warped or soft cabinet floor", "Droppings or bugs"],
  quickCheck: {
    question: "Run the hot tap for 10 seconds. Hot water and good pressure?",
    label: "Hot water and pressure",
    ifNo: "Can you confirm the hot water and water pressure will be fixed before move-in?",
  },
  art: "sink",
});

const BATH = (id: string): Shot => ({
  id,
  label: "Bathroom tub/shower and caulk lines",
  short: "Tub and shower",
  askLabel: "the bathroom tub, shower, and caulk lines",
  hint: "Include the tub edge and ceiling above",
  category: "bathroom_fixtures",
  related: ["walls_ceilings", "cleanliness_pests"],
  lookFor: ["Gaps or dark caulk", "Cracked tiles", "Peeling paint above"],
  quickCheck: {
    question: "Flush the toilet and run the shower. Both drain normally?",
    label: "Toilet and shower drain",
    ifNo: "Can the slow drain or toilet be repaired before move-in?",
  },
  art: "tub",
});

const WINDOW = (id: string, required = true): Shot => ({
  id,
  label: required ? "A window and its frame" : "Window and frame",
  short: "Window",
  askLabel: "a window and its frame",
  hint: "Include the sill and the glass",
  category: "windows_doors",
  related: ["walls_ceilings"],
  lookFor: ["Cracked glass", "Peeling or rotting frame", "Gaps around the edge"],
  quickCheck: {
    question: "Open, close, and lock the window. Does it all work?",
    label: "Window opens and locks",
    ifNo: "Can the window be repaired so it opens and locks before move-in?",
  },
  art: "window",
});

const CEILING = (id: string, label: string, askLabel: string, hint: string): Shot => ({
  id,
  label,
  short: "Ceiling and corners",
  askLabel,
  hint,
  category: "walls_ceilings",
  related: [],
  lookFor: ["Brown or yellow stains", "Cracks or bubbling paint", "Dark patches in corners"],
  quickCheck: {
    question: "Take a breath. Any musty or damp smell in this room?",
    label: "Smells normal",
    ifNo: "I noticed a musty smell. Has there been any water issue in this unit?",
  },
  art: "ceiling",
});

const MECHANICAL = (id: string, label: string, hint: string): Shot => ({
  id,
  label,
  short: "Water heater / furnace",
  askLabel: "the water heater and furnace area",
  hint,
  category: "mechanical_visible",
  related: ["flooring"],
  lookFor: ["Rust or water at the base", "Damaged vent pipe", "Stuff stored too close"],
  quickCheck: {
    question: "Is there a service sticker with a recent date on it?",
    label: "Recent service sticker",
    ifNo: "When were the water heater and furnace last serviced?",
  },
  art: "mechanical",
});

const MISC_SHOT = (n: number): Shot => ({
  id: `X${n}`,
  label: `Anything else (${n})`,
  short: "Anything else",
  askLabel: "the other area I noticed",
  hint: "Something that caught your eye",
  category: "visible_safety",
  related: [...CATEGORIES],
  lookFor: [],
  quickCheck: null,
  art: "anything",
});

/** "Anything else?" shots: up to three per walkthrough, any category. Optional, never a gap. */
export const MISC_SHOTS: Shot[] = [MISC_SHOT(1), MISC_SHOT(2), MISC_SHOT(3)];

export const UNIT_TYPES: Record<UnitType, UnitTypeConfig> = {
  apartment: {
    id: "apartment",
    label: "Apartment or condo",
    promptLabel: "apartment or condo",
    description: "A unit in a shared building with hallways and shared walls.",
    required: [
      SINK("A1"),
      CEILING(
        "A2",
        "Ceiling and upper wall corners in the main room",
        "the ceiling and upper corners of the main room",
        "Stand back; include two corners",
      ),
      BATH("A3"),
      WINDOW("A4"),
      {
        id: "A5",
        label: "Floor along a wall",
        short: "Floor",
        askLabel: "the floor along the walls",
        hint: "Low angle; include the baseboard",
        category: "flooring",
        related: ["walls_ceilings", "cleanliness_pests"],
        lookFor: ["Stains or burns", "Warped or lifting boards", "Gaps at the baseboard"],
        quickCheck: {
          question: "Walk across the room. Floor feels solid, no soft spots?",
          label: "Floor feels solid",
          ifNo: "I noticed a soft spot in the floor. Can it be checked before move-in?",
        },
        art: "floor",
      },
      {
        id: "A6",
        label: "Kitchen appliances (stove, fridge)",
        short: "Appliances",
        askLabel: "the kitchen appliances",
        hint: "One wide shot",
        category: "appliances",
        related: ["kitchen_fixtures", "cleanliness_pests"],
        lookFor: ["Broken handles or seals", "Rust or heavy grime", "Missing knobs or parts"],
        quickCheck: {
          question: "Turn on a burner and open the fridge. Both working?",
          label: "Stove and fridge work",
          ifNo: "Can the stove or fridge be repaired or replaced before move-in?",
        },
        art: "appliances",
      },
    ],
    optional: [
      {
        id: "AO1",
        label: "Building entry and hallway",
        short: "Entry and hallway",
        askLabel: "the building entry and hallway",
        hint: "Include doors, lighting, and the exit path",
        category: "common_areas",
        related: ["flooring", "walls_ceilings"],
        lookFor: ["Broken lights or locks", "Blocked exits", "Heavy stains or debris"],
        quickCheck: null,
        art: "hallway",
      },
      {
        id: "AO2",
        label: "Balcony or patio door",
        short: "Balcony door",
        askLabel: "the balcony or patio door",
        hint: "Include the track and the frame",
        category: "windows_doors",
        related: ["exterior"],
        lookFor: ["Damaged track", "Cracked glass", "Loose railing"],
        quickCheck: null,
        art: "window",
      },
      {
        id: "AO3",
        label: "Outlet and switch plate",
        short: "Outlet",
        askLabel: "an outlet and switch plate",
        hint: "Close up, with the wall around it",
        category: "visible_safety",
        related: ["walls_ceilings"],
        lookFor: ["Scorch marks", "Cracked cover", "Loose outlet"],
        quickCheck: null,
        art: "outlet",
      },
    ],
    tourOrder: ["A1", "A6", "A3", "A2", "A4", "A5"],
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
      CEILING(
        "T2",
        "Ceiling and upper wall corners on the top floor",
        "the ceiling and upper corners on the top floor",
        "Include two corners and any stair opening",
      ),
      BATH("T3"),
      {
        id: "T4",
        label: "Stairs and handrail",
        short: "Stairs",
        askLabel: "the stairs and handrail",
        hint: "One shot from the bottom, include the rail",
        category: "visible_safety",
        related: ["flooring"],
        lookFor: ["Loose or missing rail", "Damaged steps", "Worn or torn carpet"],
        quickCheck: {
          question: "Grip the handrail and give it a gentle shake. Feels solid?",
          label: "Handrail feels solid",
          ifNo: "The handrail felt loose. Can it be secured before move-in?",
        },
        art: "stairs",
      },
      {
        id: "T5",
        label: "Entry door and front exterior",
        short: "Front entry",
        askLabel: "the entry door and front exterior",
        hint: "Include the steps, door frame, and siding near the ground",
        category: "exterior",
        related: ["windows_doors"],
        lookFor: ["Cracked or crumbling steps", "Damaged door frame", "Missing siding"],
        quickCheck: {
          question: "Lock and unlock the front door. Smooth and secure?",
          label: "Front door locks",
          ifNo: "Can the front door lock be repaired or rekeyed before move-in?",
        },
        art: "exterior",
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
        short: "Shared wall",
        askLabel: "the shared wall and ceiling line",
        hint: "Where your unit meets the neighbor's",
        category: "walls_ceilings",
        related: [],
        lookFor: ["Cracks along the line", "Stains", "Gaps"],
        quickCheck: null,
        art: "ceiling",
      },
      {
        id: "TO2",
        label: "Garage or parking space",
        short: "Garage",
        askLabel: "the garage or parking space",
        hint: "Include the door and the floor",
        category: "exterior",
        related: ["flooring"],
        lookFor: ["Damaged door", "Oil or water pooling", "Cracks in the floor"],
        quickCheck: null,
        art: "garage",
      },
      {
        id: "TO3",
        label: "Patio or yard",
        short: "Patio or yard",
        askLabel: "the patio or yard",
        hint: "Include fences and the ground near the home",
        category: "yard_grounds",
        related: ["exterior"],
        lookFor: ["Pooling water", "Damaged fence", "Overgrowth"],
        quickCheck: null,
        art: "yard",
      },
      WINDOW("TO4", false),
    ],
    tourOrder: ["T5", "T1", "T6", "T4", "T2", "T3"],
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
      CEILING(
        "H2",
        "Ceiling and upper wall corners in the main living area",
        "the ceiling and upper corners of the living area",
        "Include two corners",
      ),
      BATH("H3"),
      {
        id: "H4",
        label: "Front and side exterior",
        short: "Exterior",
        askLabel: "the front and side exterior",
        hint: "Stand back; include siding, gutters, and roofline as seen from the ground",
        category: "exterior",
        related: ["windows_doors"],
        lookFor: ["Missing or damaged siding", "Sagging gutters", "Broken steps or railing"],
        quickCheck: {
          question: "Lock and unlock the front door. Smooth and secure?",
          label: "Front door locks",
          ifNo: "Can the front door lock be repaired or rekeyed before move-in?",
        },
        art: "exterior",
      },
      {
        id: "H5",
        label: "Yard and ground next to the foundation",
        short: "Yard and foundation",
        askLabel: "the yard and the ground next to the foundation",
        hint: "Include fences, drainage areas, and any pooling water",
        category: "yard_grounds",
        related: ["exterior"],
        lookFor: ["Pooling water by the house", "Leaning trees or big limbs", "Damaged fence"],
        quickCheck: {
          question: "Is there an outside tap or hose? Does it run without leaking?",
          label: "Outdoor tap works",
          ifNo: "Can the outdoor tap be repaired, and who maintains it?",
        },
        art: "yard",
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
        short: "Garage",
        askLabel: "the garage",
        hint: "Include the door and the floor",
        category: "exterior",
        related: ["flooring"],
        lookFor: ["Damaged door", "Water pooling", "Cracks in the floor"],
        quickCheck: null,
        art: "garage",
      },
      {
        id: "HO2",
        label: "Basement or crawlspace entry",
        short: "Basement",
        askLabel: "the basement or crawlspace entry",
        hint: "Only if accessible; include walls and floor",
        category: "water_moisture",
        related: ["walls_ceilings", "flooring"],
        lookFor: ["Water marks on walls", "Damp floor", "Musty smell"],
        quickCheck: null,
        art: "mechanical",
      },
      WINDOW("HO3", false),
      {
        id: "HO4",
        label: "Appliances",
        short: "Appliances",
        askLabel: "the appliances",
        hint: "One wide shot",
        category: "appliances",
        related: ["kitchen_fixtures"],
        lookFor: ["Broken handles or seals", "Rust or heavy grime", "Missing parts"],
        quickCheck: null,
        art: "appliances",
      },
    ],
    tourOrder: ["H4", "H5", "H1", "H6", "H2", "H3"],
    standardQuestions: [
      "Who handles lawn, snow, and gutters, and who pays for them?",
      "When were the water heater and furnace last serviced, and who pays if they fail?",
    ],
  },
};

export const DEFAULT_UNIT_TYPE: UnitType = "apartment";

export function isMiscShot(shotId: string): boolean {
  return MISC_SHOTS.some((shot) => shot.id === shotId);
}

/** Required + optional + "Anything else?" shots for a type. */
export function allShots(unitType: UnitType): Shot[] {
  const config = UNIT_TYPES[unitType];
  return [...config.required, ...config.optional, ...MISC_SHOTS];
}

export function tourShots(unitType: UnitType): Shot[] {
  const config = UNIT_TYPES[unitType];
  return config.tourOrder.map((id) => config.required.find((shot) => shot.id === id)!);
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
