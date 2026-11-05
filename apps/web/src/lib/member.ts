import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toPlanTheme, type PlanTheme } from "@/lib/plan-theme";
import { supabase } from "@/lib/supabase";
import { toMoney, type Money } from "@/lib/money";

// Member-side reads. Row-level security limits every query here to the signed-in member's
// own rows (plans and public settings excepted), so these never need a member id filter
// for safety. The id is only used to keep each member's cache separate.

const NumericLike = z.union([z.number(), z.string()]);
const one = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (Array.isArray(v) ? (v[0] ?? null) : v), schema);

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export type InAppMessage = {
  id: string;
  subject: string | null;
  body: string;
  createdAt: string;
};

export function useMyMessages(memberId: string) {
  return useQuery({
    queryKey: ["member", memberId, "messages"],
    queryFn: async (): Promise<InAppMessage[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, subject, body, created_at")
        .eq("member_id", memberId)
        .eq("channel", "in_app")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return z
        .array(
          z.object({
            id: z.string(),
            subject: z.string().nullable(),
            body: z.string(),
            created_at: z.string(),
          }),
        )
        .parse(data ?? [])
        .map((m) => ({
          id: m.id,
          subject: m.subject,
          body: m.body,
          createdAt: m.created_at,
        }));
    },
  });
}

/** Removes one of the member's own in-app messages. Receipts and money are never touched. */
export async function deleteMyMessage(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_my_message", { p_id: id });
  if (error) throw error;
}

/** Removes every in-app message the member has. */
export async function deleteAllMyMessages(): Promise<void> {
  const { error } = await supabase.rpc("delete_my_messages");
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

export type PlanTerms = {
  /** The plan version's id. This is what a member joins. */
  versionId: string;
  planName: string;
  /** Short description written by an administrator, or null. */
  planDescription: string | null;
  /** Fuller description (simple page formatting), or null. */
  planLongDescription: string | null;
  /** True for the one plan shown as the featured goal-based plan. */
  isGoalBased: boolean;
  /** Picks the click animation on the plan card. */
  theme: PlanTheme;
  /** Goal names shown as chips on a combo plan. */
  comboGoals: string[];
  version: number;
  /** Fixed amount per contribution, or null when the plan has a permitted range. */
  amount: Money | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  currency: string;
  frequency: string;
  durationWeeks: number | null;
  termsText: string;
};

const VersionShape = z.object({
  id: z.string(),
  version: z.number(),
  contribution_amount: NumericLike.nullable(),
  min_amount: NumericLike.nullable(),
  max_amount: NumericLike.nullable(),
  currency: z.string(),
  frequency: z.string(),
  duration_weeks: z.number().nullable(),
  terms_text: z.string(),
  savings_plans: one(
    z
      .object({
        name: z.string(),
        description: z.string().nullable(),
        long_description: z.string().nullable(),
        is_goal_based: z.boolean(),
        theme: z.string(),
        combo_goals: z.array(z.string()),
      })
      .nullable(),
  ),
});

function toTerms(v: z.infer<typeof VersionShape>): PlanTerms {
  return {
    versionId: v.id,
    planName: v.savings_plans?.name ?? "Savings plan",
    planDescription: v.savings_plans?.description ?? null,
    planLongDescription: v.savings_plans?.long_description ?? null,
    isGoalBased: v.savings_plans?.is_goal_based ?? false,
    theme: toPlanTheme(v.savings_plans?.theme),
    comboGoals: v.savings_plans?.combo_goals ?? [],
    version: v.version,
    amount:
      v.contribution_amount == null ? null : toMoney(v.contribution_amount),
    minAmount: v.min_amount == null ? null : toMoney(v.min_amount),
    maxAmount: v.max_amount == null ? null : toMoney(v.max_amount),
    currency: v.currency,
    frequency: v.frequency,
    durationWeeks: v.duration_weeks,
    termsText: v.terms_text,
  };
}

const VERSION_COLUMNS =
  "id, version, contribution_amount, min_amount, max_amount, currency, frequency, duration_weeks, terms_text, savings_plans(name, description, long_description, is_goal_based, theme, combo_goals)";

export type MyEnrollment = {
  status: "active" | "paused";
  effectiveDate: string;
  nextDueDate: string | null;
  plan: PlanTerms;
};

export function useMyEnrollment(memberId: string) {
  return useQuery({
    queryKey: ["member", memberId, "enrollment"],
    queryFn: async (): Promise<MyEnrollment | null> => {
      const { data, error } = await supabase
        .from("plan_enrollments")
        .select(
          `status, effective_date, next_due_date, savings_plan_versions(${VERSION_COLUMNS})`,
        )
        .eq("member_id", memberId)
        .in("status", ["active", "paused"])
        .limit(1);
      if (error) throw error;
      const rows = z
        .array(
          z.object({
            status: z.enum(["active", "paused"]),
            effective_date: z.string(),
            next_due_date: z.string().nullable(),
            savings_plan_versions: one(VersionShape.nullable()),
          }),
        )
        .parse(data ?? []);
      const row = rows[0];
      if (!row || !row.savings_plan_versions) return null;
      return {
        status: row.status,
        effectiveDate: row.effective_date,
        nextDueDate: row.next_due_date,
        plan: toTerms(row.savings_plan_versions),
      };
    },
  });
}

/** Plans the owner has approved and activated. Draft plans are never returned. */
export function useAvailablePlans() {
  return useQuery({
    queryKey: ["available-plans"],
    queryFn: async (): Promise<PlanTerms[]> => {
      const { data, error } = await supabase
        .from("savings_plan_versions")
        .select(VERSION_COLUMNS)
        .eq("status", "active")
        .not("approved_at", "is", null);
      if (error) throw error;
      return z
        .array(VersionShape)
        .parse(data ?? [])
        .map(toTerms);
    },
    staleTime: 60_000,
  });
}

/**
 * Joins a plan. The database checks everything that matters (the account is active, the plan
 * is live and approved, the member has no other plan, the terms were accepted) and keeps an
 * exact copy of the terms the member accepted. The first contribution is scheduled for them.
 */
export async function joinPlan(
  planVersionId: string,
  acceptedTerms: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("enroll_in_plan", {
    p_plan_version_id: planVersionId,
    p_accept_terms: acceptedTerms,
  });
  if (error) throw error;
}
