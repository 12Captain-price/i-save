import type { ReactNode } from "react";
import { formatMoney, toMoney } from "@/lib/money";
import { usePublicFees } from "@/lib/public-fees";
import {
  useAvailablePlans,
  useMyEnrollment,
  useMyMessages,
} from "@/lib/member";
import {
  useMemberBalances,
  useMemberDueItems,
  useMemberInvoices,
  useMemberReceipts,
} from "@/lib/staff";
import {
  formatCalendarDay,
  formatDateTime,
  purposeLabel,
  staffErrorMessage,
} from "@/lib/staff-utils";
import { StatusPill } from "@/components/staff/StatusPill";
import { PlanPicker } from "@/components/member/PlanPicker";
import { describeDuration, describePlanAmount } from "@/lib/plan-utils";

function Card({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-md border border-border bg-card p-6"
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

function Loading() {
  return (
    <p role="status" className="text-muted-foreground">
      Loading…
    </p>
  );
}

function ErrorLine({ error }: { error: unknown }) {
  return (
    <p role="alert" className="text-destructive">
      {staffErrorMessage(error)}
    </p>
  );
}

/**
 * What an active member sees: money kept in two separate places (savings and fees), their
 * plan, what is due, receipts and messages. Everything is read-only. Payments are recorded
 * by office staff, and the database decides what each member is allowed to see.
 */
export function MemberDashboard({ memberId }: { memberId: string }) {
  const fees = usePublicFees();
  const balances = useMemberBalances(memberId);
  const receipts = useMemberReceipts(memberId);
  const enrollment = useMyEnrollment(memberId);
  const dues = useMemberDueItems(memberId);
  const invoices = useMemberInvoices(memberId);
  const messages = useMyMessages(memberId);
  const plans = useAvailablePlans();

  const balanceRows =
    balances.data && balances.data.length > 0
      ? balances.data
      : [{ currency: "USD", savings: toMoney(0), fees: toMoney(0) }];

  const nextDue = dues.data?.[0] ?? null;
  const lastSubscription =
    receipts.data?.find(
      (r) => r.purpose === "monthly_subscription" && !r.reversed,
    ) ?? null;

  return (
    <div className="grid gap-6">
      {/* Money: savings and fees are never added together. */}
      <div className="grid gap-6 sm:grid-cols-2">
        {balances.isError ? (
          <ErrorLine error={balances.error} />
        ) : (
          balanceRows.map((b) => (
            <div key={b.currency} className="contents">
              <div className="rounded-md border border-border bg-card p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Your savings
                </p>
                <p className="mt-2 font-display text-3xl font-semibold text-primary">
                  {formatMoney(b.savings, b.currency)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Only confirmed savings contributions count here.
                </p>
              </div>
              <div className="rounded-md border border-border bg-card p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Fees paid
                </p>
                <p className="mt-2 font-display text-3xl font-semibold">
                  {formatMoney(b.fees, b.currency)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Registration and subscription fees. These are not savings.
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <Card id="plan-heading" title="Your savings plan">
        {enrollment.isPending && <Loading />}
        {enrollment.isError && <ErrorLine error={enrollment.error} />}
        {enrollment.data && (
          <div className="grid gap-2">
            <p className="flex flex-wrap items-center gap-2">
              <strong className="text-base">
                {enrollment.data.plan.planName}
              </strong>
              <StatusPill status={enrollment.data.status} />
            </p>
            <p>{describePlanAmount(enrollment.data.plan)}</p>
            <p className="text-muted-foreground">
              Started {formatCalendarDay(enrollment.data.effectiveDate)}.
              {enrollment.data.plan.durationWeeks !== null &&
                ` ${describeDuration(enrollment.data.plan.durationWeeks)} in total.`}
            </p>
            <details>
              <summary className="cursor-pointer text-primary underline underline-offset-4">
                Read the terms you accepted
              </summary>
              <p className="mt-2 whitespace-pre-wrap">
                {enrollment.data.plan.termsText}
              </p>
            </details>
            {nextDue && (
              <p>
                <strong>Next contribution:</strong>{" "}
                {formatCalendarDay(nextDue.dueDate)}
                {nextDue.amount
                  ? ` (${formatMoney(nextDue.amount, nextDue.currency)})`
                  : ""}
                . Pay at the office and staff will record it.
              </p>
            )}
          </div>
        )}
        {enrollment.data === null && (
          <div className="grid gap-3">
            <p className="text-muted-foreground">
              You have not joined a savings plan yet.
            </p>
            {plans.isError && <ErrorLine error={plans.error} />}
            {plans.data && plans.data.length === 0 && (
              <p>
                Savings plans are being finalised and will appear here once they
                are approved. Nothing is offered until then.
              </p>
            )}
            {plans.data && plans.data.length > 0 && (
              <PlanPicker memberId={memberId} plans={plans.data} />
            )}
          </div>
        )}
      </Card>

      <Card id="subscription-heading" title="Monthly subscription">
        <div className="grid gap-2">
          <p>
            {fees.data?.subscription
              ? `${formatMoney(fees.data.subscription.amount, fees.data.subscription.currency)} per month. `
              : ""}
            Paid at the office. It is a fee and does not count as savings.
          </p>
          {invoices.data && invoices.data.length > 0 && (
            <ul className="grid gap-1">
              {invoices.data.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2">
                  {formatCalendarDay(i.periodStart)} to{" "}
                  {formatCalendarDay(i.periodEnd)}:{" "}
                  {formatMoney(i.amount, i.currency)}
                  <StatusPill status={i.status} />
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground">
            {lastSubscription
              ? `Last subscription payment: ${formatDateTime(lastSubscription.issuedAt)} (receipt ${lastSubscription.receiptNumber}).`
              : "No subscription payment recorded yet."}
          </p>
        </div>
      </Card>

      <Card id="receipts-heading" title="Your receipts">
        {receipts.isPending && <Loading />}
        {receipts.isError && <ErrorLine error={receipts.error} />}
        {receipts.data && receipts.data.length === 0 && (
          <p className="text-muted-foreground">No receipts yet.</p>
        )}
        {receipts.data && receipts.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase">
                  <th scope="col" className="py-2 pr-4">
                    Receipt
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Date
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    For
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {receipts.data.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">
                      {r.receiptNumber}
                      {r.reversed && (
                        <span className="ml-2">
                          <StatusPill status="reversed" />
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">{formatDateTime(r.issuedAt)}</td>
                    <td className="py-3 pr-4">{purposeLabel(r.purpose)}</td>
                    <td className="py-3 text-right font-medium">
                      {formatMoney(r.amount, r.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card id="messages-heading" title="Messages">
        {messages.isPending && <Loading />}
        {messages.isError && <ErrorLine error={messages.error} />}
        {messages.data && messages.data.length === 0 && (
          <p className="text-muted-foreground">No messages yet.</p>
        )}
        {messages.data && messages.data.length > 0 && (
          <ul className="grid gap-4">
            {messages.data.map((m) => (
              <li key={m.id}>
                <p className="font-semibold">{m.subject ?? "Message"}</p>
                <p className="mt-1">{m.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(m.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="withdrawals-heading" title="Withdrawals">
        <p>
          <StatusPill status="pending" label="Policy pending approval" />
        </p>
        <p className="mt-2 text-muted-foreground">
          Withdrawals are not available yet. We will tell you here once the
          rules are approved.
        </p>
      </Card>
    </div>
  );
}
