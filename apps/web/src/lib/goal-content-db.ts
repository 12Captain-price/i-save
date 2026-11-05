import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { GOAL_CONTENT, type GoalContent } from "@/lib/goal-content";

// The savings goals shown on the home page, in the Plans filter and in each goal panel.
// Anyone may read them; only admins may change them (migrations 023 and 024). The five original
// goals are built in, so the site is never empty, and anything an admin sets in the database
// overrides the built-in text. Goals an admin adds exist only in the database.

export type Quote = { text: string; who: string };

/** A goal plus whether its figures are real, whether it is shown, and where it sits in the list. */
export type LiveGoal = GoalContent & {
  real: boolean;
  active: boolean;
  builtin: boolean;
  order: number;
};

const Row = z.object({
  key: z.string(),
  label: z.string().nullish(),
  purpose: z.string().nullish(),
  icon: z.string().nullish(),
  accent: z.string().nullish(),
  sort_order: z.number().nullish(),
  active: z.boolean().nullish(),
  builtin: z.boolean().nullish(),
  about: z.string().nullable(),
  how: z.array(z.string()).nullable(),
  past: z.array(z.string()).nullable(),
  present: z.array(z.string()).nullable(),
  ahead: z.array(z.string()).nullable(),
  quotes: z.array(z.object({ text: z.string(), who: z.string() })).nullable(),
  content_is_real: z.boolean(),
});
type GoalRow = z.infer<typeof Row>;

const CONTENT_COLUMNS =
  "key, about, how, past, present, ahead, quotes, content_is_real";
const FULL_COLUMNS = `${CONTENT_COLUMNS}, label, purpose, icon, accent, sort_order, active, builtin`;

async function fetchRows(): Promise<GoalRow[]> {
  // Before migration 024 is run the new columns do not exist, so fall back to the old ones.
  let res = await supabase.from("goal_content").select(FULL_COLUMNS);
  if (res.error)
    res = await supabase.from("goal_content").select(CONTENT_COLUMNS);
  if (res.error || !res.data) return [];
  const parsed = z.array(Row).safeParse(res.data);
  return parsed.success ? parsed.data : [];
}

const BLANK: Omit<GoalContent, "key" | "label"> = {
  purpose: "",
  icon: "target",
  accent: "green",
  about: "",
  how: [],
  past: [],
  present: [],
  ahead: [],
  quotes: [],
};

export function mergeGoal(
  base: GoalContent | undefined,
  row: GoalRow | undefined,
  index: number,
): LiveGoal {
  const key = base?.key ?? row?.key ?? "";
  const b: GoalContent = base ?? { ...BLANK, key, label: row?.label ?? key };
  return {
    ...b,
    label: row?.label || b.label,
    purpose: row?.purpose ?? b.purpose,
    icon: row?.icon || b.icon,
    accent: row?.accent || b.accent,
    about: row?.about ?? b.about,
    how: row?.how ?? b.how,
    past: row?.past ?? b.past,
    present: row?.present ?? b.present,
    ahead: row?.ahead ?? b.ahead,
    quotes: row?.quotes ?? b.quotes,
    real: row?.content_is_real ?? false,
    active: row?.active ?? true,
    builtin: row?.builtin ?? base !== undefined,
    order: row?.sort_order ?? (index + 1) * 10,
  };
}

/** Built-in goals merged with the database rows, plus any goals an admin added, in order. */
export function buildGoals(rows: GoalRow[]): LiveGoal[] {
  const merged = GOAL_CONTENT.map((g, i) =>
    mergeGoal(
      g,
      rows.find((r) => r.key === g.key),
      i,
    ),
  );
  const added = rows
    .filter((r) => !GOAL_CONTENT.some((g) => g.key === r.key))
    .map((r, i) => mergeGoal(undefined, r, GOAL_CONTENT.length + i));
  return [...merged, ...added].sort(
    (a, b) => a.order - b.order || a.label.localeCompare(b.label),
  );
}

function useRows() {
  return useQuery({
    queryKey: ["content", "goal-content"],
    queryFn: fetchRows,
    staleTime: 60_000,
  });
}

/**
 * The goals to show visitors (hidden ones left out), or every goal when `all` is set, as the
 * admin screen needs. While loading or if the database cannot be reached, the five built-in
 * goals are returned so the page is never empty.
 */
export function useGoals(all = false): { goals: LiveGoal[]; loaded: boolean } {
  const q = useRows();
  const goals = buildGoals(q.data ?? []);
  return {
    goals: all ? goals : goals.filter((g) => g.active),
    loaded: q.isSuccess,
  };
}

export type GoalValues = {
  label: string;
  purpose: string;
  icon: string;
  accent: string;
  active: boolean;
  about: string;
  how: string[];
  past: string[];
  present: string[];
  ahead: string[];
  quotes: Quote[];
  real: boolean;
};

const NEEDS_MIGRATION =
  "The goal could not be saved. Only administrators can change goals, and migrations 023 and 024 must have been run in Supabase.";

/** Creates the goal, or updates it if it exists. `order` is only used for a new goal. */
export async function saveGoal(key: string, v: GoalValues, order: number) {
  const { error, data } = await supabase
    .from("goal_content")
    .upsert(
      {
        key,
        label: v.label,
        purpose: v.purpose,
        icon: v.icon,
        accent: v.accent,
        active: v.active,
        about: v.about,
        how: v.how,
        past: v.past,
        present: v.present,
        ahead: v.ahead,
        quotes: v.quotes,
        content_is_real: v.real,
        sort_order: order,
      },
      { onConflict: "key" },
    )
    .select("key");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(NEEDS_MIGRATION);
}

/** Saves a new position for each goal in the list (10, 20, 30 and so on). */
export async function saveGoalOrder(keys: string[]) {
  const results = await Promise.all(
    keys.map((key, i) =>
      supabase
        .from("goal_content")
        .update({ sort_order: (i + 1) * 10 })
        .eq("key", key)
        .select("key"),
    ),
  );
  for (const r of results) {
    if (r.error) throw r.error;
    if (!r.data || r.data.length === 0) throw new Error(NEEDS_MIGRATION);
  }
}

/** Show or hide a goal on the website. */
export async function setGoalActive(key: string, active: boolean) {
  const { error, data } = await supabase
    .from("goal_content")
    .update({ active })
    .eq("key", key)
    .select("key");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(NEEDS_MIGRATION);
}

/** Delete a goal an admin added. The original five are hidden instead. */
export async function deleteGoal(key: string) {
  const { error, data } = await supabase
    .from("goal_content")
    .delete()
    .eq("key", key)
    .select("key");
  if (error) throw error;
  if (!data || data.length === 0)
    throw new Error("That goal could not be deleted.");
}
