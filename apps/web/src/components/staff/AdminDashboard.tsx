import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CHART_COLORS,
  ChartCard,
  EmptyChart,
  Segmented,
} from "@/components/charts/ChartParts";
import { DonutChart, LineChart, StackedBars } from "@/components/charts/Charts";
import { useAuth } from "@/lib/auth";
import {
  cumulativeCounts,
  lastMonths,
  monthLabel,
  moneyInByMonth,
  runningTotalByMonth,
} from "@/lib/chart-utils";
import { useAdminOverview } from "@/lib/dashboard-data";
import { formatMoney, sumMoney } from "@/lib/money";
import { isAdminRole, staffErrorMessage } from "@/lib/staff-utils";

const SECTIONS = [
  { to: "/staff/plans", label: "Plans", note: "Savings plans and terms" },
  {
    to: "/staff/announcements",
    label: "Announcements",
    note: "Write and send notices",
  },
  { to: "/staff/events", label: "Events", note: "Pictures and details" },
  { to: "/staff/team", label: "Team", note: "Photos and hierarchy" },
  {
    to: "/staff/content",
    label: "Pages and FAQs",
    note: "Terms, privacy, questions",
  },
  { to: "/staff/accounts", label: "Staff accounts", note: "Add new staff" },
  { to: "/staff/audit", label: "Audit log", note: "Who did what" },
  { to: "/staff/report", label: "Daily report", note: "Today’s payments" },
] as const;

function Kpi({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={
          "mt-1.5 font-display text-2xl font-semibold tabular-nums " +
          (tone === "good"
            ? "text-primary"
            : tone === "warn"
              ? "text-destructive"
              : "")
        }
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

/**
 * The first thing an administrator sees in the staff area: the numbers that matter, drawn as
 * charts you can hover, then a way into every admin section.
 */
export function AdminDashboard() {
  const { roles, adminMode, profile } = useAuth();
  const isAdmin = isAdminRole(roles);
  const overview = useAdminOverview(isAdmin);
  const [span, setSpan] = useState<6 | 12>(6);

  const view = useMemo(() => {
    const d = overview.data;
    if (!d) return null;
    const months12 = lastMonths(12);
    const months = months12.slice(-span);
    const labels = months.map((m) => monthLabel(m));
    const tips = months.map((m) => monthLabel(m, true));
    const monthly = moneyInByMonth(d.ledger, months);
    const savingsRun = runningTotalByMonth(
      d.ledger,
      months12,
      (r) => r.savingsDelta,
    ).slice(-span);
    const growth = cumulativeCounts(
      d.members.map((m) => m.createdAt),
      months,
    );
    const status = (s: string) =>
      d.members.filter((m) => m.status === s).length;
    return { months, labels, tips, monthly, savingsRun, growth, status };
  }, [overview.data, span]);

  if (!isAdmin) return null;
  const d = overview.data;
  const cur = d?.currency ?? "USD";
  const fmt = (n: number) => formatMoney(n.toFixed(2), cur);
  const num = (m: string) => Number(m);
  const first = (profile?.fullName ?? "").split(" ")[0];

  const thisMonth = view?.monthly[view.monthly.length - 1];
  const inThisMonth = thisMonth
    ? sumMoney([
        thisMonth.savings,
        thisMonth.registration,
        thisMonth.subscription,
      ])
    : "0.00";

  return (
    <div className="mb-10 grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[0.7rem] font-bold tracking-[0.14em] text-primary uppercase">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            {adminMode ? "Admin mode" : "Administrator"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {first ? `Hello, ${first}` : "Admin dashboard"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A live picture of iSave. Hover or tap a chart for exact figures.
          </p>
        </div>
        <Segmented
          label="Time span"
          value={span}
          onChange={setSpan}
          options={[
            { value: 6, label: "6 months" },
            { value: 12, label: "12 months" },
          ]}
        />
      </div>

      {overview.isError && (
        <p role="alert" className="text-sm text-destructive">
          {staffErrorMessage(overview.error)}
        </p>
      )}
      {overview.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading the dashboard…
        </p>
      )}

      {d && view && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Members"
              value={String(d.members.length)}
              note={`${view.status("active")} active`}
            />
            <Kpi
              label="Savings held"
              value={formatMoney(d.savingsHeld, cur)}
              note="Confirmed savings only"
              tone="good"
            />
            <Kpi
              label="Fees collected"
              value={formatMoney(d.feesCollected, cur)}
              note="Not savings"
            />
            <Kpi
              label="Needs attention"
              value={String(d.missedContributions + d.openInvoices)}
              note={`${d.missedContributions} missed, ${d.openInvoices} overdue subscriptions`}
              tone={
                d.missedContributions + d.openInvoices > 0 ? "warn" : "default"
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              id="chart-money-in"
              title="Money in each month"
              subtitle={`${formatMoney(inThisMonth, cur)} so far this month. Tap a name below to hide it.`}
            >
              {view.monthly.every(
                (m) =>
                  m.savings === "0.00" &&
                  m.registration === "0.00" &&
                  m.subscription === "0.00",
              ) ? (
                <EmptyChart message="No payments recorded in this period yet." />
              ) : (
                <StackedBars
                  title="Money in each month, split into savings, registration fees and subscriptions"
                  labels={view.labels}
                  tooltipLabels={view.tips}
                  format={fmt}
                  series={[
                    {
                      key: "savings",
                      label: "Savings",
                      color: CHART_COLORS.savings,
                      values: view.monthly.map((m) => num(m.savings)),
                    },
                    {
                      key: "subscription",
                      label: "Subscriptions",
                      color: CHART_COLORS.subscription,
                      values: view.monthly.map((m) => num(m.subscription)),
                    },
                    {
                      key: "registration",
                      label: "Registration",
                      color: CHART_COLORS.registration,
                      values: view.monthly.map((m) => num(m.registration)),
                    },
                  ]}
                />
              )}
            </ChartCard>

            <ChartCard
              id="chart-savings"
              title="Savings held over time"
              subtitle="What members have saved with iSave, month by month."
            >
              <LineChart
                title="Total confirmed savings at the end of each month"
                labels={view.labels}
                tooltipLabels={view.tips}
                format={fmt}
                series={[
                  {
                    key: "savings",
                    label: "Savings held",
                    color: CHART_COLORS.savings,
                    values: view.savingsRun.map(num),
                  },
                ]}
              />
            </ChartCard>

            <ChartCard
              id="chart-members"
              title="Membership growth"
              subtitle="Everyone who has applied, counted month by month."
            >
              <LineChart
                title="Total members at the end of each month"
                labels={view.labels}
                tooltipLabels={view.tips}
                format={(n) => `${n} member${n === 1 ? "" : "s"}`}
                integerAxis
                series={[
                  {
                    key: "members",
                    label: "Members",
                    color: CHART_COLORS.subscription,
                    values: view.growth,
                  },
                ]}
              />
            </ChartCard>

            <ChartCard
              id="chart-status"
              title="Who is in iSave"
              subtitle="Members by account status."
            >
              <DonutChart
                title="Members by account status"
                centerValue={String(d.members.length)}
                centerLabel="members"
                format={(n) => String(n)}
                slices={[
                  {
                    key: "active",
                    label: "Active",
                    value: view.status("active"),
                    color: CHART_COLORS.savings,
                  },
                  {
                    key: "pending",
                    label: "Waiting for activation",
                    value: view.status("pending"),
                    color: CHART_COLORS.registration,
                  },
                  {
                    key: "suspended",
                    label: "Suspended",
                    value: view.status("suspended"),
                    color: CHART_COLORS.warn,
                  },
                  {
                    key: "closed",
                    label: "Closed",
                    value: view.status("closed"),
                    color: CHART_COLORS.neutral,
                  },
                ].filter((s) => s.value > 0)}
              />
            </ChartCard>
          </div>
        </>
      )}

      <section aria-labelledby="admin-sections">
        <h2
          id="admin-sections"
          className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Manage
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <p className="font-semibold group-hover:text-primary">
                {s.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
