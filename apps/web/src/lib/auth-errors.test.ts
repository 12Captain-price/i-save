import { describe, expect, it } from "vitest";
import { friendlyLoginError, friendlySignUpError } from "./auth-errors";

describe("friendlyLoginError", () => {
  it("does not say whether the email or the password was wrong", () => {
    expect(friendlyLoginError("Invalid login credentials")).toBe(
      "Incorrect email or password.",
    );
  });
  it("explains an unconfirmed email", () => {
    expect(friendlyLoginError("Email not confirmed")).toMatch(
      /confirm your email/i,
    );
  });
  it("handles rate limits and unknown errors", () => {
    expect(friendlyLoginError("email rate limit exceeded")).toMatch(
      /too many/i,
    );
    expect(friendlyLoginError("something odd")).toMatch(
      /could not log you in/i,
    );
  });
});

describe("friendlySignUpError", () => {
  it("does not reveal that a phone number or ID is already registered", () => {
    const text = friendlySignUpError("Database error saving new user");
    expect(text).not.toMatch(/phone|national id|duplicate|already registered/i);
  });
  it("handles password and rate-limit errors", () => {
    expect(
      friendlySignUpError("Password should be at least 6 characters"),
    ).toMatch(/password/i);
    expect(friendlySignUpError("rate limit")).toMatch(/too many/i);
  });
});
