import { describe, expect, it } from "vitest";
import {
  addDays,
  barWidth,
  cleanPath,
  isApplyHref,
  percent,
  rangeForPreset,
  shouldTrack,
  todayInHarare,
  validateRange,
} from "./traffic-utils";

describe("cleanPath and shouldTrack", () => {
  it("drops the query, the #section and a trailing slash", () => {
    expect(cleanPath("/plans/?x=1#top")).toBe("/plans");
    expect(cleanPath("/")).toBe("/");
    expect(cleanPath("")).toBe("/");
  });
  it("skips admin and sign-in screens but not look-alike public pages", () => {
    for (const p of ["/staff", "/staff/traffic", "/login", "/reset-password"]) {
      expect(shouldTrack(p), p).toBe(false);
    }
    for (const p of ["/", "/apply", "/staffing", "/plans"]) {
      expect(shouldTrack(p), p).toBe(true);
    }
  });
});

describe("isApplyHref", () => {
  it("matches links to the Apply page only", () => {
    expect(isApplyHref("/apply")).toBe(true);
    expect(isApplyHref("/apply?from=home")).toBe(true);
    expect(isApplyHref("/applying")).toBe(false);
    expect(isApplyHref("https://example.com/apply")).toBe(false);
    expect(isApplyHref(null)).toBe(false);
  });
});

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-04", -6)).toBe("2026-10-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("uses the Zimbabwe day, which starts two hours before UTC midnight", () => {
    expect(todayInHarare(new Date("2026-11-03T22:30:00Z"))).toBe("2026-11-04");
    expect(todayInHarare(new Date("2026-11-04T21:59:00Z"))).toBe("2026-11-04");
  });
  it("builds the preset ranges", () => {
    expect(rangeForPreset("7d", "2026-11-04")).toEqual({ from: "2026-10-29", to: "2026-11-04" });
    expect(rangeForPreset("30d", "2026-11-04")).toEqual({ from: "2026-10-06", to: "2026-11-04" });
    expect(rangeForPreset("month", "2026-11-04")).toEqual({ from: "2026-11-01", to: "2026-11-04" });
  });
  it("checks a custom range", () => {
    expect(validateRange("2026-10-01", "2026-11-04")).toBeNull();
    expect(validateRange("", "2026-11-04")).toBe("Choose both dates.");
    expect(validateRange("2026-11-05", "2026-11-04")).toMatch(/before/);
    expect(validateRange("2025-01-01", "2026-11-04")).toMatch(/one year/);
  });
});

describe("percent and barWidth", () => {
  it("rounds to one decimal and handles nothing to divide by", () => {
    expect(percent(1, 3)).toBe("33.3%");
    expect(percent(5, 10)).toBe("50%");
    expect(percent(3, 0)).toBe("—");
  });
  it("sizes bars against the biggest value", () => {
    expect(barWidth(50, 100)).toBe(50);
    expect(barWidth(0, 100)).toBe(0);
    expect(barWidth(1, 1000)).toBe(2);
    expect(barWidth(5, 0)).toBe(0);
  });
});
