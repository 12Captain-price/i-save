import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildSeries,
  compactNumber,
  niceMax,
  sliceRange,
  summarise,
} from "./home-dashboard";

describe("addMonths", () => {
  it("crosses year ends in both directions", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-02", -3)).toBe("2025-11");
    expect(addMonths("2026-11", 0)).toBe("2026-11");
  });
});

describe("buildSeries", () => {
  const series = buildSeries("savings", "2026-11");
  it("has 11 past months, this month and 5 ahead, in order", () => {
    expect(series).toHaveLength(17);
    expect(series.filter((p) => p.phase === "past")).toHaveLength(11);
    expect(series.filter((p) => p.phase === "current")).toHaveLength(1);
    expect(series.filter((p) => p.phase === "upcoming")).toHaveLength(5);
    expect(series[0]!.key).toBe("2025-12");
    expect(series.at(-1)!.key).toBe("2027-04");
    expect(series.find((p) => p.phase === "current")!.key).toBe("2026-11");
  });
  it("gives the same numbers every time and none below zero", () => {
    expect(buildSeries("savings", "2026-11")).toEqual(series);
    expect(series.every((p) => p.value >= 0)).toBe(true);
  });
  it("labels months in full", () => {
    expect(series.find((p) => p.phase === "current")!.fullLabel).toBe("November 2026");
  });
});

describe("sliceRange", () => {
  const series = buildSeries("members", "2026-11");
  it("keeps this month in every range", () => {
    for (const r of ["6m", "12m", "all"] as const) {
      expect(sliceRange(series, r).some((p) => p.phase === "current"), r).toBe(true);
    }
  });
  it("shows 6, 12 or all months", () => {
    expect(sliceRange(series, "6m")).toHaveLength(6);
    expect(sliceRange(series, "12m")).toHaveLength(12);
    expect(sliceRange(series, "all")).toHaveLength(17);
  });
});

describe("summarise, niceMax and compactNumber", () => {
  it("separates recorded, this month and scheduled", () => {
    const s = summarise([
      { key: "a", label: "a", fullLabel: "a", value: 10, phase: "past" },
      { key: "b", label: "b", fullLabel: "b", value: 20, phase: "past" },
      { key: "c", label: "c", fullLabel: "c", value: 5, phase: "current" },
      { key: "d", label: "d", fullLabel: "d", value: 7, phase: "upcoming" },
    ]);
    expect(s).toEqual({ recorded: 30, thisMonth: 5, scheduled: 7 });
  });
  it("rounds the top of the chart up to a tidy number", () => {
    expect(niceMax(0)).toBe(10);
    expect(niceMax(13200)).toBe(20000);
    expect(niceMax(4300)).toBe(5000);
    expect(niceMax(100)).toBe(100);
  });
  it("shortens big numbers", () => {
    expect(compactNumber(950)).toBe("950");
    expect(compactNumber(12500)).toBe("12.5k");
    expect(compactNumber(2_400_000)).toBe("2.4m");
  });
});
