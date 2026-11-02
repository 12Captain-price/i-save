import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { toMoney, type Money } from "@/lib/money";

// Reads are protected by row-level security (a member sees only their own requests; staff see
// all). Every write goes through a database function that re-checks the rules, so the screens
// only decide what to SHOW. See supabase/migrations/011_withdrawals.sql.

const NumericLike = z.union([z.number(), z.string()]);

export type WithdrawalStatus =
  | "requested"
  | "under_review"
  | "approved"
  | "rejected"
  | "payout_pending"
  | "paid"
  | "failed"
  | "cancelled";

export const OPEN_STATUSES: WithdrawalStatus[] = [
  "requested",
  "under_review",
  "approved",
  "payout_pending",
];

export function withdrawalStatusLabel(status: string): string {
  switch (status) {
    case "requested":
      return "Requested";
    case "under_review":
      return "Under review";
    case "approved":
      return "Approved, awaiting payout";
    case "payout_pending":
      return "Payout in progress";
    case "paid":
      return "Paid";
    case "rejected":
      return "Not approved";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Payout failed";
    default:
      return status;
  }
}

/* ------------------------------------------------------------------ */
/* Member side                                                         */
/* ------------------------------------------------------------------ */

const QuoteRow = z.object({
  eligible: z.boolean(),
  reason: z.string().nullable(),
  currency: z.string().nullable(),
  amount: NumericLike,
  fee_amount: NumericLike,
  net_amount: NumericLike,
  early_exit: z.boolean(),
  enrollment_id: z.string().nullable(),
  eligible_on: z.string().nullable(),
});

export type WithdrawalQuote = {
  eligible: boolean;
  reason: string | null;
  currency: string;
  amount: Money;
  feeAmount: Money;
  netAmount: Money;
  earlyExit: boolean;
  eligibleOn: string | null;
};

/** What this member could withdraw right now, worked out by the database. */
export function useWithdrawalQuote(memberId: string) {
  return useQuery({
    queryKey: ["member", memberId, "withdrawal-quote"],
    queryFn: async (): Promise<WithdrawalQuote> => {
      const { data, error } = await supabase.rpc("withdrawal_quote", {
        p_member: memberId,
      });
      if (error) throw error;
      const row = z.array(QuoteRow).parse(data ?? [])[0];
      if (!row) throw new Error("Could not check your withdrawal options.");
      return {
        eligible: row.eligible,
        reason: row.reason,
        currency: row.currency ?? "USD",
        amount: toMoney(row.amount),
        feeAmount: toMoney(row.fee_amount),
        netAmount: toMoney(row.net_amount),
        earlyExit: row.early_exit,
        eligibleOn: row.eligible_on,
      };
    },
  });
}

const MyRequestRow = z.object({
  id: z.string(),
  status: z.string(),
  amount: NumericLike,
  fee_amount: NumericLike,
  net_amount: NumericLike.nullable(),
  currency: z.string(),
  early_exit: z.boolean(),
  payout_method: z.string().nullable(),
  payout_reference: z.string().nullable(),
  reject_reason: z.string().nullable(),
  receipt_number: z.string().nullable(),
  created_at: z.string(),
  paid_at: z.string().nullable(),
});

export type MyWithdrawal = {
  id: string;
  status: string;
  amount: Money;
  feeAmount: Money;
  netAmount: Money;
  currency: string;
  earlyExit: boolean;
  payoutMethod: string | null;
  payoutReference: string | null;
  rejectReason: string | null;
  receiptNumber: string | null;
  createdAt: string;
  paidAt: string | null;
};

export function useMyWithdrawals(memberId: string) {
  return useQuery({
    queryKey: ["member", memberId, "withdrawals"],
    queryFn: async (): Promise<MyWithdrawal[]> => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select(
          "id, status, amount, fee_amount, net_amount, currency, early_exit, payout_method, payout_reference, reject_reason, receipt_number, created_at, paid_at",
        )
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return z
        .array(MyRequestRow)
        .parse(data ?? [])
        .map((r) => ({
          id: r.id,
          status: r.status,
          amount: toMoney(r.amount),
          feeAmount: toMoney(r.fee_amount),
          netAmount: toMoney(r.net_amount ?? r.amount),
          currency: r.currency,
          earlyExit: r.early_exit,
          payoutMethod: r.payout_method,
          payoutReference: r.payout_reference,
          rejectReason: r.reject_reason,
          receiptNumber: r.receipt_number,
          createdAt: r.created_at,
          paidAt: r.paid_at,
        }));
    },
  });
}

export type WithdrawalRequestInput = {
  method: "ecocash" | "cash";
  number: string; // already in +263 format (ignored for cash)
  name: string;
  note: string;
  accepted: boolean;
};

export async function requestWithdrawal(input: WithdrawalRequestInput) {
  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_payout_method: input.method,
    p_payout_number: input.method === "ecocash" ? input.number : null,
    p_payout_name: input.method === "ecocash" ? input.name.trim() : null,
    p_accept: input.accepted,
    p_note: input.note.trim() ? input.note.trim() : null,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelWithdrawal(id: string) {
  const { error } = await supabase.rpc("cancel_withdrawal", { p_id: id });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Staff side                                                          */
/* ------------------------------------------------------------------ */

const QueueRow = z.object({
  id: z.string(),
  status: z.string(),
  amount: NumericLike,
  fee_amount: NumericLike,
  net_amount: NumericLike.nullable(),
  currency: z.string(),
  early_exit: z.boolean(),
  payout_method: z.string().nullable(),
  payout_number: z.string().nullable(),
  payout_name: z.string().nullable(),
  member_note: z.string().nullable(),
  created_at: z.string(),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  payout_reference: z.string().nullable(),
  reject_reason: z.string().nullable(),
  member_number: z.string(),
  full_name: z.string(),
  phone: z.string().nullable(),
  member_id: z.string(),
  receipt_number: z.string().nullable(),
  reviewer_name: z.string().nullable(),
  approver_name: z.string().nullable(),
  payer_name: z.string().nullable(),
  rejecter_name: z.string().nullable(),
  rejected_at: z.string().nullable(),
});

export type QueueItem = {
  id: string;
  status: string;
  amount: Money;
  feeAmount: Money;
  netAmount: Money;
  currency: string;
  earlyExit: boolean;
  payoutMethod: string | null;
  payoutNumber: string | null;
  payoutName: string | null;
  memberNote: string | null;
  createdAt: string;
  reviewedBy: string | null;
  approvedBy: string | null;
  paidAt: string | null;
  payoutReference: string | null;
  rejectReason: string | null;
  memberId: string;
  memberNumber: string;
  memberName: string;
  memberPhone: string | null;
  receiptNumber: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  paidByName: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
};

export function useWithdrawalQueue() {
  return useQuery({
    queryKey: ["staff", "withdrawals"],
    queryFn: async (): Promise<QueueItem[]> => {
      const { data, error } = await supabase
        .from("withdrawal_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return z
        .array(QueueRow)
        .parse(data ?? [])
        .map((r) => ({
          id: r.id,
          status: r.status,
          amount: toMoney(r.amount),
          feeAmount: toMoney(r.fee_amount),
          netAmount: toMoney(r.net_amount ?? r.amount),
          currency: r.currency,
          earlyExit: r.early_exit,
          payoutMethod: r.payout_method,
          payoutNumber: r.payout_number,
          payoutName: r.payout_name,
          memberNote: r.member_note,
          createdAt: r.created_at,
          reviewedBy: r.reviewed_by,
          approvedBy: r.approved_by,
          paidAt: r.paid_at,
          payoutReference: r.payout_reference,
          rejectReason: r.reject_reason,
          memberId: r.member_id,
          memberNumber: r.member_number,
          memberName: r.full_name,
          memberPhone: r.phone,
          receiptNumber: r.receipt_number,
          reviewedByName: r.reviewer_name,
          reviewedAt: r.reviewed_at,
          approvedByName: r.approver_name,
          approvedAt: r.approved_at,
          paidByName: r.payer_name,
          rejectedByName: r.rejecter_name,
          rejectedAt: r.rejected_at,
        }));
    },
  });
}

export async function reviewWithdrawal(id: string) {
  const { error } = await supabase.rpc("review_withdrawal", { p_id: id });
  if (error) throw error;
}

export async function approveWithdrawal(id: string) {
  const { error } = await supabase.rpc("approve_withdrawal", { p_id: id });
  if (error) throw error;
}

export async function rejectWithdrawal(id: string, reason: string) {
  const { error } = await supabase.rpc("reject_withdrawal", {
    p_id: id,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function recordWithdrawalPayout(id: string, reference: string) {
  const { error } = await supabase.rpc("record_withdrawal_payout", {
    p_id: id,
    p_reference: reference.trim(),
  });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Receipt                                                             */
/* ------------------------------------------------------------------ */

const ReceiptRow = z.object({
  id: z.string(),
  receipt_number: z.string().nullable(),
  member_id: z.string(),
  member_number: z.string(),
  member_name: z.string(),
  amount: NumericLike,
  fee_amount: NumericLike,
  net_amount: NumericLike,
  currency: z.string(),
  early_exit: z.boolean(),
  payout_method: z.string().nullable(),
  payout_number: z.string().nullable(),
  payout_name: z.string().nullable(),
  payout_reference: z.string().nullable(),
  requested_at: z.string(),
  reviewed_by_name: z.string(),
  reviewed_at: z.string().nullable(),
  approved_by_name: z.string(),
  approved_at: z.string().nullable(),
  paid_by_name: z.string(),
  paid_at: z.string().nullable(),
});

export type WithdrawalReceipt = {
  id: string;
  receiptNumber: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  amount: Money;
  feeAmount: Money;
  netAmount: Money;
  currency: string;
  earlyExit: boolean;
  payoutMethod: string | null;
  payoutNumber: string | null;
  payoutName: string | null;
  payoutReference: string | null;
  requestedAt: string;
  reviewedByName: string;
  reviewedAt: string | null;
  approvedByName: string;
  approvedAt: string | null;
  paidByName: string;
  paidAt: string | null;
};

/** One paid withdrawal's receipt. The database only returns it to that member or to staff. */
export function useWithdrawalReceipt(id: string) {
  return useQuery({
    queryKey: ["withdrawal-receipt", id],
    queryFn: async (): Promise<WithdrawalReceipt | null> => {
      const { data, error } = await supabase.rpc("get_withdrawal_receipt", {
        p_id: id,
      });
      if (error) throw error;
      const row = z.array(ReceiptRow).parse(data ?? [])[0];
      if (!row) return null;
      return {
        id: row.id,
        receiptNumber: row.receipt_number ?? "—",
        memberId: row.member_id,
        memberNumber: row.member_number,
        memberName: row.member_name,
        amount: toMoney(row.amount),
        feeAmount: toMoney(row.fee_amount),
        netAmount: toMoney(row.net_amount),
        currency: row.currency,
        earlyExit: row.early_exit,
        payoutMethod: row.payout_method,
        payoutNumber: row.payout_number,
        payoutName: row.payout_name,
        payoutReference: row.payout_reference,
        requestedAt: row.requested_at,
        reviewedByName: row.reviewed_by_name,
        reviewedAt: row.reviewed_at,
        approvedByName: row.approved_by_name,
        approvedAt: row.approved_at,
        paidByName: row.paid_by_name,
        paidAt: row.paid_at,
      };
    },
  });
}
