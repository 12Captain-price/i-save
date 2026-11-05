import { describe, expect, it } from "vitest";
import { parseComboGoals, toPlanTheme, validateComboGoals } from "./plan-theme";

describe("toPlanTheme", () => {
  it("keeps a valid theme code, including goals an admin added", () => {
    expect(toPlanTheme("holiday")).toBe("holiday");
    expect(toPlanTheme("wedding-fund")).toBe("wedding-fund");
  });
  it("falls back to other for empty or malformed values", () => {
    expect(toPlanTheme("Not A Code!")).toBe("other");
    expect(toPlanTheme(null)).toBe("other");
    expect(toPlanTheme("")).toBe("other");
  });
});

describe("parseComboGoals", () => {
  it("splits on commas and new lines, trims and removes repeats", () => {
    expect(parseComboGoals(" Asset, education\nEmergency,asset ,, ")).toEqual([
      "Asset",
      "education",
      "Emergency",
    ]);
  });
  it("returns nothing for blank text", () => {
    expect(parseComboGoals("  ")).toEqual([]);
  });
});

describe("validateComboGoals", () => {
  it("accepts up to six short goals", () => {
    expect(validateComboGoals("a,b,c,d,e,f")).toBeNull();
  });
  it("refuses seven goals or a very long name", () => {
    expect(validateComboGoals("a,b,c,d,e,f,g")).toMatch(/at most 6/);
    expect(validateComboGoals("x".repeat(31))).toMatch(/under 30/);
  });
});
