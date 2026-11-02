import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { StatusPill } from "@/components/staff/StatusPill";
import { compareMoney, formatMoney } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { formatDateTime, staffErrorMessage } from "@/lib/staff-utils";
import {
  OPEN_STATUSES,
  cancelWithdrawal,
  requestWithdrawal,
  useMyWithdrawals,
  useWithdrawalQuote,
  withdrawalStatusLabel,
  type MyWithdrawal,
  type WithdrawalQuote,
} from "@/lib/withdrawals";

const NOT_OPEN = "Withdrawals are not open yet.";

/**
 * The member's withdrawal area. The database decides whether a withdrawal is allowed and how
 * much it is (withdrawal_quote); this card only shows that answer, so the screen and the rules
 * can never disagree. No interest or bonus is ever mentioned or implied.
 */
export function WithdrawalCard({ memberId }: { memberId: string }) {
  const quote = useWithdrawalQuote(memberId);
  const mine = useMyWithdrawals(memberId);

  if (quote.isPending || mine.isPending) {
    return (
      <p role="status" className="text-muted-foreground">
        Loading…
      </p>
    );
  }
  if (quote.isError || mine.isError) {
    return (
      <p role="alert" className="text-destructive">
        {staffErrorMessage(quote.error ?? mine.error)}
      </p>
    );
  }

  const open = mine.data.find((w) => OPEN_STATUSES.includes(w.status as never));
  const latest = mine.data[0];

  if (open) return <OpenRequest memberId={memberId} request={open} />;

  return (
    <div className="grid gap-4">
      {latest && <LastOutcome request={latest} />}
      {quote.data.eligible ? (
        <RequestForm memberId={memberId} quote={quote.data} />
      ) : (
        <NotAvailable quote={quote.data} />
      )}
    </div>
  );
}

function NotAvailable({ quote }: { quote: WithdrawalQuote }) {
  if (quote.reason === NOT_OPEN) {
    return (
      <div>
        <p>
          <StatusPill status="pending" label="Policy pending approval" />
        </p>
        <p className="mt-2 text-muted-foreground">
          Withdrawals are not available yet. We will tell you here once the
          rules are approved.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p>
        <StatusPill status="pending" label="Not available right now" />
      </p>
      <p className="mt-2">{quote.reason}</p>
      {quote.eligibleOn && (
        <p className="mt-1 text-sm text-muted-foreground">
          Earliest date: {quote.eligibleOn}
        </p>
      )}
    </div>
  );
}

function LastOutcome({ request }: { request: MyWithdrawal }) {
  if (request.status === "rejected") {
    return (
      <div className="rounded-md border border-border p-3 text-sm">
        <p className="font-semibold">Your last request was not approved.</p>
        {request.rejectReason && <p className="mt-1">{request.rejectReason}</p>}
        <p className="mt-1 text-muted-foreground">
          Please speak to the office if you have questions.
        </p>
      </div>
    );
  }
  if (request.status === "paid") {
    return (
      <div className="rounded-md border border-border p-3 text-sm">
        <p className="font-semibold">
          Paid: {formatMoney(request.netAmount, request.currency)}
          {request.paidAt ? ` on ${formatDateTime(request.paidAt)}` : ""}
        </p>
        {request.payoutReference && (
          <p className="mt-1 text-muted-foreground">
            Reference {request.payoutReference}
          </p>
        )}
        <p className="mt-2">
          <Link
            to="/withdrawal-receipt/$id"
            params={{ id: request.id }}
            className="text-primary underline underline-offset-4"
          >
            View receipt
            {request.receiptNumber ? ` ${request.receiptNumber}` : ""}
          </Link>
        </p>
      </div>
    );
  }
  return null;
}

function OpenRequest({
  memberId,
  request,
}: {
  memberId: string;
  request: MyWithdrawal;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const canCancel =
    request.status === "requested" || request.status === "under_review";

  async function cancel() {
    setBusy(true);
    setFailure(undefined);
    try {
      await cancelWithdrawal(request.id);
      await queryClient.invalidateQueries({ queryKey: ["member", memberId] });
    } catch (error) {
      setFailure(staffErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p>
        <StatusPill
          status="open"
          label={withdrawalStatusLabel(request.status)}
        />
      </p>
      <p className="mt-2">
        Amount: {formatMoney(request.amount, request.currency)}
        {request.earlyExit && " (leaving the plan early)"}
      </p>
      {request.earlyExit && (
        <p className="mt-1 text-sm">
          Fee: {formatMoney(request.feeAmount, request.currency)}. You will
          receive {formatMoney(request.netAmount, request.currency)}.
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        Requested {formatDateTime(request.createdAt)}. Two staff members check
        every withdrawal before it is paid. We will message you here.
      </p>
      {failure && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {failure}
        </p>
      )}
      {canCancel && (
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel request"}
          </Button>
        </div>
      )}
    </div>
  );
}

function RequestForm({
  memberId,
  quote,
}: {
  memberId: string;
  quote: WithdrawalQuote;
}) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<"ecocash" | "cash">("ecocash");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<{ number?: string; name?: string }>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();

  const hasFee = compareMoney(quote.feeAmount, "0") > 0;

  async function submit() {
    setFailure(undefined);
    const next: typeof errors = {};
    let e164 = "";
    if (method === "ecocash") {
      const phone = normalizePhone(number);
      if (!phone.ok) next.number = phone.message;
      else e164 = phone.value;
      if (name.trim().length < 3)
        next.name = "Enter the name the EcoCash number is registered in.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (!accepted) {
      setFailure("Please tick the box to confirm before you continue.");
      return;
    }
    setBusy(true);
    try {
      await requestWithdrawal({
        method,
        number: e164,
        name,
        note,
        accepted,
      });
      await queryClient.invalidateQueries({ queryKey: ["member", memberId] });
    } catch (error) {
      setFailure(staffErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="font-semibold">
          You can withdraw your savings:{" "}
          {formatMoney(quote.netAmount, quote.currency)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your whole confirmed savings balance is withdrawn:{" "}
          {formatMoney(quote.amount, quote.currency)}.
          {hasFee
            ? ` Because you are leaving before your plan ends, a fee of ${formatMoney(quote.feeAmount, quote.currency)} is kept.`
            : " There is no fee."}{" "}
          Registration and subscription fees are not savings and are not
          refunded. Savings do not earn interest or a bonus. Withdrawing closes
          your plan.
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">
          How should we pay you?
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="payout-method"
            checked={method === "ecocash"}
            onChange={() => setMethod("ecocash")}
          />
          EcoCash (to a number in your own name)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="payout-method"
            checked={method === "cash"}
            onChange={() => setMethod("cash")}
          />
          Cash collected at the office
        </label>
      </fieldset>

      {method === "ecocash" && (
        <>
          <Field
            id="wd-number"
            label="EcoCash number"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0771234567"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            error={errors.number}
          />
          <Field
            id="wd-name"
            label="Name the number is registered in"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
        </>
      )}

      <Field
        id="wd-note"
        label="Note for the office (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>
          I understand I will receive{" "}
          {formatMoney(quote.netAmount, quote.currency)}
          {method === "ecocash"
            ? ", sent to an EcoCash number in my own name"
            : ", in cash at the office"}
          , and that my plan will close.
        </span>
      </label>

      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <div>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Sending…" : "Request withdrawal"}
        </Button>
      </div>
    </div>
  );
}
