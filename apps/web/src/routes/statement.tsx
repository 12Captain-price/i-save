import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useMemberLedger } from "@/lib/dashboard-data";
import { formatMoney } from "@/lib/money";
import { OFFICE_CONTACT } from "@/lib/office-contact";
import { formatDate, staffErrorMessage } from "@/lib/staff-utils";
import { buildStatement } from "@/lib/statement";

export const Route = createFileRoute("/statement")({
  component: StatementPage,
});

/** The signed-in member's own statement. "Print or save as PDF" uses the browser, the same
 *  way receipts do, so it works on any phone or computer. The database only returns this
 *  member's own rows. */
function StatementPage() {
  const { loading, session, profile } = useAuth();
  const ledger = useMemberLedger(profile?.id ?? "");
  if (loading) return <Shell>Loading…</Shell>;
  if (!session) return <Navigate to="/login" />;
  if (!profile) return <Shell>Your account could not be found.</Shell>;

  const currencies = [
    ...new Set((ledger.data ?? []).map((r) => r.currency)),
  ];
  if (currencies.length === 0) currencies.push("USD");

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/account"
          className="text-sm text-primary underline underline-offset-4"
        >
          ← Back to my account
        </Link>
        <Button onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print or save as PDF
        </Button>
      </div>

      <article className="receipt-print mx-auto mt-6 w-full max-w-3xl rounded-md border border-neutral-300 bg-white p-6 text-neutral-900 print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="border-b border-neutral-300 pb-4">
          <p className="text-2xl font-bold tracking-tight">i-Save</p>
          <p className="text-xs text-neutral-600">
            {[OFFICE_CONTACT.address, OFFICE_CONTACT.phone, OFFICE_CONTACT.email]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-3 text-sm font-semibold tracking-widest uppercase">
            Member statement
          </p>
          <p className="mt-1 text-sm">
            {profile.fullName || "(no name)"} · {profile.memberNumber}
          </p>
          <p className="text-xs text-neutral-600">
            Printed {formatDate(new Date().toISOString())}
          </p>
        </header>

        {ledger.isPending && <p className="mt-4 text-sm">Loading…</p>}
        {ledger.isError && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {staffErrorMessage(ledger.error)}
          </p>
        )}

        {ledger.data &&
          currencies.map((cur) => {
            const s = buildStatement(ledger.data, cur);
            return (
              <section key={cur} className="mt-6" aria-label={`${cur} statement`}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <p>
                    <span className="block text-xs font-semibold text-neutral-600 uppercase">
                      Confirmed savings
                    </span>
                    <span className="text-xl font-bold">
                      {formatMoney(s.totalSavings, cur)}
                    </span>
                  </p>
                  <p>
                    <span className="block text-xs font-semibold text-neutral-600 uppercase">
                      Fees paid (not savings)
                    </span>
                    <span className="text-xl font-bold">
                      {formatMoney(s.totalFees, cur)}
                    </span>
                  </p>
                </div>
                {s.rows.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-600">
                    No payments have been recorded yet.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-neutral-900 text-xs uppercase">
                          <th scope="col" className="py-2 pr-3">Date</th>
                          <th scope="col" className="py-2 pr-3">Description</th>
                          <th scope="col" className="py-2 pr-3 text-right">Savings</th>
                          <th scope="col" className="py-2 pr-3 text-right">Fees</th>
                          <th scope="col" className="py-2 text-right">Savings balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.map((r) => (
                          <tr key={r.id} className="border-b border-neutral-200">
                            <td className="py-2 pr-3">{formatDate(r.date)}</td>
                            <td className="py-2 pr-3">{r.description}</td>
                            <td className="py-2 pr-3 text-right">
                              {formatMoney(r.savingsChange, cur)}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {formatMoney(r.feeChange, cur)}
                            </td>
                            <td className="py-2 text-right font-semibold">
                              {formatMoney(r.savingsBalance, cur)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}

        <footer className="mt-6 border-t border-neutral-300 pt-3 text-xs text-neutral-600">
          <p>
            Only payments that the office has confirmed are counted. This
            statement is not a promise of interest, bonus or return.
          </p>
        </footer>
      </article>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">{children}</div>
    </PublicLayout>
  );
}
