import { addMoney, compareMoney, toMoney, type Money } from "@/lib/money";
import { purposeLabel } from "@/lib/staff-utils";

export type StatementInput = {
  id?: string;
  reversesId?: string | null;
  createdAt: string;
  type: string;
  amount: Money;
  savingsDelta: Money;
  feeDelta: Money;
  currency: string;
};

export type StatementRow = {
  id: string;
  date: string;
  description: string;
  savingsChange: Money;
  feeChange: Money;
  /** Confirmed savings after this row. */
  savingsBalance: Money;
};

export type Statement = {
  rows: StatementRow[];
  totalSavings: Money;
  totalFees: Money;
};

function describe(type: string, reversesId: string | null | undefined): string {
  if (type === "reversal" || reversesId) return "Correction (earlier payment reversed)";
  if (type === "withdrawal") return "Withdrawal paid out";
  if (type === "refund") return "Refund";
  if (type === "approved_adjustment") return "Approved adjustment";
  return purposeLabel(type);
}

/** Turns the member's ledger into statement lines with a running savings balance.
 *  All sums use the money helpers, never plain numbers. Rows with no effect on savings or
 *  fees are left out. Only one currency is summed at a time, so pass one currency. */
export function buildStatement(
  entries: StatementInput[],
  currency: string,
): Statement {
  const ordered = entries
    .filter((e) => e.currency === currency)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let savings = toMoney(0);
  let fees = toMoney(0);
  const rows: StatementRow[] = [];
  for (const [i, e] of ordered.entries()) {
    savings = addMoney(savings, e.savingsDelta);
    fees = addMoney(fees, e.feeDelta);
    if (
      compareMoney(e.savingsDelta, toMoney(0)) === 0 &&
      compareMoney(e.feeDelta, toMoney(0)) === 0
    )
      continue;
    rows.push({
      id: e.id ?? `row-${i}`,
      date: e.createdAt,
      description: describe(e.type, e.reversesId),
      savingsChange: e.savingsDelta,
      feeChange: e.feeDelta,
      savingsBalance: savings,
    });
  }
  return { rows, totalSavings: savings, totalFees: fees };
}
