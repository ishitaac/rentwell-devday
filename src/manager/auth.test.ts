import { describe, expect, it } from "vitest";

import {
  DEMO_MANAGER_EMAIL,
  DEMO_MANAGER_PASSWORD,
  SESSION_KEY,
  clearSession,
  readSession,
  validateLogin,
  writeSession,
} from "./auth";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

describe("validateLogin", () => {
  it("accepts the demo account, ignoring email case and surrounding spaces", () => {
    expect(validateLogin(`  ${DEMO_MANAGER_EMAIL.toUpperCase()} `, DEMO_MANAGER_PASSWORD)).toEqual({
      ok: true,
      email: DEMO_MANAGER_EMAIL,
    });
  });

  it.each([
    ["", "x", "email", "Enter your work email."],
    ["not-an-email", "x", "email", "Enter a valid email address."],
    [DEMO_MANAGER_EMAIL, "", "password", "Enter your password."],
  ] as const)("rejects %j / %j with a %s message", (email, password, field, message) => {
    expect(validateLogin(email, password)).toEqual({ ok: false, field, message });
  });

  it("rejects wrong credentials without saying which part was wrong", () => {
    const wrongPassword = validateLogin(DEMO_MANAGER_EMAIL, "nope");
    const wrongEmail = validateLogin("someone@else.com", DEMO_MANAGER_PASSWORD);

    expect(wrongPassword).toMatchObject({ ok: false, field: "form" });
    expect(wrongEmail).toEqual(wrongPassword);
  });

  it("treats the password as case-sensitive", () => {
    expect(validateLogin(DEMO_MANAGER_EMAIL, DEMO_MANAGER_PASSWORD.toLowerCase())).toMatchObject({
      ok: false,
    });
  });
});

describe("demo session", () => {
  it("round-trips and clears a signed-in session", () => {
    const storage = memoryStorage();

    expect(readSession(storage)).toBeNull();
    writeSession(DEMO_MANAGER_EMAIL, storage);
    expect(readSession(storage)).toBe(DEMO_MANAGER_EMAIL);
    clearSession(storage);
    expect(readSession(storage)).toBeNull();
  });

  it("ignores a stored value that is not the demo account", () => {
    const storage = memoryStorage();
    storage.setItem(SESSION_KEY, "attacker@example.com");

    expect(readSession(storage)).toBeNull();
  });

  it("does not throw when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readSession(blocked)).toBeNull();
    expect(() => writeSession(DEMO_MANAGER_EMAIL, blocked)).not.toThrow();
    expect(() => clearSession(blocked)).not.toThrow();
  });
});
