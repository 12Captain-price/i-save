import { Link, createFileRoute } from "@tanstack/react-router";
import { PlanCard } from "@/components/site/PlanCard";
import { PublicLayout } from "@/components/site/PublicLayout";
import { buttonVariants } from "@/components/ui/button";
import { useAvailablePlans } from "@/lib/member";

export const Route = createFileRoute("/plans")({
  component: PlansPage,
});

function PlansPage() {
  const plans = useAvailablePlans();
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
          Pick the plan that fits your goal and click it to see it in action.
          These plans are illustrative: your registration agent confirms the
          final amounts and terms when you apply.
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

          {plans.data && plans.data.length > 0 && (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.data.map((p) => (
                <PlanCard key={p.versionId} plan={p} />
              ))}
            </ul>
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
