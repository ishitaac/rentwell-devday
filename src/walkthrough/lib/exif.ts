/**
 * Reads only the capture date from a JPEG's EXIF block, on the device, before the photo is
 * re-encoded (which drops all metadata, including GPS). Returns an ISO-like local timestamp
 * ("2026-11-20T09:41:00") or null.
 */

const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;

interface Reader {
  view: DataView;
  little: boolean;
  tiff: number;
}

function u16(r: Reader, offset: number): number {
  return r.view.getUint16(offset, r.little);
}
function u32(r: Reader, offset: number): number {
  return r.view.getUint32(offset, r.little);
}

function readAscii(r: Reader, entry: number): string | null {
  const count = u32(r, entry + 4);
  if (count < 19 || count > 64) return null;
  const start = r.tiff + u32(r, entry + 8);
  if (start + count > r.view.byteLength) return null;
  let text = "";
  for (let i = 0; i < count - 1; i += 1) text += String.fromCharCode(r.view.getUint8(start + i));
  return text;
}

/** Scans one IFD; returns [tag -> entry offset]. */
function scanIfd(r: Reader, ifdOffset: number): Map<number, number> {
  const entries = new Map<number, number>();
  const at = r.tiff + ifdOffset;
  if (at + 2 > r.view.byteLength) return entries;
  const count = u16(r, at);
  for (let i = 0; i < count; i += 1) {
    const entry = at + 2 + i * 12;
    if (entry + 12 > r.view.byteLength) break;
    entries.set(u16(r, entry), entry);
  }
  return entries;
}

function toIso(exifDate: string | null): string | null {
  const match = exifDate?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match || match[1] === "0000") return null;
  const [, y, mo, d, h, mi, s] = match;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

function findExifTiffStart(view: DataView): number | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (
      marker === 0xffe1 &&
      offset + 10 <= view.byteLength &&
      view.getUint32(offset + 4) === 0x45786966
    ) {
      return offset + 10; // "Exif\0\0"
    }
    if (marker === 0xffda || (marker & 0xff00) !== 0xff00) return null; // start of scan
    offset += 2 + length;
  }
  return null;
}

export function readCaptureDate(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    const tiff = findExifTiffStart(view);
    if (tiff == null) return null;
    const order = view.getUint16(tiff);
    if (order !== 0x4949 && order !== 0x4d4d) return null;
    const r: Reader = { view, little: order === 0x4949, tiff };
    const ifd0 = scanIfd(r, u32(r, tiff + 4));
    const exifPointer = ifd0.get(TAG_EXIF_IFD);
    if (exifPointer != null) {
      const exif = scanIfd(r, u32(r, exifPointer + 8));
      const original = exif.get(TAG_DATETIME_ORIGINAL);
      const iso = original != null ? toIso(readAscii(r, original)) : null;
      if (iso) return iso;
    }
    const plain = ifd0.get(TAG_DATETIME);
    return plain != null ? toIso(readAscii(r, plain)) : null;
  } catch {
    return null;
  }
}
