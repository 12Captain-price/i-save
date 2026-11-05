import { describe, expect, it } from "vitest";
import type { TrafficSummaryData } from "./traffic";
import {
  buildReport,
  changeBetween,
  daysInRange,
  describeChange,
  formatDay,
  formatRange,
  pageName,
  previousRange,
} from "./traffic-report";

const data = (over: Partial<TrafficSummaryData> = {}): TrafficSummaryData => ({
  totals: {
    page_views: 54,
    visitors: 5,
    apply_clicks: 4,
    agent_clicks: 3,
    apply_page_views: 4,
  },
  pages: [
    { path: "/", views: 30, visitors: 5 },
    { path: "/apply", views: 4, visitors: 3 },
  ],
  agents: [
    { agent_id: "a", name: "Tendai", removed: false, clicks: 2, visitors: 2 },
    { agent_id: "b", name: "Rudo", removed: false, clicks: 1, visitors: 1 },
    { agent_id: "c", name: "Farai", removed: false, clicks: 0, visitors: 0 },
  ],
  daily: [
    { day: "2026-11-02", views: 4, apply_clicks: 0, agent_clicks: 0 },
    { day: "2026-11-03", views: 0, apply_clicks: 0, agent_clicks: 0 },
    { day: "2026-11-04", views: 50, apply_clicks: 4, agent_clicks: 3 },
  ],
  ...over,
});

describe("ranges", () => {
  it("counts days inclusively and finds the period before", () => {
    expect(daysInRange("2026-11-01", "2026-11-07")).toBe(7);
    expect(previousRange("2026-11-08", "2026-11-14")).toEqual({
      from: "2026-11-01",
      to: "2026-11-07",
    });
  });
  it("formats days and ranges", () => {
    expect(formatDay("2026-11-04")).toBe("Wed 4 Nov");
    expect(formatRange("2026-11-01", "2026-11-07")).toBe("1 Nov to 7 Nov 2026");
    expect(formatRange("2025-12-28", "2026-01-03")).toBe(
      "28 Dec 2025 to 3 Jan 2026",
    );
    expect(formatRange("2026-11-04", "2026-11-04")).toBe("4 Nov 2026");
  });
});

describe("changeBetween", () => {
  it("describes growth, decline and no comparison", () => {
    expect(describeChange(changeBetween(12, 10))).toBe("up 20%");
    expect(describeChange(changeBetween(9, 10))).toBe("down 10%");
    expect(describeChange(changeBetween(10, 10))).toBe("unchanged");
    expect(describeChange(changeBetween(5, 0))).toBe("new this period");
    expect(describeChange(changeBetween(0, 0))).toBe("unchanged");
  });
});

describe("pageName", () => {
  it("uses friendly names", () => {
    expect(pageName("/")).toBe("Home page");
    expect(pageName("/events/abc")).toBe("An event page");
    expect(pageName("/odd")).toBe("/odd");
  });
});

describe("buildReport", () => {
  it("summarises a period against the one before", () => {
    const prev = data({
      totals: { ...data().totals, page_views: 27 },
    });
    const r = buildReport(data(), prev, "2026-11-02", "2026-11-04");
    expect(r.headline).toContain("54 page views from 5 visitors");
    expect(r.headline).toContain("up 100%");
    expect(r.busiestDays[0]).toEqual({ label: "Wed 4 Nov", views: 50 });
    expect(r.quietDays).toBe(1);
    expect(r.weekdays).toBeNull(); // under 7 days
    expect(r.funnel.map((s) => s.keptFromPrevious)).toEqual([
      null,
      "80%",
      "100%",
      "75%",
    ]);
    expect(r.highlights.join(" ")).toContain("Tendai got the most");
    expect(r.highlights.join(" ")).toContain("1 agent got no clicks");
  });
  it("handles a period with no traffic", () => {
    const empty = data({
      totals: {
        page_views: 0,
        visitors: 0,
        apply_clicks: 0,
        agent_clicks: 0,
        apply_page_views: 0,
      },
      pages: [],
      agents: [],
      daily: [],
    });
    const r = buildReport(empty, null, "2026-11-01", "2026-11-07");
    expect(r.hasTraffic).toBe(false);
    expect(r.headline).toContain("No one visited");
    expect(r.highlights).toEqual([]);
  });
});
