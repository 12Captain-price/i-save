import { describe, expect, it } from "vitest";
import {
  daysBetween,
  dueBucket,
  dueWording,
  todayInZimbabwe,
} from "./due-dates";

describe("todayInZimbabwe", () => {
  it("uses Zimbabwe time, which is two hours ahead of UTC", () => {
    expect(todayInZimbabwe(new Date("2026-11-03T23:30:00Z"))).toBe("2026-11-04");
    expect(todayInZimbabwe(new Date("2026-11-03T10:00:00Z"))).toBe("2026-11-03");
  });
});

describe("daysBetween", () => {
  it("counts calendar days across month ends", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(daysBetween("2026-11-02", "2026-10-30")).toBe(-3);
    expect(daysBetween("2026-11-03", "2026-11-03")).toBe(0);
  });
});

describe("dueBucket and dueWording", () => {
  const today = "2026-11-03";
  it.each([
    ["2026-11-02", "overdue", "1 day overdue"],
    ["2026-10-28", "overdue", "6 days overdue"],
    ["2026-11-03", "week", "due today"],
    ["2026-11-04", "week", "due tomorrow"],
    ["2026-11-10", "week", "due in 7 days"],
    ["2026-11-11", "month", "due in 8 days"],
    ["2026-12-03", "month", "due in 30 days"],
    ["2026-12-04", "later", "due in 31 days"],
  ])("%s", (day, bucket, words) => {
    expect(dueBucket(day, today)).toBe(bucket);
    expect(dueWording(day, today)).toBe(words);
  });
});
