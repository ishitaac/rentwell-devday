import { getCloudClient } from "./client";

/**
 * Saved walkthroughs: the same ZIP the renter can download, stored in the private
 * "walkthroughs" bucket at <user_id>/<uuid>.zip, plus a metadata row for the list.
 */

const BUCKET = "walkthroughs";

export type SavedWalkthrough = {
  id: string;
  storagePath: string;
  rentalName: string | null;
  unitType: string;
  photoCount: number;
  isSample: boolean;
  recordedAt: string;
  createdAt: string;
};

export type WalkthroughUpload = {
  userId: string;
  zip: Uint8Array;
  rentalName: string | null;
  unitType: string;
  photoCount: number;
  isSample: boolean;
  recordedAt: string;
};

type Row = {
  id: string;
  storage_path: string;
  rental_name: string | null;
  unit_type: string;
  photo_count: number;
  is_sample: boolean;
  recorded_at: string;
  created_at: string;
};

function fromRow(row: Row): SavedWalkthrough {
  return {
    id: row.id,
    storagePath: row.storage_path,
    rentalName: row.rental_name,
    unitType: row.unit_type,
    photoCount: row.photo_count,
    isSample: row.is_sample,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

export async function uploadWalkthrough(
  input: WalkthroughUpload,
): Promise<{ ok: true; saved: SavedWalkthrough } | { ok: false; error: string }> {
  try {
    const client = await getCloudClient();
    const path = `${input.userId}/${crypto.randomUUID()}.zip`;
    const upload = await client.storage
      .from(BUCKET)
      .upload(path, new Blob([input.zip as BlobPart], { type: "application/zip" }), {
        contentType: "application/zip",
        upsert: false,
      });
    if (upload.error) return { ok: false, error: "Couldn't upload the walkthrough." };

    const { data, error } = await client
      .from("walkthroughs")
      .insert({
        user_id: input.userId,
        storage_path: path,
        rental_name: input.rentalName?.slice(0, 120) ?? null,
        unit_type: input.unitType,
        photo_count: input.photoCount,
        byte_size: input.zip.byteLength,
        is_sample: input.isSample,
        recorded_at: input.recordedAt,
      })
      .select()
      .single();
    if (error || !data) {
      // Don't leave an orphaned file behind if the row couldn't be written.
      await client.storage.from(BUCKET).remove([path]);
      return { ok: false, error: "Couldn't save the walkthrough to your account." };
    }
    return { ok: true, saved: fromRow(data as Row) };
  } catch {
    return { ok: false, error: "Couldn't reach RentWell accounts." };
  }
}

export async function listWalkthroughs(): Promise<SavedWalkthrough[] | null> {
  try {
    const client = await getCloudClient();
    const { data, error } = await client
      .from("walkthroughs")
      .select(
        "id, storage_path, rental_name, unit_type, photo_count, is_sample, recorded_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    return error || !data ? null : (data as Row[]).map(fromRow);
  } catch {
    return null;
  }
}

export async function downloadWalkthrough(storagePath: string): Promise<Uint8Array | null> {
  try {
    const client = await getCloudClient();
    const { data, error } = await client.storage.from(BUCKET).download(storagePath);
    return error || !data ? null : new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
}

export async function deleteWalkthrough(saved: SavedWalkthrough): Promise<boolean> {
  try {
    const client = await getCloudClient();
    const removed = await client.storage.from(BUCKET).remove([saved.storagePath]);
    if (removed.error) return false;
    const { error } = await client.from("walkthroughs").delete().eq("id", saved.id);
    return !error;
  } catch {
    return false;
  }
}
