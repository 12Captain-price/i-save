import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { toMoney, type Money } from "@/lib/money";
import { nextVersionNumber, type VersionValues } from "@/lib/plan-utils";

// Admin-side plan data. Row-level security lets admins read and write plans and their
// versions, and lets staff read them. The database also refuses to edit a version that is
// no longer a draft, and refuses an active version with no approved amount.

const NumericLike = z.union([z.number(), z.string()]);
const nullableMoney = NumericLike.nullable().transform((v) =>
  v === null ? null : toMoney(v),
);

const VersionRow = z.object({
  id: z.string(),
  plan_id: z.string(),
  version: z.number(),
  status: z.enum(["draft", "active", "paused", "retired"]),
  contribution_amount: nullableMoney,
  min_amount: nullableMoney,
  max_amount: nullableMoney,
  currency: z.string(),
  frequency: z.string(),
  duration_weeks: z.number().nullable(),
  terms_text: z.string(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const PlanRow = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  long_description: z.string().nullable(),
  is_goal_based: z.boolean(),
  created_at: z.string(),
  savings_plan_versions: z.array(VersionRow),
});

export type VersionStatus = z.infer<typeof VersionRow>["status"];

export type PlanVersion = {
  id: string;
  planId: string;
  version: number;
  status: VersionStatus;
  contributionAmount: Money | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  currency: string;
  frequency: string;
  durationWeeks: number | null;
  termsText: string;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  /** Fuller description shown on the public Plans page, or null. */
  longDescription: string | null;
  /** True for the one plan shown as the featured goal-based plan. */
  isGoalBased: boolean;
  createdAt: string;
  /** Newest version first. */
  versions: PlanVersion[];
};

const VERSION_COLUMNS =
  "id, plan_id, version, status, contribution_amount, min_amount, max_amount, currency, frequency, duration_weeks, terms_text, approved_at, created_at, updated_at";

export async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("savings_plans")
    .select(
      `id, name, description, long_description, is_goal_based, created_at, savings_plan_versions(${VERSION_COLUMNS})`,
    )
    .order("created_at", { ascending: true });
  if (error) throw error;

  return z
    .array(PlanRow)
    .parse(data ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      longDescription: p.long_description,
      isGoalBased: p.is_goal_based,
      createdAt: p.created_at,
      versions: p.savings_plan_versions
        .map(
          (v): PlanVersion => ({
            id: v.id,
            planId: v.plan_id,
            version: v.version,
            status: v.status,
            contributionAmount: v.contribution_amount,
            minAmount: v.min_amount,
            maxAmount: v.max_amount,
            currency: v.currency,
            frequency: v.frequency,
            durationWeeks: v.duration_weeks,
            termsText: v.terms_text,
            approvedAt: v.approved_at,
            createdAt: v.created_at,
            updatedAt: v.updated_at,
          }),
        )
        .sort((a, b) => b.version - a.version),
    }));
}

export function usePlans() {
  return useQuery({
    queryKey: ["staff", "plans"],
    queryFn: fetchPlans,
  });
}

/* ------------------------------------------------------------------ */
/* Changes. Each throws on failure; the screen shows the message.      */
/* ------------------------------------------------------------------ */

/** The extra, public-facing details of a plan. */
export type PlanShowcase = { longDescription: string; isGoalBased: boolean };

/** Only one plan can be the goal-based plan. The database says so with a unique index. */
function showcaseError(error: { code?: string; message?: string }): Error | typeof error {
  if (error.code === "23505" && error.message?.includes("one_goal_based")) {
    return new Error(
      "Another plan is already the goal-based plan. Untick it on that plan first.",
    );
  }
  return error;
}

/** Creates a plan with its first version, as a draft. */
export async function createPlan(
  name: string,
  description: string,
  values: VersionValues,
  showcase: PlanShowcase,
): Promise<void> {
  const created = await supabase
    .from("savings_plans")
    .insert({
      name: name.trim(),
      description: description.trim() || null,
      long_description: showcase.longDescription.trim() || null,
      is_goal_based: showcase.isGoalBased,
    })
    .select("id")
    .single();
  if (created.error) throw showcaseError(created.error);

  const planId = created.data.id as string;
  const version = await supabase
    .from("savings_plan_versions")
    .insert({ plan_id: planId, version: 1, status: "draft", ...values });
  if (version.error) {
    // Do not leave a plan with no version behind.
    await supabase.from("savings_plans").delete().eq("id", planId);
    throw version.error;
  }
}

export async function updatePlanDetails(
  planId: string,
  name: string,
  description: string,
  showcase: PlanShowcase,
): Promise<void> {
  const { error } = await supabase
    .from("savings_plans")
    .update({
      name: name.trim(),
      description: description.trim() || null,
      long_description: showcase.longDescription.trim() || null,
      is_goal_based: showcase.isGoalBased,
    })
    .eq("id", planId);
  if (error) throw showcaseError(error);
}

/** Saves changes to a draft. Fails clearly if the version is no longer a draft. */
export async function saveDraftVersion(
  versionId: string,
  values: VersionValues,
): Promise<void> {
  const { data, error } = await supabase
    .from("savings_plan_versions")
    .update(values)
    .eq("id", versionId)
    .eq("status", "draft")
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "This version is no longer a draft, so it cannot be edited. Create a new version instead.",
    );
  }
}

/** Starts the next version of a plan as a draft, so the approved one is never edited. */
export async function createNextVersion(
  plan: Plan,
  values: VersionValues,
  frequency: string,
  currency: string,
): Promise<void> {
  const { error } = await supabase.from("savings_plan_versions").insert({
    plan_id: plan.id,
    version: nextVersionNumber(plan.versions.map((v) => v.version)),
    status: "draft",
    frequency,
    currency,
    ...values,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "Someone else just added a version to this plan. Reload the page and try again.",
      );
    }
    throw error;
  }
}

/**
 * Puts a draft live. The database stamps who approved it and when. Any other live version of
 * the same plan is then retired, so members only ever see one current version. Members who
 * already joined an older version keep the terms they accepted.
 */
export async function activateVersion(version: PlanVersion): Promise<void> {
  const live = await supabase
    .from("savings_plan_versions")
    .update({ status: "active" })
    .eq("id", version.id)
    .eq("status", "draft")
    .select("id");
  if (live.error) throw live.error;
  if (!live.data || live.data.length === 0) {
    throw new Error("This version is no longer a draft, so it cannot be activated.");
  }

  const retired = await supabase
    .from("savings_plan_versions")
    .update({ status: "retired" })
    .eq("plan_id", version.planId)
    .eq("status", "active")
    .neq("id", version.id);
  if (retired.error) {
    throw new Error(
      `Version ${version.version} is live, but the older version could not be retired: ${retired.error.message}`,
    );
  }
}

/** Stops new members joining this version. Existing members are not affected. */
export async function retireVersion(versionId: string): Promise<void> {
  const { data, error } = await supabase
    .from("savings_plan_versions")
    .update({ status: "retired" })
    .eq("id", versionId)
    .eq("status", "active")
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("This version is not live, so there is nothing to retire.");
  }
}
