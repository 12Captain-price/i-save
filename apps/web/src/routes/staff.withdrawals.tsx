import { LoadingSkeleton } from "@/components/ui/motion";
import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { StatusPill } from "@/components/staff/StatusPill";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import {
  formatDateTime,
  isAdminRole,
  staffErrorMessage,
} from "@/lib/staff-utils";
import {
  OPEN_STATUSES,
  approveWithdrawal,
  recordWithdrawalPayout,
  rejectWithdrawal,
  reviewWithdrawal,
  useWithdrawalQueue,
  withdrawalStatusLabel,
  type QueueItem,
} from "@/lib/withdrawals";

export const Route = createFileRoute("/staff/withdrawals")({
  component: WithdrawalsPage,
});

function WithdrawalsPage() {
  const queue = useWithdrawalQueue();
  const open = (queue.data ?? []).filter((w) =>
    OPEN_STATUSES.includes(w.status as never),
  );
  const done = (queue.data ?? []).filter(
    (w) => !OPEN_STATUSES.includes(w.status as never),
  );

  return (
    <div>
      <h1 className="text-3xl font-semibold md:text-4xl">Withdrawals</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every withdrawal passes through three steps. One staff member reviews
        it. A different administrator approves it. Then the office pays the
        member and records the payout reference, which is the moment the money
        leaves the member’s balance. Nobody can handle their own withdrawal.
      </p>

      <div className="mt-8 grid gap-4" aria-live="polite">
        {queue.isPending && <LoadingSkeleton />}
        {queue.isError && (
          <p role="alert" className="text-sm text-destructive">
            {staffErrorMessage(queue.error)}
          </p>
        )}
        {queue.data && open.length === 0 && (
          <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            No withdrawals need attention.
          </p>
        )}
        {open.map((w) => (
          <RequestCard key={w.id} item={w} />
        ))}
      </div>

      {done.length > 0 && (
        <section className="mt-10" aria-labelledby="wd-history">
          <h2 id="wd-history" className="text-lg font-semibold">
            Finished
          </h2>
          <ul className="mt-3 grid gap-3">
            {done.map((w) => (
              <li
                key={w.id}
                className="rounded-md border border-border bg-card p-4 text-sm"
              >
                <p>
                  <span className="font-semibold">
                    {w.memberName} ({w.memberNumber})
                  </span>{" "}
                  · {formatMoney(w.amount, w.currency)} ·{" "}
                  {withdrawalStatusLabel(w.status)}
                  {w.payoutReference ? ` · ref ${w.payoutReference}` : ""}
                </p>
                {w.rejectReason && (
                  <p className="mt-1">Reason: {w.rejectReason}</p>
                )}
                <Trail item={w} />
                {w.status === "paid" && (
                  <p className="mt-2">
                    <Link
                      to="/withdrawal-receipt/$id"
                      params={{ id: w.id }}
                      className="text-primary underline underline-offset-4"
                    >
                      Receipt {w.receiptNumber ?? ""}
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RequestCard({ item }: { item: QueueItem }) {
  const queryClient = useQueryClient();
  const { roles, session } = useAuth();
  const isAdmin = isAdminRole(roles);
  const myId = session?.user.id;

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
    } catch (error) {
      setFailure(staffErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const iReviewed = item.reviewedBy !== null && item.reviewedBy === myId;

  return (
    <section
      aria-label={`Withdrawal for ${item.memberName}`}
      className="rounded-md border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {item.memberName}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {item.memberNumber}
            {item.memberPhone ? ` · ${item.memberPhone}` : ""}
          </span>
        </h2>
        <StatusPill status="open" label={withdrawalStatusLabel(item.status)} />
      </div>

      <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline text-muted-foreground">Savings withdrawn: </dt>
          <dd className="inline font-semibold">
            {formatMoney(item.amount, item.currency)}
          </dd>
        </div>
        <div>
          <dt className="inline text-muted-foreground">Fee kept: </dt>
          <dd className="inline">
            {formatMoney(item.feeAmount, item.currency)}
          </dd>
        </div>
        <div>
          <dt className="inline text-muted-foreground">To pay the member: </dt>
          <dd className="inline font-semibold">
            {formatMoney(item.netAmount, item.currency)}
          </dd>
        </div>
        <div>
          <dt className="inline text-muted-foreground">Type: </dt>
          <dd className="inline">
            {item.earlyExit ? "Early exit" : "Plan completed"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="inline text-muted-foreground">Payout: </dt>
          <dd className="inline">
            {item.payoutMethod === "ecocash"
              ? `EcoCash ${item.payoutNumber ?? ""}, registered to ${item.payoutName ?? ""}`
              : "Cash at the office"}
          </dd>
        </div>
        {item.memberNote && (
          <div className="sm:col-span-2">
            <dt className="inline text-muted-foreground">Member’s note: </dt>
            <dd className="inline">{item.memberNote}</dd>
          </div>
        )}
      </dl>
      <Trail item={item} />

      {failure && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {failure}
        </p>
      )}

      <div className="mt-4 grid gap-3">
        {item.status === "requested" && (
          <div>
            <Button
              disabled={busy}
              onClick={() => run(() => reviewWithdrawal(item.id))}
            >
              Start review
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Check the member’s plan, savings and payout details first.
            </p>
          </div>
        )}

        {item.status === "under_review" && isAdmin && !iReviewed && (
          <div>
            <Button
              disabled={busy}
              onClick={() => run(() => approveWithdrawal(item.id))}
            >
              Approve
            </Button>
          </div>
        )}
        {item.status === "under_review" && iReviewed && (
          <p className="text-sm text-muted-foreground">
            You reviewed this request, so a different administrator must approve
            it.
          </p>
        )}
        {item.status === "under_review" && !isAdmin && !iReviewed && (
          <p className="text-sm text-muted-foreground">
            Waiting for an administrator to approve.
          </p>
        )}

        {item.status === "approved" && (
          <div className="grid max-w-md gap-2">
            <label htmlFor={`ref-${item.id}`} className="text-sm font-medium">
              {item.payoutMethod === "ecocash"
                ? "EcoCash transaction ID"
                : "Cash receipt number"}
            </label>
            <input
              id={`ref-${item.id}`}
              className={inputClass}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <div>
              <Button
                disabled={busy || reference.trim().length < 3}
                onClick={() =>
                  run(() => recordWithdrawalPayout(item.id, reference))
                }
              >
                I have paid the member
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Only press this after the money has really been sent or handed
                over. It removes the savings from the member’s balance and
                closes their plan.
              </p>
            </div>
          </div>
        )}

        {isAdmin && !rejecting && (
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setRejecting(true)}
            >
              Reject
            </Button>
          </div>
        )}
        {isAdmin && rejecting && (
          <div className="grid max-w-md gap-2">
            <label htmlFor={`rej-${item.id}`} className="text-sm font-medium">
              Reason (the member will see this)
            </label>
            <input
              id={`rej-${item.id}`}
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={busy || reason.trim().length < 5}
                onClick={() => run(() => rejectWithdrawal(item.id, reason))}
              >
                Confirm rejection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejecting(false)}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Who did each step and when. This is what lets the office say "so and so approved it". */
function Trail({ item }: { item: QueueItem }) {
  const steps: { label: string; who: string; at: string | null }[] = [
    { label: "Requested by", who: item.memberName, at: item.createdAt },
  ];
  if (item.reviewedByName)
    steps.push({
      label: "Reviewed by",
      who: item.reviewedByName,
      at: item.reviewedAt,
    });
  if (item.approvedByName)
    steps.push({
      label: "Approved by",
      who: item.approvedByName,
      at: item.approvedAt,
    });
  if (item.rejectedByName)
    steps.push({
      label: "Rejected by",
      who: item.rejectedByName,
      at: item.rejectedAt,
    });
  if (item.paidByName)
    steps.push({ label: "Paid out by", who: item.paidByName, at: item.paidAt });

  return (
    <ul className="mt-3 grid gap-0.5 text-xs text-muted-foreground">
      {steps.map((step) => (
        <li key={step.label}>
          {step.label}{" "}
          <span className="font-semibold text-foreground">{step.who}</span>
          {step.at ? `, ${formatDateTime(step.at)}` : ""}
        </li>
      ))}
    </ul>
  );
}
