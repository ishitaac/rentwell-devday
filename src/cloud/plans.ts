import { isSavedRentalPlan, type SavedRentalPlan } from "../demoAccount";
import { getCloudClient } from "./client";

/** One saved plan per renter, in public.rental_plans (RLS: owner only). */

export async function saveCloudPlan(
  userId: string,
  plan: SavedRentalPlan,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = await getCloudClient();
    const { error } = await client
      .from("rental_plans")
      .upsert({ user_id: userId, plan, saved_at: plan.savedAt });
    return error ? { ok: false, error: "Couldn't save your plan to your account." } : { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach RentWell accounts." };
  }
}

export async function loadCloudPlan(userId: string): Promise<SavedRentalPlan | null> {
  try {
    const client = await getCloudClient();
    const { data, error } = await client
      .from("rental_plans")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    // Same validation as the browser-stored plan: never trust a stored shape blindly.
    return isSavedRentalPlan(data.plan) ? data.plan : null;
  } catch {
    return null;
  }
}
