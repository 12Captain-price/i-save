import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { StatusPill } from "@/components/staff/StatusPill";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { useAuth } from "@/lib/auth";
import {
  AUDIT_ACTION_OPTIONS,
  useAuditSearch,
  type AuditQuery,
} from "@/lib/ledger-audit";
import {
  auditActionLabel,
  auditDetailsSummary,
  formatDateTime,
  isAdminRole,
  isDayRangeBackwards,
  isSensitiveAuditAction,
  staffErrorMessage,
} from "@/lib/staff-utils";

export const Route = createFileRoute("/staff/audit")({
  component: AuditPage,
});

const EMPTY: AuditQuery = {
  term: "",
  action: "",
  fromDay: "",
  toDay: "",
  page: 0,
};

function AuditPage() {
  const { roles } = useAuth();
  if (!isAdminRole(roles)) {
    return (
      <div>
        <h1 className="text-3xl font-semibold md:text-4xl">Audit log</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          The audit log is for administrators only.
        </p>
      </div>
    );
  }
  return <AuditLog />;
}

function AuditLog() {
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const backwards = isDayRangeBackwards(draft.fromDay, draft.toDay);
  const audit = useAuditSearch(applied);

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
      <h1 className="text-3xl font-semibold md:text-4xl">Audit log</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Who did what, and when. Every reversal, office payment, ID check and
        sign-off is recorded here and cannot be changed or deleted. ID numbers
        are never shown; the log only records that an ID was viewed.
      </p>

      <form
        onSubmit={onSubmit}
        role="search"
        className="mt-8 grid gap-4 md:grid-cols-4"
      >
        <div className="md:col-span-2">
          <label
            htmlFor="audit-term"
            className="mb-1.5 block text-sm font-medium"
          >
            Search
          </label>
          <input
            id="audit-term"
            type="search"
            className={inputClass}
            value={draft.term}
            onChange={(e) => setDraft({ ...draft, term: e.target.value })}
            placeholder="Staff name, member name or number, receipt number"
          />
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor="audit-action"
            className="mb-1.5 block text-sm font-medium"
          >
            What happened
          </label>
          <select
            id="audit-action"
            className={inputClass}
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
          >
            <option value="">All actions</option>
            {AUDIT_ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="audit-from"
            className="mb-1.5 block text-sm font-medium"
          >
            From date
          </label>
          <input
            id="audit-from"
            type="date"
            className={inputClass}
            value={draft.fromDay}
            onChange={(e) => setDraft({ ...draft, fromDay: e.target.value })}
          />
        </div>
        <div>
          <label
            htmlFor="audit-to"
            className="mb-1.5 block text-sm font-medium"
          >
            To date
          </label>
          <input
            id="audit-to"
            type="date"
            className={inputClass}
            value={draft.toDay}
            onChange={(e) => setDraft({ ...draft, toDay: e.target.value })}
            aria-invalid={backwards}
            aria-describedby={backwards ? "audit-range-error" : undefined}
          />
        </div>
        <div className="flex items-end gap-3 md:col-span-2">
          <Button type="submit" disabled={backwards}>
            Search
          </Button>
          <Button type="button" variant="outline" onClick={clear}>
            Clear
          </Button>
        </div>
        {backwards && (
          <p
            id="audit-range-error"
            role="alert"
            className="text-sm text-destructive md:col-span-4"
          >
            The “to” date is before the “from” date.
          </p>
        )}
      </form>

      <div className="mt-8" aria-live="polite">
        {audit.isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {audit.isError && (
          <p role="alert" className="text-sm text-destructive">
            {staffErrorMessage(audit.error)}
          </p>
        )}
        {audit.data && audit.data.rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing matches that search.
          </p>
        )}
        {audit.data && audit.data.rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <caption className="sr-only">Audit entries, newest first</caption>
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    When
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Who did it
                  </th>
                  <th scope="col" className="px-3 py-2">
                    What happened
                  </th>
                  <th scope="col" className="px-3 py-2">
                    About
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Receipt
                  </th>
                </tr>
              </thead>
              <tbody>
                {audit.data.rows.map((row) => {
                  const summary = auditDetailsSummary(row.action, row.details);
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-border align-top"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-3 py-2">{row.actorName}</td>
                      <td className="px-3 py-2">
                        <span className="mr-2">
                          {auditActionLabel(row.action)}
                        </span>
                        {isSensitiveAuditAction(row.action) && (
                          <StatusPill
                            status={
                              row.action === "ledger.reversed"
                                ? "reversed"
                                : "open"
                            }
                            label="Review"
                          />
                        )}
                        {summary && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {summary}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.subjectMemberId ? (
                          <>
                            <Link
                              to="/staff/members/$memberId"
                              params={{ memberId: row.subjectMemberId }}
                              className="underline-offset-2 hover:underline"
                            >
                              {row.subjectName || row.subjectNumber}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {row.subjectNumber}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {audit.data && (applied.page > 0 || audit.data.hasMore) && (
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
              disabled={!audit.data.hasMore}
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
