import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { toMoney, type Money } from "@/lib/money";
import {
  buildLedgerSearchFilter,
  dayRangeToTimestamps,
} from "@/lib/staff-utils";

// Read-only. Both screens read database views (ledger_search for all staff, audit_feed for
// administrators only); row-level security decides who gets rows back.

const NumericLike = z.union([z.number(), z.string()]);
export const PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/* Ledger search                                                       */
/* ------------------------------------------------------------------ */

const LedgerRow = z.object({
  id: z.string(),
  reference: z.string(),
  created_at: z.string(),
  type: z.string(),
  amount: NumericLike,
  currency: z.string(),
  reason: z.string().nullable(),
  member_id: z.string(),
  member_number: z.string(),
  full_name: z.string(),
  created_by_name: z.string().nullable(),
  receipt_number: z.string().nullable(),
  office_receipt_no: z.string().nullable(),
  reverses_reference: z.string().nullable(),
  reversed: z.boolean(),
});

export type LedgerEntry = {
  id: string;
  reference: string;
  createdAt: string;
  type: string;
  amount: Money;
  currency: string;
  reason: string | null;
  memberId: string;
  memberNumber: string;
  memberName: string;
  recordedBy: string | null;
  receiptNumber: string | null;
  officeReceiptNo: string | null;
  reversesReference: string | null;
  reversed: boolean;
};

export type LedgerQuery = {
  term: string;
  fromDay: string;
  toDay: string;
  reversalsOnly: boolean;
  page: number;
};

export type LedgerPage = { rows: LedgerEntry[]; hasMore: boolean };

export async function searchLedger(q: LedgerQuery): Promise<LedgerPage> {
  let query = supabase
    .from("ledger_search")
    .select(
      "id, reference, created_at, type, amount, currency, reason, member_id, member_number, full_name, created_by_name, receipt_number, office_receipt_no, reverses_reference, reversed",
    )
    .order("created_at", { ascending: false })
    .order("reference", { ascending: false })
    // One extra row tells us whether there is another page.
    .range(q.page * PAGE_SIZE, q.page * PAGE_SIZE + PAGE_SIZE);

  const filter = buildLedgerSearchFilter(q.term);
  if (filter) query = query.or(filter);
  const range = dayRangeToTimestamps(q.fromDay, q.toDay);
  if (range.from) query = query.gte("created_at", range.from);
  if (range.to) query = query.lt("created_at", range.to);
  if (q.reversalsOnly) query = query.eq("type", "reversal");

  const { data, error } = await query;
  if (error) throw error;
  const rows = z.array(LedgerRow).parse(data ?? []);
  return {
    hasMore: rows.length > PAGE_SIZE,
    rows: rows.slice(0, PAGE_SIZE).map((r) => ({
      id: r.id,
      reference: r.reference,
      createdAt: r.created_at,
      type: r.type,
      amount: toMoney(r.amount),
      currency: r.currency,
      reason: r.reason,
      memberId: r.member_id,
      memberNumber: r.member_number,
      memberName: r.full_name,
      recordedBy: r.created_by_name,
      receiptNumber: r.receipt_number,
      officeReceiptNo: r.office_receipt_no,
      reversesReference: r.reverses_reference,
      reversed: r.reversed,
    })),
  };
}

export function useLedgerSearch(q: LedgerQuery) {
  return useQuery({
    queryKey: ["staff", "ledger", q],
    queryFn: () => searchLedger(q),
  });
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

const AuditRow = z.object({
  id: z.union([z.number(), z.string()]),
  created_at: z.string(),
  action: z.string(),
  entity: z.string(),
  details: z.record(z.unknown()).nullable(),
  actor_name: z.string(),
  actor_number: z.string().nullable(),
  subject_member_id: z.string().nullable(),
  subject_name: z.string().nullable(),
  subject_number: z.string().nullable(),
  receipt_number: z.string().nullable(),
});

export type AuditEntry = {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  details: Record<string, unknown>;
  actorName: string;
  subjectMemberId: string | null;
  subjectName: string | null;
  subjectNumber: string | null;
  receiptNumber: string | null;
};

export type AuditQuery = {
  term: string;
  action: string; // "" = all actions
  fromDay: string;
  toDay: string;
  page: number;
};

export type AuditPage = { rows: AuditEntry[]; hasMore: boolean };

export async function searchAudit(q: AuditQuery): Promise<AuditPage> {
  let query = supabase
    .from("audit_feed")
    .select(
      "id, created_at, action, entity, details, actor_name, actor_number, subject_member_id, subject_name, subject_number, receipt_number",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(q.page * PAGE_SIZE, q.page * PAGE_SIZE + PAGE_SIZE);

  const cleaned = q.term
    .replace(/[,()%*"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) {
    query = query.or(
      [
        `actor_name.ilike."%${cleaned}%"`,
        `subject_name.ilike."%${cleaned}%"`,
        `subject_number.ilike."%${cleaned}%"`,
        `receipt_number.ilike."%${cleaned}%"`,
      ].join(","),
    );
  }
  if (q.action) query = query.eq("action", q.action);
  const range = dayRangeToTimestamps(q.fromDay, q.toDay);
  if (range.from) query = query.gte("created_at", range.from);
  if (range.to) query = query.lt("created_at", range.to);

  const { data, error } = await query;
  if (error) throw error;
  const rows = z.array(AuditRow).parse(data ?? []);
  return {
    hasMore: rows.length > PAGE_SIZE,
    rows: rows.slice(0, PAGE_SIZE).map((r) => ({
      id: String(r.id),
      createdAt: r.created_at,
      action: r.action,
      entity: r.entity,
      details: r.details ?? {},
      actorName: r.actor_name,
      subjectMemberId: r.subject_member_id,
      subjectName: r.subject_name,
      subjectNumber: r.subject_number,
      receiptNumber: r.receipt_number,
    })),
  };
}

export function useAuditSearch(q: AuditQuery) {
  return useQuery({
    queryKey: ["staff", "audit", q],
    queryFn: () => searchAudit(q),
  });
}

/** Actions offered in the audit filter. Anything else still shows under "All actions". */
export const AUDIT_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "ledger.reversed", label: "Payment reversed" },
  { value: "office_payment.recorded", label: "Office payment recorded" },
  { value: "payment.confirmed", label: "Payment confirmed" },
  { value: "member.registered_in_office", label: "Registered in the office" },
  { value: "id.viewed", label: "ID number viewed" },
  { value: "id.sighted", label: "ID sighted" },
  { value: "daily_report.signed_off", label: "Daily report signed off" },
  { value: "plan.enrolled", label: "Plan chosen" },
  { value: "withdrawal.requested", label: "Withdrawal requested" },
  { value: "withdrawal.reviewed", label: "Withdrawal reviewed" },
  { value: "withdrawal.approved", label: "Withdrawal approved" },
  { value: "withdrawal.rejected", label: "Withdrawal rejected" },
  { value: "withdrawal.paid", label: "Withdrawal paid out" },
  { value: "withdrawal.cancelled", label: "Withdrawal cancelled" },
];
