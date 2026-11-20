import { useId, useRef, useState, type FormEvent } from "react";

import {
  DEMO_MANAGER_EMAIL,
  DEMO_MANAGER_PASSWORD,
  validateLogin,
  type LoginField,
} from "./auth";

const LOGIN_IMAGE = "/listings/interior-warm.jpg";

type LoginError = { field: LoginField; message: string };

export function ManagerLogin({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const emailInvalid = error?.field === "email";
  const passwordInvalid = error?.field === "password" || error?.field === "form";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateLogin(email, password);
    if (result.ok) {
      setError(null);
      onSignedIn(result.email);
      return;
    }
    setError({ field: result.field, message: result.message });
    (result.field === "email" ? emailRef : passwordRef).current?.focus();
  };

  const fillDemoCredentials = () => {
    setEmail(DEMO_MANAGER_EMAIL);
    setPassword(DEMO_MANAGER_PASSWORD);
    setError(null);
  };

  return (
    <main className="mgr-login">
      <section className="mgr-login-intro">
        <span className="mgr-kicker">For property managers</span>
        <h1>
          Keep every listing <span>clear and current.</span>
        </h1>
        <p>
          Sign in to edit rent, mandatory fees and availability, then preview exactly what renters
          see before it goes live.
        </p>
        <ul className="mgr-login-points">
          <li>Edit rent, fees, amenities and move-in dates</li>
          <li>See the renter-facing Decision Receipt update as you type</li>
          <li>Try the simulated import from property-management software</li>
        </ul>
        <img
          className="mgr-login-image"
          src={LOGIN_IMAGE}
          alt="Sunlit living room from a demo listing"
        />
      </section>

      <section className="mgr-login-card" aria-labelledby="mgr-login-title">
        <h2 id="mgr-login-title">Sign in to your workspace</h2>
        <p className="mgr-login-sub">Demo sign-in. There are no real accounts or real data.</p>

        <form onSubmit={submit} noValidate>
          <div className="mgr-field">
            <label htmlFor="mgr-email">Work email</label>
            <input
              id="mgr-email"
              ref={emailRef}
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={emailInvalid}
              aria-describedby={emailInvalid ? errorId : undefined}
            />
          </div>

          <div className="mgr-field">
            <label htmlFor="mgr-password">Password</label>
            <div className="mgr-password-row">
              <input
                id="mgr-password"
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={passwordInvalid}
                aria-describedby={passwordInvalid ? errorId : undefined}
              />
              <button
                type="button"
                className="mgr-show-password"
                onClick={() => setShowPassword((current) => !current)}
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <p id={errorId} className="mgr-error" role="alert">
            {error?.message}
          </p>

          <button type="submit" className="btn-primary mgr-submit">
            Sign in
          </button>
        </form>

        <div className="mgr-demo-box">
          <strong>Demo account</strong>
          <dl>
            <dt>Email</dt>
            <dd>
              <code>{DEMO_MANAGER_EMAIL}</code>
            </dd>
            <dt>Password</dt>
            <dd>
              <code>{DEMO_MANAGER_PASSWORD}</code>
            </dd>
          </dl>
          <button type="button" className="btn-secondary mgr-fill" onClick={fillDemoCredentials}>
            Fill demo credentials
          </button>
        </div>
      </section>
    </main>
  );
}
