import { Field, inputClass } from "@/components/ui/field";
import { useGoals } from "@/lib/goal-content-db";
import type { PlanTheme } from "@/lib/plan-theme";

/** The animation theme and the combo goal chips for a plan. */
export function PlanThemeFields({
  idPrefix,
  theme,
  onTheme,
  goals,
  onGoals,
  goalsError,
}: {
  idPrefix: string;
  theme: PlanTheme;
  onTheme: (t: PlanTheme) => void;
  goals: string;
  onGoals: (v: string) => void;
  goalsError?: string;
}) {
  const { goals: goalList } = useGoals(true);
  const options: { value: string; label: string }[] = [
    ...goalList.map((g) => ({ value: g.key, label: g.label })),
    { value: "combo", label: "Combo" },
    { value: "other", label: "Other" },
  ];
  // Keep the plan's current theme selectable even if its goal was deleted.
  if (!options.some((o) => o.value === theme))
    options.unshift({ value: theme, label: theme });
  return (
    <>
      <div>
        <label
          htmlFor={`${idPrefix}-theme`}
          className="mb-1.5 block text-sm font-medium"
        >
          Goal / theme
        </label>
        <select
          id={`${idPrefix}-theme`}
          value={theme}
          onChange={(e) => onTheme(e.target.value as PlanTheme)}
          className={inputClass}
        >
          {options.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          The savings goal this plan belongs to. It decides the short animation
          that plays when a visitor clicks the plan, and which goal filter on the
          Plans page lists it.
        </p>
      </div>
      <Field
        id={`${idPrefix}-goals`}
        label="Combo goals (optional)"
        value={goals}
        error={goalsError}
        hint="Goal names shown as small chips, separated by commas. For example: Asset, Education, Emergency."
        onChange={(e) => onGoals(e.target.value)}
      />
    </>
  );
}
