import { describe, expect, it } from "vitest";
import { matchesQuery, yearOf, yearsOf } from "./list-filter";

describe("list filter", () => {
  it("matches when every word is found, in any order and case", () => {
    expect(matchesQuery(["Annual General Meeting", "Held in Bulawayo"], "bulawayo meeting")).toBe(true);
    expect(matchesQuery(["Annual General Meeting"], "agm")).toBe(false);
  });
  it("matches everything for an empty search and ignores empty fields", () => {
    expect(matchesQuery([null, undefined, "x"], "   ")).toBe(true);
    expect(matchesQuery([null, undefined], "x")).toBe(false);
  });
  it("lists years newest first without repeats", () => {
    expect(yearOf("2026-11-09T10:00:00Z")).toBe("2026");
    expect(yearsOf(["2025-01-01", "2026-05-05", "2025-12-31"])).toEqual(["2026", "2025"]);
  });
});
