import type { Session } from "@supabase/supabase-js";

import { createDemoSession, type DemoSession } from "../demoAccount";
import { getCloudClient } from "./client";

/** A signed-in renter. `userId` is the Supabase auth id that every table row is keyed on. */
export type CloudSession = DemoSession & { userId: string };

export type CloudAuthResult =
  | { ok: true; session: CloudSession }
  | { ok: false; error: string; needsConfirmation?: boolean };

export const MIN_PASSWORD_LENGTH = 8;

export function toCloudSession(session: Session | null): CloudSession | null {
  const user = session?.user;
  if (!user?.email) return null;
  const base = createDemoSession(user.email, "renter");
  const metaName = user.user_metadata?.display_name;
  return {
    ...base,
    displayName:
      typeof metaName === "string" && metaName.trim() ? metaName.trim() : base.displayName,
    userId: user.id,
  };
}

/** Maps Supabase errors to plain renter-facing text. Never echoes the password. */
export function friendlyAuthError(message: string | undefined): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (text.includes("email not confirmed"))
    return "Confirm your email first. Check your inbox for the link, then sign in.";
  if (text.includes("already registered") || text.includes("already been registered"))
    return "An account with this email already exists. Sign in instead.";
  if (text.includes("password"))
    return `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (text.includes("rate limit") || text.includes("too many"))
    return "Too many attempts. Wait a minute and try again.";
  if (text.includes("fetch") || text.includes("network"))
    return "Couldn't reach RentWell accounts. Check your connection and try again.";
  return "Sign-in didn't work. Try again.";
}

export async function getCurrentCloudSession(): Promise<CloudSession | null> {
  const client = await getCloudClient();
  const { data } = await client.auth.getSession();
  return toCloudSession(data.session);
}

/** Calls back on sign-in, sign-out and token refresh. Returns an unsubscribe function. */
export async function watchCloudSession(
  onChange: (session: CloudSession | null) => void,
): Promise<() => void> {
  const client = await getCloudClient();
  const { data } = client.auth.onAuthStateChange((_event, session) =>
    onChange(toCloudSession(session)),
  );
  return () => data.subscription.unsubscribe();
}

export async function signInRenter(email: string, password: string): Promise<CloudAuthResult> {
  try {
    const client = await getCloudClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    const session = toCloudSession(data.session);
    if (error || !session) return { ok: false, error: friendlyAuthError(error?.message) };
    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err instanceof Error ? err.message : undefined) };
  }
}

export async function signUpRenter(email: string, password: string): Promise<CloudAuthResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use a password with at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  try {
    const client = await getCloudClient();
    const displayName = createDemoSession(email, "renter").displayName;
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    const session = toCloudSession(data.session);
    if (!session) {
      // Supabase has "Confirm email" on: the account exists but has no session yet.
      return {
        ok: false,
        needsConfirmation: true,
        error: "Account created. Check your email for the confirmation link, then sign in.",
      };
    }
    await client.from("renter_profiles").upsert({
      user_id: session.userId,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    });
    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err instanceof Error ? err.message : undefined) };
  }
}

export async function signOutRenter(): Promise<void> {
  const client = await getCloudClient();
  await client.auth.signOut();
}
