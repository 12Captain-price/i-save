import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { formatMoney } from "@/lib/money";
import { usePublicFees } from "@/lib/public-fees";
import type { Fee } from "@/lib/fee-setting";

export const Route = createFileRoute("/fees")({
  component: FeesPage,
});

function FeeCard({
  title,
  description,
  fee,
  suffix,
  loading,
}: {
  title: string;
  description: string;
  fee: Fee | null | undefined;
  suffix: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-6">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <p className="mt-3 font-display text-4xl font-semibold text-primary">
        {fee
          ? formatMoney(fee.amount, fee.currency)
          : loading
            ? "…"
            : "To be confirmed"}
        {fee && (
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function FeesPage() {
  const { data, isPending, isError, refetch } = usePublicFees();
  return (
    <PageShell
      eyebrow="Fees"
      title="Fees and office payments."
      lead="Fees keep the organisation running. They are always shown separately from your savings."
    >
      {isError && (
        <p role="alert" className="mb-6 text-sm text-destructive">
          We could not load the current fees.{" "}
          <button type="button" className="underline" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <FeeCard
          title="Registration fee"
          fee={data?.registration}
          suffix="one time"
          loading={isPending}
          description="Paid once when you join. A confirmed registration fee activates your account."
        />
        <FeeCard
          title="Monthly subscription"
          fee={data?.subscription}
          suffix="per month"
          loading={isPending}
          description="Covers your membership. When billing starts and the due date are still being confirmed."
        />
      </div>

      <h2 className="mt-14 text-2xl font-semibold">How payments work</h2>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2">
        {[
          [
            "Pay at the office.",
            "Staff record your payment and confirm it straight away. There is no online payment yet.",
          ],
          [
            "Always get a receipt.",
            "Every confirmed payment has a numbered receipt, and you can see it in your history.",
          ],
          [
            "Fees never count as savings.",
            "Registration and subscription fees do not add to your savings balance.",
          ],
          ["Currency.", "Payments are in US dollars for now."],
        ].map(([title, text]) => (
          <li key={title} className="border-l border-border pl-5">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-muted-foreground">
        Savings plan amounts are shown on the savings goals page once the
        organisation approves them.
      </p>
    </PageShell>
  );
}
