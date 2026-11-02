// Pure helpers for the dashboard charts. Money stays as strings and is added with the money
// helpers; numbers appear only at the last step, to place a point on the screen.
import { addMoney, sumMoney, toMoney, type Money } from "@/lib/money";

export type MonthKey = string; // "2026-09"

export function monthKey(iso: string): MonthKey {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function monthLabel(key: MonthKey, withYear = false): string {
  const [y, m] = key.split("-");
  const name = SHORT[Number(m) - 1] ?? key;
  return withYear ? `${name} ${y}` : name;
}

/** The last `count` month keys ending at `now`, oldest first. */
export function lastMonths(count: number, now = new Date()): MonthKey[] {
  const keys: MonthKey[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}

export type LedgerPoint = {
  id?: string;
  /** For a reversal: the id of the entry it undoes. */
  reversesId?: string | null;
  createdAt: string;
  type: string;
  amount: Money;
  savingsDelta: Money;
  feeDelta: Money;
};

/** Money in per month, split into savings, registration fees and subscriptions. Reversals are subtracted. */
export type MonthlyIn = {
  month: MonthKey;
  savings: Money;
  registration: Money;
  subscription: Money;
};

export function moneyInByMonth(
  rows: LedgerPoint[],
  months: MonthKey[],
): MonthlyIn[] {
  const typeById = new Map<string, string>();
  for (const row of rows) if (row.id) typeById.set(row.id, row.type);
  const buckets = new Map<MonthKey, { s: Money[]; r: Money[]; m: Money[] }>(
    months.map((k) => [k, { s: [], r: [], m: [] }]),
  );
  for (const row of rows) {
    const b = buckets.get(monthKey(row.createdAt));
    if (!b) continue;
    if (row.type === "savings_contribution") b.s.push(row.amount);
    else if (row.type === "registration_fee") b.r.push(row.amount);
    else if (row.type === "monthly_subscription") b.m.push(row.amount);
    else if (row.type === "reversal") {
      // A reversal carries the deltas of what it undoes, with the opposite sign. It goes
      // against the same kind of money as the entry it reverses.
      const undone = row.reversesId ? typeById.get(row.reversesId) : undefined;
      if (row.savingsDelta !== "0.00") b.s.push(row.savingsDelta);
      else if (undone === "registration_fee") b.r.push(row.feeDelta);
      else if (row.feeDelta !== "0.00") b.m.push(row.feeDelta);
    }
  }
  return months.map((month) => {
    const b = buckets.get(month)!;
    return {
      month,
      savings: sumMoney(b.s),
      registration: sumMoney(b.r),
      subscription: sumMoney(b.m),
    };
  });
}

/** Running total of a delta, sampled at the end of each month. */
export function runningTotalByMonth(
  rows: LedgerPoint[],
  months: MonthKey[],
  pick: (r: LedgerPoint) => Money,
): Money[] {
  const first = months[0];
  let total: Money = toMoney(0);
  const perMonth = new Map<MonthKey, Money>();
  for (const r of [...rows].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    const k = monthKey(r.createdAt);
    if (first && k < first) {
      total = addMoney(total, pick(r));
    } else {
      perMonth.set(k, addMoney(perMonth.get(k) ?? toMoney(0), pick(r)));
    }
  }
  return months.map((k) => {
    total = addMoney(total, perMonth.get(k) ?? toMoney(0));
    return total;
  });
}

/** Running count of joins per month (including everyone who joined before the first month). */
export function cumulativeCounts(
  isoDates: string[],
  months: MonthKey[],
): number[] {
  const first = months[0] ?? "";
  let total = isoDates.filter((d) => monthKey(d) < first).length;
  return months.map((k) => {
    total += isoDates.filter((d) => monthKey(d) === k).length;
    return total;
  });
}

/** A rounded-up top for an axis, and evenly spaced ticks up to it. */
export function niceScale(
  max: number,
  ticks = 4,
): { top: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) {
    return { top: 1, ticks: [0, 1] };
  }
  const rough = max / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(v);
  return { top, ticks: out };
}

/** Short axis labels: 1,200 becomes 1.2k. */
export function compactNumber(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Share of a total as a whole-number percentage. Zero total gives 0. */
export function percentOf(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 100);
}
