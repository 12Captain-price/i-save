import { useState } from "react";
import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { WithdrawalReceiptSlip } from "@/components/staff/WithdrawalReceiptSlip";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  formatDateTime,
  isStaffRole,
  staffErrorMessage,
} from "@/lib/staff-utils";
import { useWithdrawalReceipt } from "@/lib/withdrawals";

export const Route = createFileRoute("/withdrawal-receipt/$id")({
  component: WithdrawalReceiptPage,
});

/**
 * Printable receipt for one paid withdrawal. The member who withdrew can open their own;
 * staff can open any. The database refuses everyone else.
 */
function WithdrawalReceiptPage() {
  const { id } = Route.useParams();
  const { loading, session, roles } = useAuth();
  const receipt = useWithdrawalReceipt(id);
  const [openedAt] = useState(() => new Date().toISOString());

  if (loading) {
    return <Shell>Loading…</Shell>;
  }
  if (!session) return <Navigate to="/login" />;

  const backTo = isStaffRole(roles) ? "/staff/withdrawals" : "/account";
  const back = (
    <Link
      to={backTo}
      className="text-sm text-primary underline underline-offset-4"
    >
      ← Back
    </Link>
  );

  if (receipt.isPending) return <Shell>Loading receipt…</Shell>;
  if (receipt.isError) {
    return (
      <Shell>
        <p role="alert" className="text-sm text-destructive">
          {staffErrorMessage(receipt.error)}
        </p>
        <div className="mt-4">{back}</div>
      </Shell>
    );
  }
  if (!receipt.data) {
    return (
      <Shell>
        <p className="text-sm">
          There is no receipt for this withdrawal yet. A receipt is issued once
          the withdrawal has been paid.
        </p>
        <div className="mt-4">{back}</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          {back}
          <Button onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Print receipt
          </Button>
        </div>
        <WithdrawalReceiptSlip
          receipt={receipt.data}
          printedAt={formatDateTime(openedAt)}
        />
        <p className="text-center text-xs text-muted-foreground print:hidden">
          Printing again later gives a copy of the same receipt. The receipt
          number stays the same.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">
        {typeof children === "string" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {children}
          </p>
        ) : (
          children
        )}
      </div>
    </PublicLayout>
  );
}
