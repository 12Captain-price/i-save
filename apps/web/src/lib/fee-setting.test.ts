import { describe, expect, it } from "vitest";
import { parseFeeSetting } from "./fee-setting";

describe("parseFeeSetting", () => {
  it("reads a valid fee", () => {
    expect(parseFeeSetting({ amount: "20.00", currency: "USD" })).toEqual({
      amount: "20.00",
      currency: "USD",
    });
  });

  it("returns null for a missing or non-object value", () => {
    expect(parseFeeSetting(null)).toBeNull();
    expect(parseFeeSetting("20.00")).toBeNull();
    expect(parseFeeSetting(undefined)).toBeNull();
  });

  it("returns null when the amount is not a clean 2-decimal amount", () => {
    expect(parseFeeSetting({ amount: "20.555", currency: "USD" })).toBeNull();
    expect(parseFeeSetting({ amount: "abc", currency: "USD" })).toBeNull();
  });

  it("returns null when the currency is missing", () => {
    expect(parseFeeSetting({ amount: "20.00" })).toBeNull();
    expect(parseFeeSetting({ amount: "20.00", currency: "" })).toBeNull();
  });

  it("returns null when the amount is a number rather than text", () => {
    expect(parseFeeSetting({ amount: 20, currency: "USD" })).toBeNull();
  });
});
