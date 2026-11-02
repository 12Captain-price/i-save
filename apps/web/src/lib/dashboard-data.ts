import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { sumMoney, toMoney, type Money } from "@/lib/money";
import type { LedgerPoint } from "@/lib/chart-utils";

// Read-only numbers for the member and admin dashboards. Row-level security decides what each
// person may read: a member only ever gets their own rows, staff get everything. Supabase
// returns at most 1,000 rows per request, which is far more than this prototype needs.

const NumericLike = z.union([z.number(), z.string()]);

const LedgerRow = z.object({
  id: z.string(),
  reverses_id: z.string().nullable(),
  created_at: z.string(),
  type: z.string(),
  amount: NumericLike,
  savings_delta: NumericLike,
  fee_delta: NumericLike,
  currency: z.string(),
});

const LEDGER_COLUMNS =
  "id, reverses_id, created_at, type, amount, savings_delta, fee_delta, currency";

function toPoint(
  r: z.infer<typeof LedgerRow>,
): LedgerPoint & { currency: string } {
  return {
    id: r.id,
    reversesId: r.reverses_id,
    createdAt: r.created_at,
    type: r.type,
    amount: toMoney(r.amount),
    savingsDelta: toMoney(r.savings_delta),
    feeDelta: toMoney(r.fee_delta),
    currency: r.currency,
  };
}

/** The member's own money events, oldest first, for the savings growth chart. */
export function useMemberLedger(memberId: string) {
  return useQuery({
    queryKey: ["member", memberId, "ledger-chart"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_transactions")
        .select(LEDGER_COLUMNS)
        .eq("member_id", memberId)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return z
        .array(LedgerRow)
        .parse(data ?? [])
        .map(toPoint);
    },
  });
}

export type PlanProgress = {
  paid: number;
  missed: number;
  upcoming: number;
  total: number;
};

/** How many contributions on the member's plan are paid, missed and still to come. */
export function useMemberPlanProgress(memberId: string) {
  return useQuery({
    queryKey: ["member", memberId, "plan-progress"],
    queryFn: async (): Promise<PlanProgress> => {
      const { data, error } = await supabase
        .from("due_items")
        .select("status, plan_enrollments!inner(status)")
        .eq("member_id", memberId)
        .in("plan_enrollments.status", ["active", "paused"])
        .limit(1000);
      if (error) throw error;
      const rows = z.array(z.object({ status: z.string() })).parse(data ?? []);
      const paid = rows.filter((r) => r.status === "paid").length;
      const missed = rows.filter((r) => r.status === "missed").length;
      const upcoming = rows.filter(
        (r) => r.status === "scheduled" || r.status === "due",
      ).length;
      return { paid, missed, upcoming, total: paid + missed + upcoming };
    },
  });
}

export type AdminOverview = {
  currency: string;
  ledger: LedgerPoint[];
  members: { status: string; createdAt: string }[];
  savingsHeld: Money;
  feesCollected: Money;
  missedContributions: number;
  openInvoices: number;
};

/** Everything the admin dashboard draws. Staff only; the database refuses anyone else. */
export function useAdminOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["staff", "admin-overview"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminOverview> => {
      const since = new Date();
      since.setMonth(since.getMonth() - 13);
      const [ledger, members, balances, missed, invoices] = await Promise.all([
        supabase
          .from("ledger_transactions")
          .select(LEDGER_COLUMNS)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true })
          .limit(1000),
        supabase.from("profiles").select("status, created_at").limit(1000),
        supabase
          .from("member_balances")
          .select("currency, confirmed_savings, fees_paid"),
        supabase
          .from("due_items")
          .select("id", { count: "exact", head: true })
          .eq("status", "missed"),
        supabase
          .from("subscription_invoices")
          .select("id", { count: "exact", head: true })
          .eq("status", "overdue"),
      ]);
      for (const r of [ledger, members, balances, missed, invoices]) {
        if (r.error) throw r.error;
      }
      const points = z
        .array(LedgerRow)
        .parse(ledger.data ?? [])
        .map(toPoint);
      const memberRows = z
        .array(z.object({ status: z.string(), created_at: z.string() }))
        .parse(members.data ?? [])
        .map((m) => ({ status: m.status, createdAt: m.created_at }));
      const bal = z
        .array(
          z.object({
            currency: z.string(),
            confirmed_savings: NumericLike,
            fees_paid: NumericLike,
          }),
        )
        .parse(balances.data ?? []);

      // One currency at a time: amounts in different currencies are never added together.
      const counts = new Map<string, number>();
      for (const b of bal)
        counts.set(b.currency, (counts.get(b.currency) ?? 0) + 1);
      const currency =
        [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
      const mine = bal.filter((b) => b.currency === currency);

      return {
        currency,
        ledger: points.filter((p) => p.currency === currency),
        members: memberRows,
        savingsHeld: sumMoney(mine.map((b) => toMoney(b.confirmed_savings))),
        feesCollected: sumMoney(mine.map((b) => toMoney(b.fees_paid))),
        missedContributions: missed.count ?? 0,
        openInvoices: invoices.count ?? 0,
      };
    },
  });
}
