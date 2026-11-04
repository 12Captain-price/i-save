import { describe, expect, it } from "vitest";
import { amountPerPeriodRoundedUp } from "./money";
import {
  planGoal,
  splitGoalPlan,
  validatePlanLongDescription,
} from "./goal-plan-utils";

describe("amountPerPeriodRoundedUp", () => {
  it("divides evenly when it can", () => {
    expect(amountPerPeriodRoundedUp("1040.00", 52)).toBe("20.00");
  });
  it("rounds up to the next cent so the goal is always reached", () => {
    expect(amountPerPeriodRoundedUp("100.00", 3)).toBe("33.34");
    expect(amountPerPeriodRoundedUp("1000.00", 52)).toBe("19.24");
  });
});

describe("planGoal", () => {
  it("works out the weekly amount", () => {
    expect(planGoal("2,600", "52")).toEqual({
      ok: true,
      target: "2600.00",
      weeks: 52,
      weekly: "50.00",
    });
  });
  it("reports each bad field separately", () => {
    const r = planGoal("abc", "0");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.targetError).toBeTruthy();
      expect(r.weeksError).toBeTruthy();
    }
  });
  it("refuses part weeks, negatives and more than ten years", () => {
    for (const weeks of ["1.5", "-4", "521", "", "x"]) {
      const r = planGoal("500", weeks);
      expect(r.ok, weeks).toBe(false);
    }
    expect(planGoal("500", "520").ok).toBe(true);
    expect(planGoal("500", "1").ok).toBe(true);
  });
  it("refuses a zero or missing target", () => {
    expect(planGoal("0", "52").ok).toBe(false);
    expect(planGoal("", "52").ok).toBe(false);
  });
});

describe("splitGoalPlan and the description limit", () => {
  it("separates the goal-based plan from the rest", () => {
    const plans = [
      { name: "A", isGoalBased: false },
      { name: "B", isGoalBased: true },
      { name: "C", isGoalBased: false },
    ];
    const { goal, others } = splitGoalPlan(plans);
    expect(goal?.name).toBe("B");
    expect(others.map((p) => p.name)).toEqual(["A", "C"]);
  });
  it("returns no goal plan when none is marked", () => {
    expect(splitGoalPlan([{ isGoalBased: false }]).goal).toBeNull();
  });
  it("limits the full description to 4000 characters", () => {
    expect(validatePlanLongDescription("x".repeat(4000))).toBeNull();
    expect(validatePlanLongDescription("x".repeat(4001))).toMatch(/4000/);
  });
});
