import { readCaptureDate } from "./lib/exif";
import type { CapturedPhoto } from "./lib/session";

/**
 * Prepares a photo in the browser: read the capture date, then re-encode as a resized JPEG.
 * Re-encoding through a canvas drops all EXIF metadata, including GPS and device details.
 */

const LONGEST_SIDE = 1568;
const TARGET_BYTES = 1_000_000;
const QUALITIES = [0.8, 0.68, 0.55];

export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoError";
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new PhotoError("This photo format can't be read here. Try a JPEG or PNG.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError("Could not process this photo."))),
      "image/jpeg",
      quality,
    );
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

let counter = 0;
const newId = () => `photo-${Date.now().toString(36)}-${(counter += 1)}`;

export async function preparePhoto(file: File): Promise<CapturedPhoto> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) {
    throw new PhotoError("That file isn't a photo.");
  }
  const takenAt = readCaptureDate(await file.arrayBuffer());
  const image = await decode(file);
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  const scale = Math.min(1, LONGEST_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("Could not process this photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ("close" in image) image.close();

  let blob = await toBlob(canvas, QUALITIES[0]);
  for (const quality of QUALITIES.slice(1)) {
    if (blob.size <= TARGET_BYTES) break;
    blob = await toBlob(canvas, quality);
  }
  return {
    id: newId(),
    base64: await blobToBase64(blob),
    takenAt: takenAt ?? (file.lastModified ? toLocalIso(new Date(file.lastModified)) : null),
    takenAtSource: takenAt ? "device_exif" : file.lastModified ? "file_date" : "none",
    fileName: file.name,
  };
}

function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export const photoSrc = (photo: CapturedPhoto) =>
  photo.base64.startsWith("data:") ? photo.base64 : `data:image/jpeg;base64,${photo.base64}`;
