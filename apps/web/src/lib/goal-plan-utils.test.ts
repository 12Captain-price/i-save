import { describe, expect, it } from "vitest";
import { amountPerPeriodRoundedUp } from "./money";
import { validatePlanLongDescription } from "./goal-plan-utils";

describe("amountPerPeriodRoundedUp", () => {
  it("divides evenly when it can", () => {
    expect(amountPerPeriodRoundedUp("1040.00", 52)).toBe("20.00");
  });
  it("rounds up to the next cent so the goal is always reached", () => {
    expect(amountPerPeriodRoundedUp("100.00", 3)).toBe("33.34");
    expect(amountPerPeriodRoundedUp("1000.00", 52)).toBe("19.24");
  });
});

describe("the description limit", () => {
  it("limits the full description to 4000 characters", () => {
    expect(validatePlanLongDescription("x".repeat(4000))).toBeNull();
    expect(validatePlanLongDescription("x".repeat(4001))).toMatch(/4000/);
  });
});
