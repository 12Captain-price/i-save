import { formatMoney } from "@/lib/money";
import { OFFICE_CONTACT } from "@/lib/office-contact";
import type { ReceiptDetail } from "@/lib/staff";
import {
  formatDateTime,
  providerLabel,
  purposeLabel,
  receiptPurposeNote,
} from "@/lib/staff-utils";

/**
 * The receipt as it prints. It is always black on white, whatever the screen theme, so the
 * printed copy is the same on every printer. The `receipt-print` class is what the print
 * stylesheet keys on.
 */
export function ReceiptSlip({
  receipt,
  printedAt,
}: {
  receipt: ReceiptDetail;
  printedAt: string;
}) {
  const note = receiptPurposeNote(receipt.purpose);
  const contact = [
    OFFICE_CONTACT.address,
    OFFICE_CONTACT.phone,
    OFFICE_CONTACT.email,
  ].filter((v): v is string => Boolean(v));

  return (
    <article
      aria-label={`Receipt ${receipt.receiptNumber}`}
      className="receipt-print mx-auto w-full max-w-md rounded-md border border-neutral-300 bg-white p-6 text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="border-b border-neutral-300 pb-4 text-center">
        <p className="text-2xl font-bold tracking-tight">i-Save</p>
        <p className="text-xs text-neutral-600">
          Saving today for a better tomorrow
        </p>
        {contact.map((line) => (
          <p key={line} className="text-xs text-neutral-600">
            {line}
          </p>
        ))}
        <p className="mt-3 text-sm font-semibold tracking-widest uppercase">
          Receipt
        </p>
      </header>

      {receipt.reversed && (
        <p
          role="alert"
          className="mt-4 rounded border-2 border-red-700 p-2 text-center text-sm font-bold text-red-700 uppercase"
        >
          Reversed. This receipt is no longer valid.
        </p>
      )}

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <Row label="Receipt no.">
          <span className="font-bold">{receipt.receiptNumber}</span>
        </Row>
        <Row label="Date">{formatDateTime(receipt.issuedAt)}</Row>
        <Row label="Member">
          {receipt.memberName || "(no name)"}
          <br />
          <span className="text-neutral-600">{receipt.memberNumber}</span>
        </Row>
        <Row label="Payment for">{purposeLabel(receipt.purpose)}</Row>
        <Row label="Paid by">{providerLabel(receipt.provider)}</Row>
        <Row label="Book no.">{receipt.officeReceiptNo ?? "—"}</Row>
      </dl>

      <div className="mt-4 flex items-baseline justify-between border-y-2 border-neutral-900 py-3">
        <span className="text-sm font-semibold uppercase">Amount received</span>
        <span className="text-2xl font-bold">
          {formatMoney(receipt.amount, receipt.currency)}
        </span>
      </div>

      {note && <p className="mt-3 text-xs text-neutral-700">{note}</p>}

      <footer className="mt-6 grid gap-1 text-xs text-neutral-600">
        <p>Received by: {receipt.issuedByName ?? "i-Save office"}</p>
        <p>Printed: {printedAt}</p>
        <p>Keep this receipt as proof of payment.</p>
      </footer>
    </article>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-xs font-semibold text-neutral-600 uppercase">
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </>
  );
}
