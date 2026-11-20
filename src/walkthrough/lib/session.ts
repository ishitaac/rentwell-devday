import { findShot } from "./shots.js";
import type { UnitType } from "./types.js";

/** Pure session state for the capture screen: which photo sits in which slot. */

export interface CapturedPhoto {
  id: string;
  /** Resized JPEG, base64 without the data: prefix. Metadata already stripped. */
  base64: string;
  /** Date read from the device's EXIF before stripping, or the file date as a fallback. */
  takenAt: string | null;
  takenAtSource: "device_exif" | "file_date" | "none";
  fileName: string;
}

export interface CaptureState {
  unitType: UnitType;
  photos: Record<string, CapturedPhoto>;
  /** shotId -> photoId */
  slots: Record<string, string>;
  /** Photos picked in bulk that are not assigned to a slot yet. */
  tray: string[];
  /** shotId -> renter note. Renter-recorded, unverified. */
  notes: Record<string, string>;
}

export const MAX_NOTE_CHARS = 500;

export function initialCaptureState(unitType: UnitType): CaptureState {
  return { unitType, photos: {}, slots: {}, tray: [], notes: {} };
}

export function hasAssignedPhotos(state: CaptureState): boolean {
  return Object.keys(state.slots).length > 0;
}

/** Put a photo straight into a slot. A photo already there is replaced and discarded. */
export function placePhoto(
  state: CaptureState,
  shotId: string,
  photo: CapturedPhoto,
): CaptureState {
  if (!findShot(state.unitType, shotId)) return state;
  const previous = state.slots[shotId];
  const photos = { ...state.photos, [photo.id]: photo };
  if (previous && previous !== photo.id) delete photos[previous];
  return { ...state, photos, slots: { ...state.slots, [shotId]: photo.id } };
}

export function addToTray(state: CaptureState, photos: CapturedPhoto[]): CaptureState {
  const added = Object.fromEntries(photos.map((photo) => [photo.id, photo]));
  return {
    ...state,
    photos: { ...state.photos, ...added },
    tray: [...state.tray, ...photos.map((p) => p.id)],
  };
}

/** Move a tray photo into a slot. Whatever was in the slot goes back to the tray. */
export function assignFromTray(state: CaptureState, photoId: string, shotId: string): CaptureState {
  if (!state.tray.includes(photoId) || !findShot(state.unitType, shotId)) return state;
  const displaced = state.slots[shotId];
  const tray = state.tray.filter((id) => id !== photoId);
  return {
    ...state,
    slots: { ...state.slots, [shotId]: photoId },
    tray: displaced ? [...tray, displaced] : tray,
  };
}

export function clearSlot(state: CaptureState, shotId: string): CaptureState {
  const photoId = state.slots[shotId];
  if (!photoId) return state;
  const slots = { ...state.slots };
  delete slots[shotId];
  const photos = { ...state.photos };
  delete photos[photoId];
  const notes = { ...state.notes };
  delete notes[shotId];
  return { ...state, slots, photos, notes };
}

export function removeFromTray(state: CaptureState, photoId: string): CaptureState {
  const photos = { ...state.photos };
  delete photos[photoId];
  return { ...state, photos, tray: state.tray.filter((id) => id !== photoId) };
}

export function setNote(state: CaptureState, shotId: string, note: string): CaptureState {
  const notes = { ...state.notes };
  const clean = note.slice(0, MAX_NOTE_CHARS);
  if (clean.trim()) notes[shotId] = clean;
  else delete notes[shotId];
  return { ...state, notes };
}

export type UnitTypeChange =
  | { kind: "changed"; state: CaptureState }
  | { kind: "needs_confirmation" }
  | { kind: "unchanged"; state: CaptureState };

/**
 * Changing the home type after photos are in slots asks first, then clears every slot.
 * Shot IDs differ between types, so keeping assignments would mislabel photos.
 */
export function changeUnitType(
  state: CaptureState,
  unitType: UnitType,
  confirmed: boolean,
): UnitTypeChange {
  if (unitType === state.unitType) return { kind: "unchanged", state };
  if (hasAssignedPhotos(state) && !confirmed) return { kind: "needs_confirmation" };
  return { kind: "changed", state: initialCaptureState(unitType) };
}
