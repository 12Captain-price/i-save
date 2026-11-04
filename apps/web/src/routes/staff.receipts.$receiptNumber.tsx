import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { useOfficeContact } from "@/lib/office-contact-db";
import { ReceiptSlip } from "@/components/staff/ReceiptSlip";
import { ReverseReceiptCard } from "@/components/staff/ReverseReceiptCard";
import { MessageMemberButton } from "@/components/staff/MessageMemberButton";
import { Button } from "@/components/ui/button";
import { useMember, useReceiptDetail } from "@/lib/staff";
import { STAFF_TEMPLATES, memberFirstName } from "@/lib/whatsapp";
import {
  formatDate,
  formatDateTime,
  purposeLabel,
  staffErrorMessage,
} from "@/lib/staff-utils";

export const Route = createFileRoute("/staff/receipts/$receiptNumber")({
  component: ReceiptPage,
});

function ReceiptPage() {
  const { receiptNumber } = Route.useParams();
  const receipt = useReceiptDetail(receiptNumber);
  const office = useOfficeContact();
  const owner = useMember(receipt.data?.memberId ?? "");
  // Fixed when the page opens, so the "Printed" line does not change while it is on screen.
  const [openedAt] = useState(() => new Date().toISOString());

  if (receipt.isPending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading receipt…
      </p>
    );
  }
  if (receipt.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {staffErrorMessage(receipt.error)}
      </p>
    );
  }
  if (!receipt.data) {
    return (
      <div>
        <p className="text-sm">
          No receipt {receiptNumber} was found. Check the number and try again.
        </p>
        <Link
          to="/staff"
          className="mt-4 inline-block text-sm text-primary underline underline-offset-4"
        >
          ← Back to members
        </Link>
      </div>
    );
  }

  const r = receipt.data;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/staff/members/$memberId"
          params={{ memberId: r.memberId }}
          className="text-sm text-primary underline underline-offset-4"
        >
          ← Back to {r.memberName || "member"}
        </Link>
        <div className="flex flex-wrap gap-2">
          {!r.reversed && (
            <MessageMemberButton
              memberName={r.memberName}
              phone={owner.data?.phone ?? null}
              label="Send receipt on WhatsApp"
              showLabel
              optedIn={owner.data?.whatsapp_opt_in}
              templates={[
                {
                  label: "Receipt",
                  text: STAFF_TEMPLATES.receipt(
                    memberFirstName(r.memberName) || "there",
                    {
                      receiptNumber: r.receiptNumber,
                      amount: r.amount,
                      currency: r.currency,
                      purposeLabel: purposeLabel(r.purpose),
                      issuedOn: formatDate(r.issuedAt),
                    },
                  ),
                },
              ]}
            />
          )}
          <Button onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Print receipt
          </Button>
        </div>
      </div>
      <ReceiptSlip
        receipt={r}
        printedAt={formatDateTime(openedAt)}
        office={office ?? undefined}
      />
      <p className="text-center text-xs text-muted-foreground print:hidden">
        Printing again later gives a copy of the same receipt. The receipt
        number and the book number stay the same.
      </p>
      <ReverseReceiptCard receipt={r} />
    </div>
  );
}
