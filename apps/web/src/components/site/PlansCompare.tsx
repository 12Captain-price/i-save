import type { PlanTerms } from "@/lib/member";
import { describeDuration, describePlanAmount } from "@/lib/plan-utils";

const FREQUENCY: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

/** The plans side by side in a table. On a phone it scrolls sideways with the plan name pinned. */
export function PlansCompare({ plans }: { plans: PlanTerms[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <caption className="sr-only">Savings plans side by side</caption>
        <thead>
          <tr className="bg-muted/50">
            <th scope="col" className="sticky left-0 bg-muted px-4 py-3 font-semibold">
              Plan
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              You pay
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              How often
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Length
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Goals
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.versionId} className="border-t border-border align-top">
              <th
                scope="row"
                className="sticky left-0 bg-card px-4 py-3 font-semibold"
              >
                {p.planName}
                {p.isGoalBased && (
                  <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-primary uppercase">
                    Combo
                  </span>
                )}
              </th>
              <td className="px-4 py-3 font-semibold text-primary">
                {describePlanAmount(p)}
              </td>
              <td className="px-4 py-3">
                {FREQUENCY[p.frequency] ?? p.frequency}
              </td>
              <td className="px-4 py-3">{describeDuration(p.durationWeeks)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.comboGoals.length > 0 ? p.comboGoals.join(", ") : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
