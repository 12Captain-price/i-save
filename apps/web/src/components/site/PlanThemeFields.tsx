import { Field, inputClass } from "@/components/ui/field";
import { PLAN_THEMES, type PlanTheme } from "@/lib/plan-theme";

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
  return (
    <>
      <div>
        <label
          htmlFor={`${idPrefix}-theme`}
          className="mb-1.5 block text-sm font-medium"
        >
          Animation theme
        </label>
        <select
          id={`${idPrefix}-theme`}
          value={theme}
          onChange={(e) => onTheme(e.target.value as PlanTheme)}
          className={inputClass}
        >
          {PLAN_THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          The short animation that plays when a visitor clicks this plan.
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
