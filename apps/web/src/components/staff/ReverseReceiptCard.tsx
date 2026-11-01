import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import { reversePayment, type ReceiptDetail } from "@/lib/staff";
import {
  purposeLabel,
  reversalConsequences,
  staffErrorMessage,
  validateReversalReason,
} from "@/lib/staff-utils";

type Step = "closed" | "form" | "review" | "done";

/**
 * Reverse a payment that was recorded by mistake. Two steps (reason, then confirm) so it can
 * not happen by a stray click. Nothing is deleted: the receipt stays, marked as reversed.
 */
export function ReverseReceiptCard({ receipt }: { receipt: ReceiptDetail }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("closed");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  if (receipt.reversed && step !== "done") return null;

  const amount = formatMoney(receipt.amount, receipt.currency);

  function review() {
    const problem = validateReversalReason(reason);
    setReasonError(problem ?? undefined);
    if (!problem) {
      setFailure(undefined);
      setStep("review");
    }
  }

  async function confirm() {
    setBusy(true);
    setFailure(undefined);
    try {
      await reversePayment(receipt.ledgerId, reason);
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      setStep("done");
    } catch (error) {
      setFailure(staffErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const heading = (
    <h2 id="reverse-heading" className="text-lg font-semibold">
      Reverse this payment
    </h2>
  );

  if (step === "done") {
    return (
      <section
        aria-labelledby="reverse-heading"
        className="rounded-md border border-border bg-card p-6 print:hidden"
      >
        {heading}
        <p role="status" className="mt-3 text-sm font-semibold text-primary">
          Payment reversed. Receipt {receipt.receiptNumber} is now marked as
          reversed.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Take back the paper receipt if you can, and write “reversed” on it. If
          the payment should have been recorded differently, record it again
          from the member’s page with a new book number.
        </p>
      </section>
    );
  }

  if (step === "closed") {
    return (
      <section
        aria-labelledby="reverse-heading"
        className="rounded-md border border-border bg-card p-6 print:hidden"
      >
        {heading}
        <p className="mt-2 text-sm text-muted-foreground">
          Use this only for a payment recorded by mistake, such as the wrong
          amount or the wrong member. It is kept on record and cannot be undone.
        </p>
        <div className="mt-4">
          <Button variant="outline" onClick={() => setStep("form")}>
            Reverse this payment
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="reverse-heading"
      className="rounded-md border border-destructive/50 bg-card p-6 print:hidden"
    >
      {heading}
      <p className="mt-2 text-sm">
        {purposeLabel(receipt.purpose)}, {amount}, {receipt.receiptNumber}
      </p>

      {step === "form" && (
        <div className="mt-4 grid gap-4">
          <div>
            <label
              htmlFor="reverse-reason"
              className="mb-1.5 block text-sm font-medium"
            >
              Why is this payment being reversed?
            </label>
            <textarea
              id="reverse-reason"
              rows={3}
              maxLength={300}
              className={inputClass}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={
                reasonError ? "reverse-reason-error" : undefined
              }
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              For example: “Entered against the wrong member”. The member can be
              told this reason, and it is saved in the audit log.
            </p>
            {reasonError && (
              <p
                id="reverse-reason-error"
                role="alert"
                className="mt-1.5 text-xs text-destructive"
              >
                {reasonError}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={review}>Review reversal</Button>
            <Button variant="ghost" onClick={() => setStep("closed")}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="mt-4 grid gap-4 text-sm">
          <dl className="grid gap-1">
            <dt className="text-xs font-semibold text-muted-foreground uppercase">
              Reason
            </dt>
            <dd>{reason.trim()}</dd>
          </dl>
          <div>
            <p className="font-semibold">If you confirm:</p>
            <ul className="mt-1 list-disc pl-5">
              {reversalConsequences(receipt.purpose).map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>The receipt stays on record, marked as reversed.</li>
              <li>The member is notified. This cannot be undone.</li>
            </ul>
          </div>
          {failure && (
            <p role="alert" className="text-destructive">
              {failure}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              {busy ? "Reversing…" : "Confirm reversal"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setStep("form")}
              disabled={busy}
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
