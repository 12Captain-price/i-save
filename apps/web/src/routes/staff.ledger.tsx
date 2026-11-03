import { LoadingSkeleton } from "@/components/ui/motion";
import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { StatusPill } from "@/components/staff/StatusPill";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { useLedgerSearch, type LedgerQuery } from "@/lib/ledger-audit";
import { formatMoney } from "@/lib/money";
import {
  formatDateTime,
  isDayRangeBackwards,
  purposeLabel,
  staffErrorMessage,
} from "@/lib/staff-utils";

export const Route = createFileRoute("/staff/ledger")({
  component: LedgerPage,
});

const EMPTY: LedgerQuery = {
  term: "",
  fromDay: "",
  toDay: "",
  reversalsOnly: false,
  page: 0,
};

function LedgerPage() {
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const backwards = isDayRangeBackwards(draft.fromDay, draft.toDay);
  const ledger = useLedgerSearch(applied);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (backwards) return;
    setApplied({ ...draft, page: 0 });
  }

  function clear() {
    setDraft(EMPTY);
    setApplied(EMPTY);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold md:text-4xl">Ledger</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every payment and reversal on record, newest first. Search by member
        name or number, our receipt number (RCT-…), the number in the paper
        receipt book, or the ledger reference. Nothing here can be edited.
      </p>

      <form
        onSubmit={onSubmit}
        role="search"
        className="mt-8 grid gap-4 md:grid-cols-[2fr_1fr_1fr]"
      >
        <div>
          <label
            htmlFor="ledger-term"
            className="mb-1.5 block text-sm font-medium"
          >
            Search
          </label>
          <input
            id="ledger-term"
            type="search"
            className={inputClass}
            value={draft.term}
            onChange={(e) => setDraft({ ...draft, term: e.target.value })}
            placeholder="Name, member number, RCT-00000005, R-4001"
          />
        </div>
        <div>
          <label
            htmlFor="ledger-from"
            className="mb-1.5 block text-sm font-medium"
          >
            From date
          </label>
          <input
            id="ledger-from"
            type="date"
            className={inputClass}
            value={draft.fromDay}
            onChange={(e) => setDraft({ ...draft, fromDay: e.target.value })}
          />
        </div>
        <div>
          <label
            htmlFor="ledger-to"
            className="mb-1.5 block text-sm font-medium"
          >
            To date
          </label>
          <input
            id="ledger-to"
            type="date"
            className={inputClass}
            value={draft.toDay}
            onChange={(e) => setDraft({ ...draft, toDay: e.target.value })}
            aria-invalid={backwards}
            aria-describedby={backwards ? "ledger-range-error" : undefined}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 md:col-span-3">
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.reversalsOnly}
              onChange={(e) =>
                setDraft({ ...draft, reversalsOnly: e.target.checked })
              }
            />
            Show reversals only
          </label>
          <Button type="submit" disabled={backwards}>
            Search
          </Button>
          <Button type="button" variant="outline" onClick={clear}>
            Clear
          </Button>
        </div>
        {backwards && (
          <p
            id="ledger-range-error"
            role="alert"
            className="text-sm text-destructive md:col-span-3"
          >
            The “to” date is before the “from” date.
          </p>
        )}
      </form>

      <div className="mt-8" aria-live="polite">
        {ledger.isPending && <LoadingSkeleton />}
        {ledger.isError && (
          <p role="alert" className="text-sm text-destructive">
            {staffErrorMessage(ledger.error)}
          </p>
        )}
        {ledger.data && ledger.data.rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing matches that search.
          </p>
        )}
        {ledger.data && ledger.data.rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <caption className="sr-only">
                Ledger entries, newest first
              </caption>
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    When
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Member
                  </th>
                  <th scope="col" className="px-3 py-2">
                    What
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Amount
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Receipt
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Recorded by
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledger.data.rows.map((row) => {
                  const isReversal = row.type === "reversal";
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-border align-top"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDateTime(row.createdAt)}
                        <div className="text-xs text-muted-foreground">
                          {row.reference}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to="/staff/members/$memberId"
                          params={{ memberId: row.memberId }}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {row.memberName || row.memberNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {row.memberNumber}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="mr-2">{purposeLabel(row.type)}</span>
                        {isReversal && <StatusPill status="reversed" />}
                        {!isReversal && row.reversed && (
                          <StatusPill
                            status="reversed"
                            label="Later reversed"
                          />
                        )}
                        {isReversal && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Reverses {row.reversesReference}
                            {row.reason ? `. Reason: ${row.reason}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">
                        {isReversal ? "−" : ""}
                        {formatMoney(row.amount, row.currency)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.receiptNumber ? (
                          <Link
                            to="/staff/receipts/$receiptNumber"
                            params={{ receiptNumber: row.receiptNumber }}
                            className="underline-offset-2 hover:underline"
                          >
                            {row.receiptNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {row.officeReceiptNo && (
                          <div className="text-xs text-muted-foreground">
                            Book no. {row.officeReceiptNo}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.recordedBy ?? "System"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {ledger.data && (applied.page > 0 || ledger.data.hasMore) && (
          <div className="mt-4 flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              disabled={applied.page === 0}
              onClick={() => setApplied({ ...applied, page: applied.page - 1 })}
            >
              Newer
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {applied.page + 1}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={!ledger.data.hasMore}
              onClick={() => setApplied({ ...applied, page: applied.page + 1 })}
            >
              Older
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
