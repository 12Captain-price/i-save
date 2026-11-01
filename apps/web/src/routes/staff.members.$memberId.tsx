import { Link, createFileRoute } from "@tanstack/react-router";
import { IdSightingCard } from "@/components/staff/IdSightingCard";
import { RecordPaymentCard } from "@/components/staff/RecordPaymentCard";
import { StatusPill } from "@/components/staff/StatusPill";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { usePublicFees } from "@/lib/public-fees";
import {
  useMember,
  useMemberBalances,
  useMemberDueItems,
  useMemberInvoices,
  useMemberReceipts,
} from "@/lib/staff";
import {
  formatDateTime,
  providerLabel,
  purposeLabel,
  staffErrorMessage,
} from "@/lib/staff-utils";

export const Route = createFileRoute("/staff/members/$memberId")({
  component: MemberPage,
});

function MemberPage() {
  const { memberId } = Route.useParams();
  const { session } = useAuth();
  const member = useMember(memberId);
  const balances = useMemberBalances(memberId);
  const receipts = useMemberReceipts(memberId);
  const dues = useMemberDueItems(memberId);
  const invoices = useMemberInvoices(memberId);
  const fees = usePublicFees();

  const back = (
    <Link
      to="/staff"
      className="text-sm text-primary underline underline-offset-4"
    >
      ← Back to members
    </Link>
  );

  if (member.isPending) {
    return (
      <div>
        {back}
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          Loading member…
        </p>
      </div>
    );
  }
  if (member.isError) {
    return (
      <div>
        {back}
        <p role="alert" className="mt-6 text-sm text-destructive">
          {staffErrorMessage(member.error)}
        </p>
      </div>
    );
  }
  if (!member.data) {
    return (
      <div>
        {back}
        <p className="mt-6 text-sm">That member could not be found.</p>
      </div>
    );
  }

  const m = member.data;
  const isSelf = session?.user.id === m.id;

  return (
    <div className="grid gap-6">
      <div>
        {back}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold md:text-4xl">
            {m.full_name || "(no name)"}
          </h1>
          <StatusPill status={m.status} />
        </div>
        <dl className="mt-5 grid gap-4 rounded-md border border-border bg-card p-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Member number">{m.member_number}</Detail>
          <Detail label="Phone">{m.phone ?? "—"}</Detail>
          <Detail label="Email">{m.email ?? "—"}</Detail>
          <Detail label="Joined">
            {formatDateTime(m.created_at)} (
            {m.registered_via === "staff" ? "in the office" : "online"})
          </Detail>
        </dl>
        {isSelf && (
          <p className="mt-3 text-xs text-muted-foreground">
            This is your own account. You can look, but another staff member has
            to check your ID and record your payments.
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <IdSightingCard member={m} isSelf={isSelf} />
        <RecordPaymentCard
          member={m}
          isSelf={isSelf}
          dues={dues.data ?? []}
          invoices={invoices.data ?? []}
          fees={fees.data}
        />
      </div>

      <section
        aria-labelledby="balances-heading"
        className="rounded-md border border-border bg-card p-6"
      >
        <h2 id="balances-heading" className="text-lg font-semibold">
          Balances
        </h2>
        {balances.isPending && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {balances.isError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {staffErrorMessage(balances.error)}
          </p>
        )}
        {balances.data && balances.data.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing has been paid yet.
          </p>
        )}
        {balances.data?.map((b) => (
          <dl
            key={b.currency}
            className="mt-4 grid gap-4 text-sm sm:grid-cols-2"
          >
            <Detail label="Confirmed savings">
              <span className="text-xl font-semibold">
                {formatMoney(b.savings, b.currency)}
              </span>
            </Detail>
            <Detail label="Fees paid (not savings)">
              <span className="text-xl font-semibold">
                {formatMoney(b.fees, b.currency)}
              </span>
            </Detail>
          </dl>
        ))}
      </section>

      <section
        aria-labelledby="receipts-heading"
        className="rounded-md border border-border bg-card p-6"
      >
        <h2 id="receipts-heading" className="text-lg font-semibold">
          Receipts
        </h2>
        {receipts.isPending && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {receipts.isError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {staffErrorMessage(receipts.error)}
          </p>
        )}
        {receipts.data && receipts.data.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">No receipts yet.</p>
        )}
        {receipts.data && receipts.data.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
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
                  <th scope="col" className="py-2 pr-4">
                    Paid by
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Book no.
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
                      <Link
                        to="/staff/receipts/$receiptNumber"
                        params={{ receiptNumber: r.receiptNumber }}
                        className="text-primary underline underline-offset-4"
                        aria-label={`Open receipt ${r.receiptNumber} to print`}
                      >
                        {r.receiptNumber}
                      </Link>
                      {r.reversed && (
                        <span className="ml-2">
                          <StatusPill status="reversed" />
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">{formatDateTime(r.issuedAt)}</td>
                    <td className="py-3 pr-4">{purposeLabel(r.purpose)}</td>
                    <td className="py-3 pr-4">{providerLabel(r.provider)}</td>
                    <td className="py-3 pr-4">{r.officeReceiptNo ?? "—"}</td>
                    <td className="py-3 text-right font-medium">
                      {formatMoney(r.amount, r.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}
