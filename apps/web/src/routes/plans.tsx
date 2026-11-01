import { Link, createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { buttonVariants } from "@/components/ui/button";
import { useAvailablePlans } from "@/lib/member";
import { describeDuration, describePlanAmount } from "@/lib/plan-utils";

export const Route = createFileRoute("/plans")({
  component: PlansPage,
});

function PlansPage() {
  const plans = useAvailablePlans();
  return (
    <PageShell
      eyebrow="Savings goals"
      title="Choose a plan that fits you."
      lead="Plans are set by the organisation. You read the terms and agree to them before you join, and you pay at the office."
    >
      {plans.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading plans…
        </p>
      )}
      {plans.isError && (
        <p role="alert" className="text-sm text-destructive">
          We could not load the plans.{" "}
          <button type="button" className="underline" onClick={() => plans.refetch()}>
            Try again
          </button>
        </p>
      )}
      {plans.data && plans.data.length === 0 && (
        <p className="rounded-md border border-border bg-card p-6 text-sm">
          Savings plans are being finalised and will appear here once they are approved.
          Nothing is offered until then.
        </p>
      )}
      {plans.data && plans.data.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2">
          {plans.data.map((p) => (
            <li key={p.versionId} className="rounded-md border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">{p.planName}</h2>
              <p className="mt-3 font-display text-2xl font-semibold text-primary">
                {describePlanAmount(p)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {describeDuration(p.durationWeeks)}
                {p.durationWeeks === null ? "" : " in total"}
              </p>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-primary underline underline-offset-4">
                  Read the terms
                </summary>
                <p className="mt-2 whitespace-pre-wrap">{p.termsText}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link to="/apply" className={buttonVariants()}>
          Apply to join
        </Link>
        <p className="text-sm text-muted-foreground">
          Already a member? Log in to your account to choose a plan.
        </p>
      </div>
    </PageShell>
  );
}
