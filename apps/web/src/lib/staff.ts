import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";
import { toMoney, type Money } from "@/lib/money";
import { buildMemberSearchFilter, type Purpose } from "@/lib/staff-utils";

// Every read below is protected by row-level security (staff can read members, payments and
// receipts; members cannot). Every write goes through a database function, never a table.

const NumericLike = z.union([z.number(), z.string()]);
// PostgREST returns a to-one embed as an object, but be tolerant of a one-item array.
const one = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (Array.isArray(v) ? (v[0] ?? null) : v), schema);

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

const MEMBER_COLUMNS =
  "id, member_number, full_name, email, phone, status, registered_via, id_sighted_at, id_sighted_by, whatsapp_opt_in, created_at";

const MemberRow = z.object({
  id: z.string(),
  member_number: z.string(),
  full_name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  status: z.enum(["pending", "active", "suspended", "closed"]),
  registered_via: z.enum(["online", "staff"]),
  id_sighted_at: z.string().nullable(),
  id_sighted_by: z.string().nullable(),
  whatsapp_opt_in: z.boolean(),
  created_at: z.string(),
});
export type MemberDetail = z.infer<typeof MemberRow>;

export type MemberFilter = "all" | "pending" | "active";

export async function searchMembers(
  term: string,
  filter: MemberFilter,
): Promise<MemberDetail[]> {
  let query = supabase
    .from("profiles")
    .select(MEMBER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(25);
  if (filter !== "all") query = query.eq("status", filter);

  const phone = normalizePhone(term);
  const orFilter = buildMemberSearchFilter(
    term,
    phone.ok ? phone.value : undefined,
  );
  if (orFilter) query = query.or(orFilter);

  const { data, error } = await query;
  if (error) throw error;
  return z.array(MemberRow).parse(data ?? []);
}

export function useMemberSearch(term: string, filter: MemberFilter) {
  return useQuery({
    queryKey: ["staff", "members", term, filter],
    queryFn: () => searchMembers(term, filter),
  });
}

export function useMember(memberId: string) {
  return useQuery({
    queryKey: ["staff", "member", memberId],
    queryFn: async (): Promise<MemberDetail | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(MEMBER_COLUMNS)
        .eq("id", memberId)
        .maybeSingle();
      if (error) throw error;
      return data ? MemberRow.parse(data) : null;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Balances, receipts, what is owed                                    */
/* ------------------------------------------------------------------ */

export type Balance = { currency: string; savings: Money; fees: Money };

export function useMemberBalances(memberId: string) {
  return useQuery({
    queryKey: ["staff", "member", memberId, "balances"],
    queryFn: async (): Promise<Balance[]> => {
      const { data, error } = await supabase
        .from("member_balances")
        .select("currency, confirmed_savings, fees_paid")
        .eq("member_id", memberId);
      if (error) throw error;
      return z
        .array(
          z.object({
            currency: z.string(),
            confirmed_savings: NumericLike,
            fees_paid: NumericLike,
          }),
        )
        .parse(data ?? [])
        .map((row) => ({
          currency: row.currency,
          savings: toMoney(row.confirmed_savings),
          fees: toMoney(row.fees_paid),
        }));
    },
  });
}

export type Receipt = {
  id: string;
  receiptNumber: string;
  purpose: string;
  amount: Money;
  currency: string;
  provider: string;
  officeReceiptNo: string | null;
  issuedAt: string;
  reversed: boolean;
};

export function useMemberReceipts(memberId: string) {
  return useQuery({
    queryKey: ["staff", "member", memberId, "receipts"],
    queryFn: async (): Promise<Receipt[]> => {
      const { data, error } = await supabase
        .from("member_receipts")
        .select(
          "id, receipt_number, purpose, amount, currency, provider, office_receipt_no, issued_at, reversed",
        )
        .eq("member_id", memberId)
        .order("issued_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return z
        .array(
          z.object({
            id: z.string(),
            receipt_number: z.string(),
            purpose: z.string(),
            amount: NumericLike,
            currency: z.string(),
            provider: z.string(),
            office_receipt_no: z.string().nullable(),
            issued_at: z.string(),
            reversed: z.boolean(),
          }),
        )
        .parse(data ?? [])
        .map((r) => ({
          id: r.id,
          receiptNumber: r.receipt_number,
          purpose: r.purpose,
          amount: toMoney(r.amount),
          currency: r.currency,
          provider: r.provider,
          officeReceiptNo: r.office_receipt_no,
          issuedAt: r.issued_at,
          reversed: r.reversed,
        }));
    },
  });
}

export type DueItem = {
  id: string;
  dueDate: string;
  /** null when the plan has a permitted range and staff must enter the amount. */
  amount: Money | null;
  currency: string;
  planName: string | null;
  minAmount: Money | null;
  maxAmount: Money | null;
};

const DueItemRow = z.object({
  id: z.string(),
  due_date: z.string(),
  amount: NumericLike.nullable(),
  currency: z.string(),
  plan_enrollments: one(
    z
      .object({
        savings_plan_versions: one(
          z
            .object({
              min_amount: NumericLike.nullable(),
              max_amount: NumericLike.nullable(),
              savings_plans: one(z.object({ name: z.string() }).nullable()),
            })
            .nullable(),
        ),
      })
      .nullable(),
  ),
});

export function useMemberDueItems(memberId: string) {
  return useQuery({
    queryKey: ["staff", "member", memberId, "dues"],
    queryFn: async (): Promise<DueItem[]> => {
      const { data, error } = await supabase
        .from("due_items")
        .select(
          "id, due_date, amount, currency, plan_enrollments(savings_plan_versions(min_amount, max_amount, savings_plans(name)))",
        )
        .eq("member_id", memberId)
        .in("status", ["scheduled", "due"])
        .order("due_date", { ascending: true })
        .limit(6);
      if (error) throw error;
      return z
        .array(DueItemRow)
        .parse(data ?? [])
        .map((row) => {
          const version = row.plan_enrollments?.savings_plan_versions ?? null;
          return {
            id: row.id,
            dueDate: row.due_date,
            amount: row.amount === null ? null : toMoney(row.amount),
            currency: row.currency,
            planName: version?.savings_plans?.name ?? null,
            minAmount:
              version?.min_amount == null ? null : toMoney(version.min_amount),
            maxAmount:
              version?.max_amount == null ? null : toMoney(version.max_amount),
          };
        });
    },
  });
}

export type OpenInvoice = {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: Money;
  currency: string;
  status: "open" | "overdue";
};

export function useMemberInvoices(memberId: string) {
  return useQuery({
    queryKey: ["staff", "member", memberId, "invoices"],
    queryFn: async (): Promise<OpenInvoice[]> => {
      const { data, error } = await supabase
        .from("subscription_invoices")
        .select(
          "id, period_start, period_end, due_date, amount, currency, status",
        )
        .eq("member_id", memberId)
        .in("status", ["open", "overdue"])
        .order("due_date", { ascending: true })
        .limit(12);
      if (error) throw error;
      return z
        .array(
          z.object({
            id: z.string(),
            period_start: z.string(),
            period_end: z.string(),
            due_date: z.string(),
            amount: NumericLike,
            currency: z.string(),
            status: z.enum(["open", "overdue"]),
          }),
        )
        .parse(data ?? [])
        .map((r) => ({
          id: r.id,
          periodStart: r.period_start,
          periodEnd: r.period_end,
          dueDate: r.due_date,
          amount: toMoney(r.amount),
          currency: r.currency,
          status: r.status,
        }));
    },
  });
}

/* ------------------------------------------------------------------ */
/* Actions (database functions)                                        */
/* ------------------------------------------------------------------ */

/** Staff typed the number from the physical ID. Records who looked and when. */
export async function markIdSighted(memberId: string, nationalId: string) {
  const { error } = await supabase.rpc("mark_id_sighted", {
    p_member_id: memberId,
    p_national_id: nationalId,
  });
  if (error) throw error;
}

/** Reads the ID number on file. The database writes an audit row for every look. */
export async function getNationalId(memberId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_member_national_id", {
    p_member_id: memberId,
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}

export type RecordPaymentInput = {
  memberId: string;
  purpose: Purpose;
  method: "cash" | "bank_transfer";
  receiptNo: string;
  idempotencyKey: string;
  dueItemId?: string;
  invoiceId?: string;
  /** Only sent for savings plans with a permitted range. */
  amount?: Money;
  note?: string;
};

const RecordPaymentResult = z.object({
  payment_id: z.string(),
  receipt_number: z.string(),
  already_recorded: z.boolean(),
});
export type RecordPaymentResult = {
  paymentId: string;
  receiptNumber: string;
  alreadyRecorded: boolean;
};

/** Records and confirms an office payment in one step (the database issues the receipt). */
export async function recordOfficePayment(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const { data, error } = await supabase.rpc("record_office_payment", {
    p_member_id: input.memberId,
    p_purpose: input.purpose,
    p_method: input.method,
    p_receipt_no: input.receiptNo.trim(),
    p_idempotency_key: input.idempotencyKey,
    p_due_item_id: input.dueItemId ?? null,
    p_invoice_id: input.invoiceId ?? null,
    p_amount: input.amount ?? null,
    p_evidence_note: input.note?.trim() ? input.note.trim() : null,
  });
  if (error) throw error;
  const parsed = RecordPaymentResult.parse(data);
  return {
    paymentId: parsed.payment_id,
    receiptNumber: parsed.receipt_number,
    alreadyRecorded: parsed.already_recorded,
  };
}

/* ------------------------------------------------------------------ */
/* Daily report                                                        */
/* ------------------------------------------------------------------ */

export type ReportRow = {
  reportDate: string;
  staffId: string | null;
  staffName: string;
  currency: string;
  paymentsCount: number;
  total: Money;
  registration: Money;
  subscription: Money;
  savings: Money;
  cash: Money;
  bank: Money;
  other: Money;
  reversedCount: number;
  reversedTotal: Money;
};

export type Signoff = {
  reportDate: string;
  staffId: string;
  signedBy: string;
  signedByName: string;
  signedAt: string;
  note: string | null;
};

const ReportRowSchema = z.object({
  report_date: z.string(),
  staff_id: z.string().nullable(),
  staff_name: z.string(),
  currency: z.string(),
  payments_count: NumericLike,
  total_amount: NumericLike,
  registration_total: NumericLike,
  subscription_total: NumericLike,
  savings_total: NumericLike,
  cash_total: NumericLike,
  bank_total: NumericLike,
  other_total: NumericLike,
  reversed_count: NumericLike,
  reversed_total: NumericLike,
});

export function useDailyReport() {
  return useQuery({
    queryKey: ["staff", "report"],
    queryFn: async (): Promise<{ rows: ReportRow[]; signoffs: Signoff[] }> => {
      const [reportResult, signoffResult] = await Promise.all([
        supabase
          .from("staff_daily_report")
          .select("*")
          .order("report_date", { ascending: false })
          .limit(120),
        supabase
          .from("daily_signoffs")
          .select("report_date, staff_id, signed_by, signed_at, note")
          .order("signed_at", { ascending: false })
          .limit(500),
      ]);
      if (reportResult.error) throw reportResult.error;
      if (signoffResult.error) throw signoffResult.error;

      const rows = z
        .array(ReportRowSchema)
        .parse(reportResult.data ?? [])
        .map((r) => ({
          reportDate: r.report_date,
          staffId: r.staff_id,
          staffName: r.staff_name,
          currency: r.currency,
          paymentsCount: Number(r.payments_count),
          total: toMoney(r.total_amount),
          registration: toMoney(r.registration_total),
          subscription: toMoney(r.subscription_total),
          savings: toMoney(r.savings_total),
          cash: toMoney(r.cash_total),
          bank: toMoney(r.bank_total),
          other: toMoney(r.other_total),
          reversedCount: Number(r.reversed_count),
          reversedTotal: toMoney(r.reversed_total),
        }));

      const rawSignoffs = z
        .array(
          z.object({
            report_date: z.string(),
            staff_id: z.string(),
            signed_by: z.string(),
            signed_at: z.string(),
            note: z.string().nullable(),
          }),
        )
        .parse(signoffResult.data ?? []);

      const signerIds = [...new Set(rawSignoffs.map((s) => s.signed_by))];
      const names = new Map<string, string>();
      if (signerIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", signerIds);
        if (error) throw error;
        for (const p of z
          .array(z.object({ id: z.string(), full_name: z.string() }))
          .parse(data ?? [])) {
          names.set(p.id, p.full_name);
        }
      }

      const signoffs = rawSignoffs.map((s) => ({
        reportDate: s.report_date,
        staffId: s.staff_id,
        signedBy: s.signed_by,
        signedByName: names.get(s.signed_by) || "An admin",
        signedAt: s.signed_at,
        note: s.note,
      }));
      return { rows, signoffs };
    },
  });
}

/** An admin signs off another staff member's day. The database blocks signing your own day. */
export async function signOffDailyReport(
  reportDate: string,
  staffId: string,
  note: string,
) {
  const { error } = await supabase.rpc("sign_off_daily_report", {
    p_date: reportDate,
    p_staff_id: staffId,
    p_note: note.trim() ? note.trim() : null,
  });
  if (error) throw error;
}
