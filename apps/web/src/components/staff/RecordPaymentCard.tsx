import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import {
  compareMoney,
  formatMoney,
  parseAmountInput,
  type Money,
} from "@/lib/money";
import type { PublicFees } from "@/lib/public-fees";
import {
  recordOfficePayment,
  type DueItem,
  type MemberDetail,
  type OpenInvoice,
  type RecordPaymentResult,
} from "@/lib/staff";
import {
  PURPOSE_LABEL,
  formatCalendarDay,
  newIdempotencyKey,
  staffErrorMessage,
  validateReceiptNo,
  type Purpose,
} from "@/lib/staff-utils";

type Step = "form" | "review" | "done";
type Method = "cash" | "bank_transfer";

const METHOD_LABEL: Record<Method, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
};

type Resolved =
  | { ok: true; amount: Money; currency: string; sendAmount?: Money }
  | { ok: false; message: string };

function availablePurposes(status: MemberDetail["status"], hasDues: boolean) {
  if (status === "pending") return ["registration_fee"] as Purpose[];
  if (status === "active") {
    return [
      "monthly_subscription",
      ...(hasDues ? ["savings_contribution"] : []),
    ] as Purpose[];
  }
  return [] as Purpose[];
}

export function RecordPaymentCard({
  member,
  isSelf,
  dues,
  invoices,
  fees,
}: {
  member: MemberDetail;
  isSelf: boolean;
  dues: DueItem[];
  invoices: OpenInvoice[];
  fees: PublicFees | undefined;
}) {
  const queryClient = useQueryClient();
  const keyRef = useRef<string>("");

  const [step, setStep] = useState<Step>("form");
  const [purposeChoice, setPurposeChoice] = useState<Purpose | "">("");
  const [dueChoice, setDueChoice] = useState("");
  const [invoiceChoice, setInvoiceChoice] = useState("");
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [receiptNo, setReceiptNo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecordPaymentResult | null>(null);

  const purposes = availablePurposes(member.status, dues.length > 0);
  const purpose: Purpose | null =
    purposeChoice !== "" && purposes.includes(purposeChoice)
      ? purposeChoice
      : (purposes[0] ?? null);
  const due = dues.find((d) => d.id === dueChoice) ?? dues[0] ?? null;
  const invoice = invoices.find((i) => i.id === invoiceChoice) ?? null;

  const idMissing = purpose === "registration_fee" && !member.id_sighted_at;

  function resolveAmount(): Resolved {
    if (purpose === "registration_fee") {
      const fee = fees?.registration;
      return fee
        ? { ok: true, amount: fee.amount, currency: fee.currency }
        : { ok: false, message: "The registration fee is not set up yet." };
    }
    if (purpose === "monthly_subscription") {
      if (invoice) {
        return { ok: true, amount: invoice.amount, currency: invoice.currency };
      }
      const fee = fees?.subscription;
      return fee
        ? { ok: true, amount: fee.amount, currency: fee.currency }
        : {
            ok: false,
            message: "The monthly subscription fee is not set up yet.",
          };
    }
    if (purpose === "savings_contribution") {
      if (!due)
        return { ok: false, message: "Choose the contribution being paid." };
      if (due.amount !== null) {
        return { ok: true, amount: due.amount, currency: due.currency };
      }
      const parsed = parseAmountInput(amountText);
      if (!parsed.ok) return { ok: false, message: parsed.message };
      if (due.minAmount && compareMoney(parsed.value, due.minAmount) < 0) {
        return {
          ok: false,
          message: `The smallest amount for this plan is ${formatMoney(due.minAmount, due.currency)}.`,
        };
      }
      if (due.maxAmount && compareMoney(parsed.value, due.maxAmount) > 0) {
        return {
          ok: false,
          message: `The largest amount for this plan is ${formatMoney(due.maxAmount, due.currency)}.`,
        };
      }
      return {
        ok: true,
        amount: parsed.value,
        currency: due.currency,
        sendAmount: parsed.value,
      };
    }
    return { ok: false, message: "Choose what the payment is for." };
  }

  const resolved = resolveAmount();

  function goToReview() {
    setError(null);
    const receiptProblem = validateReceiptNo(receiptNo);
    setReceiptError(receiptProblem ?? undefined);
    if (receiptProblem) return;
    if (!resolved.ok) {
      setError(resolved.message);
      return;
    }
    // A new key for each review. Retrying "Confirm" below reuses it, so a double click or
    // a dropped connection cannot record the payment twice.
    keyRef.current = newIdempotencyKey();
    setStep("review");
  }

  async function confirm() {
    if (!purpose || !resolved.ok) return;
    setError(null);
    setBusy(true);
    try {
      const outcome = await recordOfficePayment({
        memberId: member.id,
        purpose,
        method,
        receiptNo,
        idempotencyKey: keyRef.current,
        dueItemId: purpose === "savings_contribution" ? due?.id : undefined,
        invoiceId: purpose === "monthly_subscription" ? invoice?.id : undefined,
        amount: resolved.sendAmount,
        note,
      });
      setResult(outcome);
      setStep("done");
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
    } catch (e) {
      setError(staffErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function startAnother() {
    setStep("form");
    setResult(null);
    setReceiptNo("");
    setNote("");
    setAmountText("");
    setDueChoice("");
    setInvoiceChoice("");
    setError(null);
    setReceiptError(undefined);
  }

  const heading = (
    <h2 id="payment-heading" className="text-lg font-semibold">
      Record an office payment
    </h2>
  );

  if (isSelf) {
    return (
      <section
        aria-labelledby="payment-heading"
        className="rounded-md border border-border bg-card p-6"
      >
        {heading}
        <p className="mt-3 text-sm text-muted-foreground">
          You cannot record payments on your own account. Ask another staff
          member.
        </p>
      </section>
    );
  }

  if (purposes.length === 0) {
    return (
      <section
        aria-labelledby="payment-heading"
        className="rounded-md border border-border bg-card p-6"
      >
        {heading}
        <p className="mt-3 text-sm text-muted-foreground">
          This account is {member.status}, so it cannot take payments.
        </p>
      </section>
    );
  }

  if (step === "done" && result) {
    return (
      <section
        aria-labelledby="payment-heading"
        className="rounded-md border border-border bg-card p-6"
      >
        {heading}
        <div role="status" className="mt-4 grid gap-2 text-sm">
          <p className="text-base font-semibold text-primary">
            Payment recorded. Receipt {result.receiptNumber}
          </p>
          {result.alreadyRecorded && (
            <p className="text-muted-foreground">
              This payment had already been saved, so nothing new was added.
            </p>
          )}
          <p className="text-muted-foreground">
            Write the receipt number on the paper receipt before handing it to
            the member.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/staff/receipts/$receiptNumber"
            params={{ receiptNumber: result.receiptNumber }}
            className={buttonVariants({ variant: "default" })}
          >
            <Printer aria-hidden="true" />
            Print receipt
          </Link>
          <Button variant="outline" onClick={startAnother}>
            Record another payment
          </Button>
        </div>
      </section>
    );
  }

  if (step === "review" && resolved.ok && purpose) {
    return (
      <section
        aria-labelledby="payment-heading"
        className="rounded-md border border-border bg-card p-6"
      >
        {heading}
        <p className="mt-3 text-sm text-muted-foreground">
          Check the details. Once confirmed, the payment is final. A mistake can
          only be fixed with a reversal, never by editing.
        </p>
        <dl className="mt-4 grid gap-3 rounded-md border border-border p-4 text-sm sm:grid-cols-2">
          <Row label="Member">
            {member.full_name} ({member.member_number})
          </Row>
          <Row label="For">{PURPOSE_LABEL[purpose]}</Row>
          <Row label="Amount">
            <strong className="text-base">
              {formatMoney(resolved.amount, resolved.currency)}
            </strong>
          </Row>
          <Row label="Paid by">{METHOD_LABEL[method]}</Row>
          <Row label="Receipt book number">{receiptNo.trim()}</Row>
          {note.trim() && <Row label="Note">{note.trim()}</Row>}
        </dl>
        {purpose !== "savings_contribution" && (
          <p className="mt-3 text-xs text-muted-foreground">
            This is a fee. It does not count towards the member’s savings.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => void confirm()} disabled={busy}>
            {busy ? "Recording…" : "Confirm and issue receipt"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setStep("form")}
            disabled={busy}
          >
            Back
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="payment-heading"
      className="rounded-md border border-border bg-card p-6"
    >
      {heading}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          goToReview();
        }}
        className="mt-4 grid gap-5"
      >
        {purposes.length > 1 ? (
          <div>
            <label
              htmlFor="pay-purpose"
              className="mb-1.5 block text-sm font-medium"
            >
              What is the payment for?
            </label>
            <select
              id="pay-purpose"
              value={purpose ?? ""}
              onChange={(event) =>
                setPurposeChoice(event.target.value as Purpose)
              }
              className={inputClass}
            >
              {purposes.map((p) => (
                <option key={p} value={p}>
                  {PURPOSE_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          purpose && (
            <p className="text-sm">
              <span className="font-medium">For:</span> {PURPOSE_LABEL[purpose]}
            </p>
          )
        )}

        {purpose === "registration_fee" && (
          <p className="text-sm text-muted-foreground">
            {fees?.registration
              ? `The registration fee is ${formatMoney(fees.registration.amount, fees.registration.currency)}. `
              : ""}
            Confirming it activates the account.
          </p>
        )}
        {idMissing && (
          <p role="alert" className="text-sm text-destructive">
            Check the member’s national ID first (see the ID card on this page),
            then record the registration fee.
          </p>
        )}

        {purpose === "monthly_subscription" && (
          <div>
            <label
              htmlFor="pay-invoice"
              className="mb-1.5 block text-sm font-medium"
            >
              Which invoice?
            </label>
            <select
              id="pay-invoice"
              value={invoice?.id ?? ""}
              onChange={(event) => setInvoiceChoice(event.target.value)}
              className={inputClass}
            >
              <option value="">
                No invoice (standard monthly fee
                {fees?.subscription
                  ? `, ${formatMoney(fees.subscription.amount, fees.subscription.currency)}`
                  : ""}
                )
              </option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {formatCalendarDay(i.periodStart)} to{" "}
                  {formatCalendarDay(i.periodEnd)} (
                  {formatMoney(i.amount, i.currency)}, {i.status})
                </option>
              ))}
            </select>
          </div>
        )}

        {purpose === "savings_contribution" && (
          <>
            <div>
              <label
                htmlFor="pay-due"
                className="mb-1.5 block text-sm font-medium"
              >
                Which contribution?
              </label>
              <select
                id="pay-due"
                value={due?.id ?? ""}
                onChange={(event) => setDueChoice(event.target.value)}
                className={inputClass}
              >
                {dues.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.planName ? `${d.planName}, ` : ""}due{" "}
                    {formatCalendarDay(d.dueDate)}
                    {d.amount ? ` (${formatMoney(d.amount, d.currency)})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {due && due.amount === null && (
              <Field
                id="pay-amount"
                label="Amount received"
                inputMode="decimal"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                hint={
                  due.minAmount && due.maxAmount
                    ? `This plan allows ${formatMoney(due.minAmount, due.currency)} to ${formatMoney(due.maxAmount, due.currency)}.`
                    : undefined
                }
                autoComplete="off"
              />
            )}
            {due && due.amount !== null && (
              <p className="text-sm text-muted-foreground">
                Amount: {formatMoney(due.amount, due.currency)} (fixed by the
                plan).
              </p>
            )}
          </>
        )}

        <div>
          <label
            htmlFor="pay-method"
            className="mb-1.5 block text-sm font-medium"
          >
            How was it paid?
          </label>
          <select
            id="pay-method"
            value={method}
            onChange={(event) => setMethod(event.target.value as Method)}
            className={inputClass}
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </div>

        <Field
          id="pay-receipt"
          label="Receipt book number"
          hint="The number printed on the paper receipt you are giving the member. Each number can only be used once."
          value={receiptNo}
          error={receiptError}
          onChange={(event) => setReceiptNo(event.target.value)}
          autoComplete="off"
        />

        <Field
          id="pay-note"
          label="Note (optional)"
          hint="For example a bank reference."
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
        />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" disabled={idMissing}>
            Review payment
          </Button>
        </div>
      </form>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
