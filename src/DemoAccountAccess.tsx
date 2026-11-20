import { useState, type FormEvent } from "react";

import type { DemoRole, DemoSession } from "./demoAccount";

export type DemoAccountMode = "sign-in" | "create-account";
export type DemoAccountSubmitPayload = { email: string; companyName?: string };

export type DemoAccountAccessProps = {
  role: DemoRole;
  mode: DemoAccountMode;
  onModeChange: (mode: DemoAccountMode) => void;
  onSubmit: (payload: DemoAccountSubmitPayload) => void;
  onCancel: () => void;
  error?: string | null;
};

export function createDemoAccountPayload(
  email: string,
  role: DemoRole,
  mode: DemoAccountMode,
  _password: string,
  companyName: string,
): DemoAccountSubmitPayload | null {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCompany = companyName.trim();
  if (!normalizedEmail || !normalizedEmail.includes("@")) return null;
  if (role === "property-manager" && mode === "create-account" && !normalizedCompany) return null;
  return {
    email: normalizedEmail,
    ...(role === "property-manager" && normalizedCompany ? { companyName: normalizedCompany } : {}),
  };
}

export function DemoAccountAccess({
  role,
  mode,
  onModeChange,
  onSubmit,
  onCancel,
  error,
}: DemoAccountAccessProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const isManager = role === "property-manager";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = createDemoAccountPayload(email, role, mode, password, companyName);
    if (!payload) {
      setValidation(
        isManager && mode === "create-account"
          ? "Enter a valid email and company name."
          : "Enter a valid email to continue.",
      );
      return;
    }
    setValidation(null);
    onSubmit(payload);
  };

  return (
    <main className="demo-access-main">
      <section className="demo-access-card">
        <div className="demo-access-copy">
          <p className="eyebrow">{isManager ? "Property-manager access" : "Renter access"}</p>
          <h1>{isManager ? "Open the property-manager demo" : "Save your rental plan"}</h1>
          <p>
            {isManager
              ? "Use a separate manager profile to explore listing tools and the free pilot journey."
              : "Use a demo renter profile to keep your apartment, roommate choice, and Advisor findings together."}
          </p>
          <div className="demo-access-disclosure" role="note">
            <strong>Demo only</strong>
            <span>
              This is not real authentication. Your email and plan stay only in this browser;
              passwords are never saved or submitted.
            </span>
          </div>
        </div>

        <form className="demo-access-form" onSubmit={submit}>
          <div className="demo-access-tabs" aria-label="Account mode">
            <button
              type="button"
              className={mode === "sign-in" ? "active" : ""}
              onClick={() => onModeChange("sign-in")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "create-account" ? "active" : ""}
              onClick={() => onModeChange("create-account")}
            >
              Create demo account
            </button>
          </div>
          {isManager && mode === "create-account" && (
            <label>
              <span>Company name</span>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                autoComplete="organization"
                required
              />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span>Demo password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              placeholder="Optional in this prototype"
            />
          </label>
          {(validation || error) && <p className="demo-access-error">{validation || error}</p>}
          <button className="btn-primary" type="submit">
            {mode === "sign-in" ? "Continue to demo" : "Create demo account"}
          </button>
          <button className="text-button secondary-text" type="button" onClick={onCancel}>
            Cancel
          </button>
        </form>
      </section>
    </main>
  );
}

export function DemoAccountMenu({
  session,
  onOpenPlan,
  onSignOut,
  onReset,
}: {
  session: DemoSession;
  onOpenPlan: () => void;
  onSignOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="demo-account-menu">
      <button className="demo-account-person" onClick={onOpenPlan}>
        <span>{session.displayName.charAt(0).toUpperCase()}</span>
        <small>{session.displayName}</small>
      </button>
      <button onClick={onSignOut}>Sign out</button>
      <button onClick={onReset}>Reset demo data</button>
    </div>
  );
}
