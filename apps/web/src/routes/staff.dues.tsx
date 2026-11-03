import { LoadingSkeleton } from "@/components/ui/motion";
import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageMemberButton } from "@/components/staff/MessageMemberButton";
import { Button } from "@/components/ui/button";
import {
  dueBucket,
  dueWording,
  todayInZimbabwe,
  type DueBucket,
} from "@/lib/due-dates";
import { useDueList, type DueRow } from "@/lib/dues-list";
import { formatMoney } from "@/lib/money";
import { formatCalendarDay, staffErrorMessage } from "@/lib/staff-utils";
import { STAFF_TEMPLATES, memberFirstName } from "@/lib/whatsapp";

export const Route = createFileRoute("/staff/dues")({
  component: DuesPage,
});

type Filter = "overdue" | "week" | "month" | "all";
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "This week" },
  { value: "month", label: "Next 30 days" },
  { value: "all", label: "Everything" },
];

function inFilter(bucket: DueBucket, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "month") return bucket === "week" || bucket === "month";
  return bucket === f;
}

function DuesPage() {
  const dues = useDueList();
  const today = todayInZimbabwe();
  const [filter, setFilter] = useState<Filter>("overdue");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { overdue: 0, week: 0, month: 0, all: 0 };
    for (const r of dues.data ?? []) {
      const b = dueBucket(r.dueDate, today);
      for (const f of FILTERS) if (inFilter(b, f.value)) c[f.value] += 1;
    }
    return c;
  }, [dues.data, today]);

  const rows = (dues.data ?? []).filter((r) =>
    inFilter(dueBucket(r.dueDate, today), filter),
  );

  return (
    <div>
      <h1 className="text-3xl font-semibold md:text-4xl">Who is due</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Contributions that are overdue or coming up. Tap the WhatsApp icon to
        send a reminder: the message is typed for you and you check it before
        WhatsApp opens.
      </p>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label} ({dues.data ? counts[f.value] : "…"})
          </Button>
        ))}
      </div>

      {dues.isPending && <LoadingSkeleton />}
      {dues.isError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {staffErrorMessage(dues.error)}
        </p>
      )}
      {dues.data && rows.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Nobody in this group.
        </p>
      )}

      <ul className="mt-6 grid list-none gap-3 p-0">
        {rows.map((r) => (
          <DueLine key={r.id} row={r} today={today} />
        ))}
      </ul>
    </div>
  );
}

function DueLine({ row, today }: { row: DueRow; today: string }) {
  const first = memberFirstName(row.memberName) || "there";
  const amountText = row.amount ? formatMoney(row.amount, row.currency) : null;
  const overdue = dueBucket(row.dueDate, today) === "overdue";
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-md border border-border p-4">
      <div className="min-w-0 flex-1">
        <Link
          to="/staff/members/$memberId"
          params={{ memberId: row.memberId }}
          className="font-medium text-primary underline underline-offset-4"
        >
          {row.memberName || "(no name)"}
        </Link>
        <p className="text-xs text-muted-foreground">
          {row.memberNumber}
          {row.planName ? ` · ${row.planName}` : ""}
        </p>
        <p className="mt-1 text-sm">
          {amountText ?? "Amount set when paid"} on{" "}
          {formatCalendarDay(row.dueDate)}{" "}
          <span
            className={
              overdue
                ? "font-semibold text-destructive"
                : "text-muted-foreground"
            }
          >
            ({dueWording(row.dueDate, today)})
          </span>
        </p>
      </div>
      {row.phone ? (
        <MessageMemberButton
          memberName={row.memberName}
          phone={row.phone}
          label="Remind on WhatsApp"
          optedIn={row.whatsappOptIn}
          templates={[
            {
              label: "Reminder",
              text: STAFF_TEMPLATES.reminder(
                first,
                amountText,
                formatCalendarDay(row.dueDate),
              ),
            },
            { label: "Hello", text: STAFF_TEMPLATES.general(first) },
          ]}
        />
      ) : (
        <span className="text-xs text-muted-foreground">No phone number</span>
      )}
    </li>
  );
}
