import { Link, createFileRoute } from "@tanstack/react-router";
import { GoalPlanShowcase } from "@/components/site/GoalPlanShowcase";
import { PublicLayout } from "@/components/site/PublicLayout";
import { RichText } from "@/components/site/RichText";
import { buttonVariants } from "@/components/ui/button";
import { splitGoalPlan } from "@/lib/goal-plan-utils";
import { useAvailablePlans } from "@/lib/member";
import { describeDuration, describePlanAmount } from "@/lib/plan-utils";

export const Route = createFileRoute("/plans")({
  component: PlansPage,
});

function PlansPage() {
  const plans = useAvailablePlans();
  const { goal, others } = splitGoalPlan(plans.data ?? []);
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
          Plans are set by the organisation. You read the terms and agree to
          them before you join, and you pay at the office.
        </p>

        <div className="mt-10">
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

          {goal && <GoalPlanShowcase plan={goal} />}

          {others.length > 0 && (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((p) => (
                <li
                  key={p.versionId}
                  className="rounded-md border border-border bg-card p-6"
                >
                  <h2 className="text-lg font-semibold">{p.planName}</h2>
                  {p.planDescription && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.planDescription}
                    </p>
                  )}
                  <p className="mt-3 font-display text-2xl font-semibold text-primary">
                    {describePlanAmount(p)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {describeDuration(p.durationWeeks)}
                    {p.durationWeeks === null ? "" : " in total"}
                  </p>
                  {p.planLongDescription && (
                    <details className="mt-4 text-sm">
                      <summary className="cursor-pointer text-primary underline underline-offset-4">
                        About this plan
                      </summary>
                      <RichText
                        text={p.planLongDescription}
                        className="mt-2 space-y-3 text-sm"
                      />
                    </details>
                  )}
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-primary underline underline-offset-4">
                      Read the terms
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap">{p.termsText}</p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link to="/apply" className={buttonVariants()}>
            Apply to join
          </Link>
          <p className="text-sm text-muted-foreground">
            Already a member? Log in to your account to choose a plan.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
