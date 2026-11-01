import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { StatusPill } from "@/components/staff/StatusPill";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import {
  signOffDailyReport,
  useDailyReport,
  type ReportRow,
  type Signoff,
} from "@/lib/staff";
import {
  formatCalendarDay,
  formatDateTime,
  isAdminRole,
  staffErrorMessage,
} from "@/lib/staff-utils";

export const Route = createFileRoute("/staff/report")({
  component: DailyReportPage,
});

type Group = {
  key: string;
  reportDate: string;
  staffId: string | null;
  staffName: string;
  rows: ReportRow[];
};

function groupRows(rows: ReportRow[]): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const key = `${row.reportDate}|${row.staffId ?? "system"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, {
        key,
        reportDate: row.reportDate,
        staffId: row.staffId,
        staffName: row.staffName,
        rows: [row],
      });
    }
  }
  // Rows arrive newest day first; keep that order.
  return [...groups.values()];
}

function DailyReportPage() {
  const { roles, session } = useAuth();
  const report = useDailyReport();
  const groups = useMemo(
    () => groupRows(report.data?.rows ?? []),
    [report.data],
  );
  const signoffs = useMemo(() => {
    const map = new Map<string, Signoff>();
    for (const s of report.data?.signoffs ?? []) {
      map.set(`${s.reportDate}|${s.staffId}`, s);
    }
    return map;
  }, [report.data]);

  const isAdmin = isAdminRole(roles);
  const myId = session?.user.id;

  return (
    <div>
      <h1 className="text-3xl font-semibold md:text-4xl">Daily report</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        What each staff member recorded each day, cut at midnight Zimbabwe time.
        It is read straight from the payment records. At the end of the day an
        admin checks the cash against it and signs it off. Nobody can sign off
        their own day.
      </p>

      <div className="mt-8 grid gap-6" aria-live="polite">
        {report.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading report…
          </p>
        )}
        {report.isError && (
          <p role="alert" className="text-sm text-destructive">
            {staffErrorMessage(report.error)}
          </p>
        )}
        {report.data && groups.length === 0 && (
          <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
            No payments have been recorded yet.
          </p>
        )}
        {groups.map((group) => (
          <DayCard
            key={group.key}
            group={group}
            signoff={
              group.staffId
                ? (signoffs.get(`${group.reportDate}|${group.staffId}`) ?? null)
                : null
            }
            canSignOff={
              isAdmin && group.staffId !== null && group.staffId !== myId
            }
            isOwnDay={group.staffId !== null && group.staffId === myId}
          />
        ))}
      </div>
    </div>
  );
}

function DayCard({
  group,
  signoff,
  canSignOff,
  isOwnDay,
}: {
  group: Group;
  signoff: Signoff | null;
  canSignOff: boolean;
  isOwnDay: boolean;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOff() {
    if (!group.staffId) return;
    setError(null);
    setBusy(true);
    try {
      await signOffDailyReport(group.reportDate, group.staffId, note);
      await queryClient.invalidateQueries({ queryKey: ["staff", "report"] });
    } catch (e) {
      setError(staffErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const headingId = `day-${group.key.replace(/[^a-zA-Z0-9]/g, "-")}`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-md border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            {formatCalendarDay(group.reportDate)}
          </h2>
          <p className="text-sm text-muted-foreground">{group.staffName}</p>
        </div>
        {signoff ? (
          <StatusPill status="active" label="Signed off" />
        ) : (
          <StatusPill status="pending" label="Not signed off" />
        )}
      </div>

      {group.rows.map((row) => (
        <div key={row.currency} className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {row.paymentsCount} payment{row.paymentsCount === 1 ? "" : "s"} (
              {row.currency})
            </p>
            <p className="text-2xl font-semibold">
              {formatMoney(row.total, row.currency)}
            </p>
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <Figure
              label="Registration fees"
              value={formatMoney(row.registration, row.currency)}
            />
            <Figure
              label="Subscriptions"
              value={formatMoney(row.subscription, row.currency)}
            />
            <Figure
              label="Savings"
              value={formatMoney(row.savings, row.currency)}
            />
            <Figure
              label="Cash to count"
              value={formatMoney(row.cash, row.currency)}
            />
            <Figure
              label="Bank transfers"
              value={formatMoney(row.bank, row.currency)}
            />
            <Figure
              label="Other"
              value={formatMoney(row.other, row.currency)}
            />
          </dl>
          {row.reversedCount > 0 && (
            <p className="mt-3 text-sm text-destructive">
              {row.reversedCount} payment
              {row.reversedCount === 1 ? " was" : "s were"} reversed (
              {formatMoney(row.reversedTotal, row.currency)}). Reversed payments
              are not in the totals above.
            </p>
          )}
        </div>
      ))}

      <div className="mt-6 border-t border-border pt-5 text-sm">
        {signoff ? (
          <p>
            Signed off by <strong>{signoff.signedByName}</strong> on{" "}
            {formatDateTime(signoff.signedAt)}.
            {signoff.note ? ` Note: ${signoff.note}` : ""}
          </p>
        ) : canSignOff ? (
          <div className="grid gap-3 sm:max-w-md">
            <div>
              <label
                htmlFor={`${headingId}-note`}
                className="mb-1.5 block text-sm font-medium"
              >
                Note (optional)
              </label>
              <input
                id={`${headingId}-note`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="For example: cash counted and matches"
                autoComplete="off"
                className={inputClass}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div>
              <Button onClick={() => void signOff()} disabled={busy}>
                {busy ? "Signing off…" : "Sign off this day"}
              </Button>
            </div>
          </div>
        ) : isOwnDay ? (
          <p className="text-muted-foreground">
            This is your own day, so another admin has to sign it off.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Waiting for an admin to sign this day off.
          </p>
        )}
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
