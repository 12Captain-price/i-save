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
import {
  CHART_COLORS,
  ChartCard,
  EmptyChart,
} from "@/components/charts/ChartParts";
import {
  DonutChart,
  LineChart,
  ProgressRing,
} from "@/components/charts/Charts";
import { lastMonths, monthLabel, runningTotalByMonth } from "@/lib/chart-utils";
import { useMemberLedger, useMemberPlanProgress } from "@/lib/dashboard-data";
import { compareMoney } from "@/lib/money";
import { PlanPicker } from "@/components/member/PlanPicker";
import { WithdrawalCard } from "@/components/member/WithdrawalCard";
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
      className="rounded-xl border border-border bg-card p-5 md:p-6"
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

  const ledger = useMemberLedger(memberId);
  const progress = useMemberPlanProgress(memberId);
  const main = balanceRows[0]!;
  const cur = main.currency;

  const months = lastMonths(6);
  const savingsSeries = ledger.data
    ? runningTotalByMonth(ledger.data, months, (r) => r.savingsDelta)
    : [];
  const hasMoney = (ledger.data?.length ?? 0) > 0;
  const prog = progress.data;
  const percent =
    prog && prog.total > 0 ? Math.round((prog.paid / prog.total) * 100) : 0;

  // A goal line only when the plan has one fixed amount, so the number is exact.
  const planAmount = enrollment.data?.plan.amount ?? null;
  const goalMoney =
    planAmount && prog && prog.total > 0
      ? String(Number(planAmount) * prog.total)
      : null;

  const firstChart = (
    <ChartCard
      id="savings-growth"
      title="Your savings growth"
      subtitle="Confirmed savings at the end of each month. Hover or tap for the exact amount."
    >
      {ledger.isError ? (
        <ErrorLine error={ledger.error} />
      ) : !hasMoney ? (
        <EmptyChart message="Your savings chart will appear after your first payment is recorded." />
      ) : (
        <LineChart
          title="Your confirmed savings at the end of each month"
          labels={months.map((m) => monthLabel(m))}
          tooltipLabels={months.map((m) => monthLabel(m, true))}
          format={(n) => formatMoney(n.toFixed(2), cur)}
          series={[
            {
              key: "savings",
              label: "Savings",
              color: CHART_COLORS.savings,
              values: savingsSeries.map(Number),
            },
          ]}
          goal={
            goalMoney && compareMoney(goalMoney, "0.00") > 0
              ? {
                  value: Number(goalMoney),
                  label: `Plan goal ${formatMoney(Number(goalMoney).toFixed(2), cur)}`,
                }
              : undefined
          }
        />
      )}
    </ChartCard>
  );

  const splitChart = (
    <ChartCard
      id="money-split"
      title="Savings and fees"
      subtitle="Fees are never counted as savings."
    >
      <DonutChart
        title="Your savings compared with fees you have paid"
        centerValue={formatMoney(main.savings, cur)}
        centerLabel="saved"
        format={(n) => formatMoney(n.toFixed(2), cur)}
        slices={[
          {
            key: "savings",
            label: "Savings",
            value: Number(main.savings),
            color: CHART_COLORS.savings,
          },
          {
            key: "fees",
            label: "Fees",
            value: Number(main.fees),
            color: CHART_COLORS.registration,
          },
        ].filter((s) => s.value > 0)}
      />
      {Number(main.savings) === 0 && Number(main.fees) === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing recorded yet.
        </p>
      )}
    </ChartCard>
  );

  return (
    <div className="grid gap-6">
      {/* Hero: the one number a member cares about, and how far along their plan is. */}
      <section
        aria-label="Savings summary"
        className="grid gap-6 rounded-2xl border border-border bg-gradient-to-br from-card to-surface-deep p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8"
      >
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Your savings
          </p>
          {balances.isError ? (
            <ErrorLine error={balances.error} />
          ) : (
            <p className="mt-2 font-display text-4xl font-semibold text-primary md:text-5xl">
              {formatMoney(main.savings, cur)}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Only confirmed savings contributions count here.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-background/40 px-3 py-2.5">
              <dt className="text-[0.7rem] text-muted-foreground uppercase">
                Fees paid
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {formatMoney(main.fees, cur)}
              </dd>
            </div>
            <div className="rounded-lg bg-background/40 px-3 py-2.5">
              <dt className="text-[0.7rem] text-muted-foreground uppercase">
                Next payment
              </dt>
              <dd className="mt-0.5 font-semibold">
                {nextDue ? formatCalendarDay(nextDue.dueDate) : "None due"}
              </dd>
            </div>
            <div className="col-span-2 rounded-lg bg-background/40 px-3 py-2.5 sm:col-span-1">
              <dt className="text-[0.7rem] text-muted-foreground uppercase">
                Contributions
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {prog ? `${prog.paid} made` : "…"}
                {prog && prog.missed > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-destructive">
                    {prog.missed} missed
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
        {prog && prog.total > 0 ? (
          <div className="flex flex-col items-center gap-1 justify-self-center">
            <ProgressRing
              percent={percent}
              label={`${percent}%`}
              sub={`${prog.paid} of ${prog.total}`}
            />
            <p className="text-xs text-muted-foreground">of your plan paid</p>
          </div>
        ) : null}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-6">
          {firstChart}
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
                        <td className="py-3 pr-4">
                          {formatDateTime(r.issuedAt)}
                        </td>
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

          <div className="hidden lg:block">{splitChart}</div>
        </div>
        <aside aria-label="Plan and messages" className="grid gap-6">
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
                    Savings plans are being finalised and will appear here once
                    they are approved. Nothing is offered until then.
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
                    <li
                      key={i.id}
                      className="flex flex-wrap items-center gap-2"
                    >
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
            <WithdrawalCard memberId={memberId} />
          </Card>
        </aside>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:hidden">{splitChart}</div>
    </div>
  );
}
