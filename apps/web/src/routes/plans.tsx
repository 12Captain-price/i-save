import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, LayoutGrid, Table2 } from "lucide-react";
import { PlansCompare } from "@/components/site/PlansCompare";
import { PlanCard } from "@/components/site/PlanCard";
import { PublicLayout } from "@/components/site/PublicLayout";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGoals } from "@/lib/goal-content-db";
import { useAvailablePlans, type PlanTerms } from "@/lib/member";

type Filter = string;

function matches(plan: PlanTerms, filter: Filter, label: string): boolean {
  if (filter === "all") return true;
  if (filter === "combo") return plan.isGoalBased;
  return (
    plan.theme === filter ||
    plan.comboGoals.some((g) => g.toLowerCase() === label.toLowerCase())
  );
}

export const Route = createFileRoute("/plans")({
  validateSearch: (search: Record<string, unknown>): { goal?: Filter } => {
    const g = search.goal;
    return typeof g === "string" && /^[a-z0-9-]{2,30}$/.test(g) && g !== "all"
      ? { goal: g }
      : {};
  },
  component: PlansPage,
});

function PlansPage() {
  const plans = useAvailablePlans();
  const { goal } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [view, setView] = useState<"cards" | "table">("cards");
  const { goals } = useGoals();
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All plans" },
    ...goals.map((g) => ({ value: g.key, label: g.label })),
    { value: "combo", label: "Combo" },
  ];
  // A link to a goal that no longer exists just shows everything.
  const filter: Filter = filters.some((f) => f.value === goal) ? goal! : "all";
  const activeLabel = filters.find((f) => f.value === filter)?.label ?? "";
  const shown =
    plans.data?.filter((p) => matches(p, filter, activeLabel)) ?? [];
  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <p className="mb-3 text-[0.7rem] font-bold tracking-[0.16em] text-primary uppercase">
          Savings goals
        </p>
        <h1 className="text-4xl font-semibold md:text-5xl">
          Choose a plan that fits you.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Pick the plan that fits your goal and click its picture to see it in
          action. These plans are illustrative: your registration agent
          confirms the final amounts and terms when you apply.
        </p>

        <div
          className="mt-8 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter plans by goal"
        >
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() =>
                navigate({
                  search: f.value === "all" ? {} : { goal: f.value },
                  replace: true,
                })
              }
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                filter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary hover:text-primary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {plans.isPending && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading plans…
            </p>
          )}
          {plans.isError && (
            <p role="alert" className="text-sm text-destructive">
              We could not load the plans.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => plans.refetch()}
              >
                Try again
              </button>
            </p>
          )}
          {plans.data && plans.data.length === 0 && (
            <p className="rounded-md border border-border bg-card p-6 text-sm">
              Savings plans are being finalised and will appear here once they
              are approved. Nothing is offered until then.
            </p>
          )}

          {plans.data && plans.data.length > 0 && shown.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm">
              <p>
                There are no {activeLabel} plans yet. Check back soon, or look
                at the other goals.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-4"
                onClick={() => navigate({ search: {}, replace: true })}
              >
                Show all plans
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          )}

          {shown.length > 0 && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Showing {shown.length}{" "}
                  {filter === "all" ? "" : activeLabel + " "}
                  {shown.length === 1 ? "plan" : "plans"}
                </p>
                {shown.length > 1 && (
                  <div
                    className="inline-flex overflow-hidden rounded-md border border-border"
                    role="group"
                    aria-label="How to show the plans"
                  >
                    {(
                      [
                        ["cards", "Cards", LayoutGrid],
                        ["table", "Compare", Table2],
                      ] as const
                    ).map(([value, label, Icon]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={view === value}
                        onClick={() => setView(value)}
                        className={cn(
                          "inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold",
                          view === value
                            ? "bg-primary text-primary-foreground"
                            : "bg-card hover:text-primary",
                        )}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {view === "table" && shown.length > 1 ? (
                <PlansCompare plans={shown} />
              ) : (
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((p) => (
                    <PlanCard key={p.versionId} plan={p} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link to="/apply" className={buttonVariants()}>
            Apply to join
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
