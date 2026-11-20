import type { Session } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DemoAccountAccess, type DemoAccountAccessProps } from "../DemoAccountAccess";
import { Intro } from "../walkthrough/Intro";
import { friendlyAuthError, toCloudSession } from "./auth";
import { isCloudAccountsEnabled } from "./client";
import type { SavedWalkthrough } from "./walkthroughs";

const cloudProps: DemoAccountAccessProps = {
  role: "renter",
  mode: "sign-in",
  onModeChange: () => undefined,
  onSubmit: () => undefined,
  onCancel: () => undefined,
  cloud: { onSubmit: () => undefined, busy: false },
};

function fakeSession(email: string | undefined, displayName?: string): Session {
  return {
    user: {
      id: "user-123",
      email,
      user_metadata: displayName ? { display_name: displayName } : {},
    },
  } as unknown as Session;
}

describe("cloud accounts", () => {
  it("stays off without Supabase settings (tests run with none)", () => {
    expect(isCloudAccountsEnabled()).toBe(false);
  });

  it("maps a Supabase session to a renter session keyed by user id", () => {
    expect(toCloudSession(fakeSession("Olena.G@Example.com"))).toEqual({
      role: "renter",
      email: "olena.g@example.com",
      displayName: "Olena G",
      userId: "user-123",
    });
    expect(toCloudSession(fakeSession("a@b.co", "  Olena  "))?.displayName).toBe("Olena");
    expect(toCloudSession(fakeSession(undefined))).toBeNull();
    expect(toCloudSession(null)).toBeNull();
  });

  it("turns Supabase errors into plain language", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe("Email or password is incorrect.");
    expect(friendlyAuthError("Email not confirmed")).toContain("Confirm your email");
    expect(friendlyAuthError("User already registered")).toContain("Sign in instead");
    expect(friendlyAuthError("Failed to fetch")).toContain("connection");
    expect(friendlyAuthError(undefined)).toBe("Sign-in didn't work. Try again.");
  });

  it("shows a real sign-in form, not the demo disclaimer", () => {
    const html = renderToStaticMarkup(<DemoAccountAccess {...cloudProps} />);
    expect(html).toContain("Welcome back");
    expect(html).toContain("Supabase Auth");
    expect(html).not.toContain("Demo only");
    expect(html).toMatch(/type="password"[^>]*required/);
    expect(html).not.toContain("Quick sign-in");
  });

  it("offers one-click sign-in only when demo credentials are configured", () => {
    const html = renderToStaticMarkup(
      <DemoAccountAccess
        {...cloudProps}
        cloud={{
          ...cloudProps.cloud!,
          quickLogin: { email: "demo@x.co", password: "pw-12345678" },
        }}
      />,
    );
    expect(html).toContain("Quick sign-in as demo renter");
    expect(html).not.toContain("pw-12345678");
  });

  it("lists saved walkthroughs for a signed-in renter", () => {
    const saved: SavedWalkthrough[] = [
      {
        id: "w1",
        storagePath: "user-123/w1.zip",
        rentalName: "Maple Court 2B",
        unitType: "apartment",
        photoCount: 6,
        isSample: false,
        recordedAt: "2026-11-20T15:00:00Z",
        createdAt: "2026-11-20T15:01:00Z",
      },
    ];
    const noop = () => undefined;
    const html = renderToStaticMarkup(
      <Intro
        rental={null}
        error={null}
        onStart={noop}
        onDemo={noop}
        onSample={noop}
        onOpenRecord={noop}
        account={{ displayName: "Olena" }}
        saved={saved}
      />,
    );
    expect(html).toContain("Your saved walkthroughs");
    expect(html).toContain("Maple Court 2B");
    expect(html).toContain("6 photos");
    expect(html).not.toContain("Nothing is uploaded");
  });
});
