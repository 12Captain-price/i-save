// Pure helpers for a plan's theme and combo goals. No database or browser code.

export const PLAN_THEMES = [
  { value: "holiday", label: "Holiday" },
  { value: "asset", label: "Asset" },
  { value: "emergency", label: "Emergency" },
  { value: "retrenchment", label: "Retrenchment" },
  { value: "education", label: "Education" },
  { value: "combo", label: "Combo" },
  { value: "other", label: "Other" },
] as const;

/**
 * A plan's theme is "combo", "other", or the short code of a savings goal (for example "asset" or
 * a goal an admin added). Goals the built-in animations do not know get the generic animation.
 */
export type PlanTheme = string;

const THEME_CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function toPlanTheme(value: string | null | undefined): PlanTheme {
  return value && value.length <= 30 && THEME_CODE.test(value) ? value : "other";
}

export const MAX_COMBO_GOALS = 6;
export const MAX_GOAL_NAME_LENGTH = 30;

/** "Asset, Education\nEmergency" becomes ["Asset", "Education", "Emergency"]. */
export function parseComboGoals(text: string): string[] {
  const seen = new Set<string>();
  const goals: string[] = [];
  for (const part of text.split(/[,\n]/)) {
    const name = part.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    goals.push(name);
  }
  return goals;
}

export function validateComboGoals(text: string): string | null {
  const goals = parseComboGoals(text);
  if (goals.length > MAX_COMBO_GOALS) {
    return `Use at most ${MAX_COMBO_GOALS} goals.`;
  }
  if (goals.some((g) => g.length > MAX_GOAL_NAME_LENGTH)) {
    return `Keep each goal name under ${MAX_GOAL_NAME_LENGTH} characters.`;
  }
  return null;
}
