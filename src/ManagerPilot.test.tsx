import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ManagerPilot } from "./ManagerPilot";
import { loadManagerPilot, saveManagerPilot, type StorageLike } from "./demoAccount";
import { getManagerStage } from "./manager/ManagerApp";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("ManagerPilot", () => {
  it("shows a no-payment free-pilot offer without invented pricing", () => {
    const html = renderToStaticMarkup(
      <ManagerPilot
        companyName="Wasatch Homes"
        onStartPilot={() => undefined}
        onRequestDemo={() => undefined}
        onSignOut={() => undefined}
      />,
    );

    expect(html).toContain("Start free pilot");
    expect(html).toContain("Request a demo");
    expect(html).toContain("No payment collected in this prototype");
    expect(html).toContain("Subscription pricing has not been finalized");
    expect(html).not.toMatch(/\$\d/);
  });

  it("records start-pilot and request-demo as separate local choices", () => {
    const storage = new MemoryStorage();

    saveManagerPilot(storage, "started");
    expect(loadManagerPilot(storage)).toEqual({ ok: true, value: "started" });
    saveManagerPilot(storage, "requested");
    expect(loadManagerPilot(storage)).toEqual({ ok: true, value: "requested" });
  });

  it("keeps login, pilot onboarding, and workspace as separate manager stages", () => {
    expect(getManagerStage(null, "started")).toBe("login");
    expect(getManagerStage("manager@rentwell.demo", null)).toBe("pilot");
    expect(getManagerStage("manager@rentwell.demo", "requested")).toBe("workspace");
  });
});
