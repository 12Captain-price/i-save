import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { formatMoney } from "@/lib/money";
import { purposeLabel, formatDateTime } from "@/lib/staff-utils";
import { isReceiptId } from "@/lib/receipt-link";
import { useVerifyReceipt } from "@/lib/verify-receipt";

export const Route = createFileRoute("/verify/$id")({
  component: VerifyPage,
});

/** Public page behind the QR code on a receipt. It shows what is printed on the receipt
 *  (with the member's name as initials) so anyone can tell a real receipt from a fake. */
function VerifyPage() {
  const { id } = Route.useParams();
  const check = useVerifyReceipt(id);
  const valid = isReceiptId(id);

  return (
    <PageShell
      eyebrow="Receipt check"
      title="Is this receipt real?"
      lead="Compare what is shown here with the paper receipt. They must match."
    >
      {!valid && <NotFound />}
      {valid && check.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking…
        </p>
      )}
      {valid && check.isError && (
        <p role="alert" className="text-sm text-destructive">
          The check could not be done right now. Please try again in a moment.
        </p>
      )}
      {valid && check.data && !check.data.found && <NotFound />}
      {valid && check.data?.found && (
        <section
          aria-label="Receipt details"
          className="max-w-md rounded-xl border border-border bg-card p-6"
        >
          {check.data.reversed ? (
            <p
              role="status"
              className="flex items-center gap-2 font-semibold text-destructive"
            >
              <XCircle className="h-6 w-6" aria-hidden="true" />
              Reversed: this receipt is no longer valid
            </p>
          ) : (
            <p
              role="status"
              className="flex items-center gap-2 font-semibold text-primary"
            >
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              Genuine i-Save receipt
            </p>
          )}
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Receipt no.</dt>
            <dd className="text-right font-semibold">
              {check.data.receiptNumber}
            </dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd className="text-right">{formatDateTime(check.data.issuedAt)}</dd>
            <dt className="text-muted-foreground">Payment for</dt>
            <dd className="text-right">{purposeLabel(check.data.purpose)}</dd>
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="text-right font-semibold">
              {formatMoney(check.data.amount, check.data.currency)}
            </dd>
            <dt className="text-muted-foreground">Member</dt>
            <dd className="text-right">{check.data.memberInitials || "—"}</dd>
          </dl>
          <p className="mt-5 text-xs text-muted-foreground">
            Names are shown as initials to protect the member&apos;s privacy.
          </p>
        </section>
      )}
    </PageShell>
  );
}

function NotFound() {
  return (
    <div
      role="alert"
      className="max-w-md rounded-xl border border-destructive/60 p-6"
    >
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <XCircle className="h-6 w-6" aria-hidden="true" />
        No receipt found
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        This receipt is not in our records. If you were given it as proof of
        payment, please contact the office before accepting it.
      </p>
    </div>
  );
}
