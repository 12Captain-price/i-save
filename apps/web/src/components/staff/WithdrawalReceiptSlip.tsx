import type { ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import { OFFICE_CONTACT, type OfficeContact } from "@/lib/office-contact";
import { formatDateTime } from "@/lib/staff-utils";
import type { WithdrawalReceipt } from "@/lib/withdrawals";

/**
 * The withdrawal receipt as it prints: black on white whatever the screen theme, like the
 * payment receipt. It names the member and every staff member who handled the withdrawal.
 */
export function WithdrawalReceiptSlip({
  receipt,
  printedAt,
  office = OFFICE_CONTACT,
}: {
  receipt: WithdrawalReceipt;
  printedAt: string;
  /** The live office details. Defaults to the approved starting values. */
  office?: OfficeContact;
}) {
  const contact = [
    office.address,
    office.phone,
    office.email,
  ].filter((v): v is string => Boolean(v));
  const hasFee = Number(receipt.feeAmount) > 0;

  return (
    <article
      aria-label={`Withdrawal receipt ${receipt.receiptNumber}`}
      className="receipt-print mx-auto w-full max-w-md rounded-md border border-neutral-300 bg-white p-6 text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="border-b border-neutral-300 pb-4 text-center">
        <img
          src="/images/isave-logo-dark.webp"
          alt="i-Save: Saving today for a better tomorrow"
          width={600}
          height={240}
          className="mx-auto mb-2 h-20 w-auto rounded-md"
        />
        {contact.map((line) => (
          <p key={line} className="text-xs text-neutral-600">
            {line}
          </p>
        ))}
        <p className="mt-3 text-sm font-semibold tracking-widest uppercase">
          Withdrawal receipt
        </p>
      </header>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <Row label="Receipt no.">
          <span className="font-bold">{receipt.receiptNumber}</span>
        </Row>
        <Row label="Date paid">
          {receipt.paidAt ? formatDateTime(receipt.paidAt) : "—"}
        </Row>
        <Row label="Member">
          {receipt.memberName || "(no name)"}
          <br />
          <span className="text-neutral-600">{receipt.memberNumber}</span>
        </Row>
        <Row label="Type">
          {receipt.earlyExit ? "Early exit" : "Plan completed"}
        </Row>
        <Row label="Paid by">
          {receipt.payoutMethod === "ecocash"
            ? `EcoCash ${receipt.payoutNumber ?? ""}`
            : "Cash at the office"}
          {receipt.payoutMethod === "ecocash" && receipt.payoutName && (
            <>
              <br />
              <span className="text-neutral-600">
                in the name of {receipt.payoutName}
              </span>
            </>
          )}
        </Row>
        <Row label="Payout ref.">{receipt.payoutReference ?? "—"}</Row>
      </dl>

      <div className="mt-4 grid gap-1 border-t-2 border-neutral-900 pt-3 text-sm">
        <Line
          label="Savings withdrawn"
          value={formatMoney(receipt.amount, receipt.currency)}
        />
        {hasFee && (
          <Line
            label="Early-exit fee"
            value={`− ${formatMoney(receipt.feeAmount, receipt.currency)}`}
          />
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between border-y-2 border-neutral-900 py-3">
        <span className="text-sm font-semibold uppercase">Amount paid out</span>
        <span className="text-2xl font-bold">
          {formatMoney(receipt.netAmount, receipt.currency)}
        </span>
      </div>

      <section className="mt-4" aria-label="Who handled this withdrawal">
        <p className="text-xs font-semibold text-neutral-600 uppercase">
          Handled by
        </p>
        <ul className="mt-1 grid gap-1 text-sm">
          <li>
            Requested by <strong>{receipt.memberName}</strong>,{" "}
            {formatDateTime(receipt.requestedAt)}
          </li>
          <li>
            Reviewed by <strong>{receipt.reviewedByName}</strong>
            {receipt.reviewedAt
              ? `, ${formatDateTime(receipt.reviewedAt)}`
              : ""}
          </li>
          <li>
            Approved by <strong>{receipt.approvedByName}</strong>
            {receipt.approvedAt
              ? `, ${formatDateTime(receipt.approvedAt)}`
              : ""}
          </li>
          <li>
            Paid out by <strong>{receipt.paidByName}</strong>
            {receipt.paidAt ? `, ${formatDateTime(receipt.paidAt)}` : ""}
          </li>
        </ul>
      </section>

      <p className="mt-4 text-xs text-neutral-700">
        This was your confirmed savings. Registration and subscription fees are
        not savings and are not refunded. Your plan closed when this was paid.
      </p>

      <footer className="mt-6 grid gap-1 text-xs text-neutral-600">
        <p>Printed: {printedAt}</p>
        <p>Keep this receipt as proof of withdrawal.</p>
      </footer>
    </article>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs font-semibold text-neutral-600 uppercase">
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </>
  );
}
