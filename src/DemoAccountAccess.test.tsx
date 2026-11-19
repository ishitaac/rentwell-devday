import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DemoAccountAccess,
  createDemoAccountPayload,
  type DemoAccountAccessProps,
} from "./DemoAccountAccess";

const baseProps: DemoAccountAccessProps = {
  role: "renter",
  mode: "sign-in",
  onModeChange: () => undefined,
  onSubmit: () => undefined,
  onCancel: () => undefined,
};

describe("DemoAccountAccess", () => {
  it("uses different renter and manager copy", () => {
    const renter = renderToStaticMarkup(<DemoAccountAccess {...baseProps} />);
    const manager = renderToStaticMarkup(
      <DemoAccountAccess {...baseProps} role="property-manager" />,
    );

    expect(renter).toContain("Save your rental plan");
    expect(manager).toContain("Open the property-manager demo");
  });

  it("shows company name only for manager account creation", () => {
    const renter = renderToStaticMarkup(<DemoAccountAccess {...baseProps} mode="create-account" />);
    const manager = renderToStaticMarkup(
      <DemoAccountAccess {...baseProps} role="property-manager" mode="create-account" />,
    );

    expect(renter).not.toContain("Company name");
    expect(manager).toContain("Company name");
  });

  it("blocks a payload when required fields are missing", () => {
    expect(createDemoAccountPayload("", "renter", "sign-in", "secret", "")).toBeNull();
    expect(
      createDemoAccountPayload(
        "manager@example.com",
        "property-manager",
        "create-account",
        "x",
        "",
      ),
    ).toBeNull();
  });

  it("omits password from the submit payload", () => {
    const payload = createDemoAccountPayload(
      " Renter@Example.com ",
      "renter",
      "sign-in",
      "not-stored",
      "",
    );

    expect(payload).toEqual({ email: "renter@example.com" });
    expect(payload).not.toHaveProperty("password");
  });

  it("makes the prototype limitations visible", () => {
    const html = renderToStaticMarkup(<DemoAccountAccess {...baseProps} />);

    expect(html).toContain("Demo only");
    expect(html).toContain("this browser");
    expect(html).toContain("not real authentication");
  });
});
