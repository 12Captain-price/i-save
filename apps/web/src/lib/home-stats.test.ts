import { describe, expect, it } from "vitest";
import { countAt, easeOutCubic, formatCount } from "./home-stats";

describe("count-up helpers", () => {
  it("starts at zero and always ends on the exact target", () => {
    expect(countAt(1250, 0)).toBe(0);
    expect(countAt(1250, 1)).toBe(1250);
    expect(countAt(1250, 2)).toBe(1250);
    expect(countAt(7, 1)).toBe(7);
  });
  it("only ever goes up while counting", () => {
    let last = -1;
    for (let p = 0; p <= 1; p += 0.05) {
      const v = countAt(1250, p);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
  it("eases out and stays within 0 to 1", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(5)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
  it("groups thousands with commas", () => {
    expect(formatCount(5)).toBe("5");
    expect(formatCount(1250)).toBe("1,250");
    expect(formatCount(1234567)).toBe("1,234,567");
  });
});
