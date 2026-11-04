// Pure helpers for the plan descriptions and the goal planner. No database or browser code
// here, so they are easy to test.
import {
  amountPerPeriodRoundedUp,
  parseAmountInput,
  type Money,
} from "@/lib/money";

export const LONG_DESCRIPTION_MAX = 4000; // the database enforces the same limit

export function validatePlanLongDescription(input: string): string | null {
  if (input.trim().length > LONG_DESCRIPTION_MAX) {
    return `Keep the full description under ${LONG_DESCRIPTION_MAX} characters.`;
  }
  return null;
}

/** Splits the live plans into the featured goal-based plan and all the others. */
export function splitGoalPlan<T extends { isGoalBased: boolean }>(
  plans: T[],
): { goal: T | null; others: T[] } {
  const goal = plans.find((p) => p.isGoalBased) ?? null;
  return { goal, others: plans.filter((p) => p !== goal) };
}

export const MIN_GOAL_WEEKS = 1;
export const MAX_GOAL_WEEKS = 520; // ten years, same as the plan limit

export const WEEK_PRESETS = [
  { label: "6 months", weeks: 26 },
  { label: "1 year", weeks: 52 },
  { label: "2 years", weeks: 104 },
  { label: "3 years", weeks: 156 },
] as const;

export type GoalPlanResult =
  | { ok: true; target: Money; weeks: number; weekly: Money }
  | { ok: false; targetError?: string; weeksError?: string };

/**
 * The goal planner. It only divides: the target amount by the number of weeks, rounded up
 * to the next cent so the goal is always reached. It adds no interest or returns.
 */
export function planGoal(targetText: string, weeksText: string): GoalPlanResult {
  const target = parseAmountInput(targetText);
  const weeksValue = weeksText.trim();
  const weeks = /^\d{1,4}$/.test(weeksValue) ? Number(weeksValue) : NaN;

  const targetError = target.ok ? undefined : target.message;
  const weeksError =
    Number.isInteger(weeks) && weeks >= MIN_GOAL_WEEKS && weeks <= MAX_GOAL_WEEKS
      ? undefined
      : `Enter a whole number of weeks from ${MIN_GOAL_WEEKS} to ${MAX_GOAL_WEEKS}.`;

  if (!target.ok || weeksError) return { ok: false, targetError, weeksError };
  return {
    ok: true,
    target: target.value,
    weeks,
    weekly: amountPerPeriodRoundedUp(target.value, weeks),
  };
}
