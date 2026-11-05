import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import {
  GOAL_CONTENT,
  type GoalContent,
  type GoalKey,
} from "@/lib/goal-content";

// The text in each goal panel. Anyone may read it; only admins may change it (migration 023).
// Anything not set in the database falls back to the built-in text, so a panel is never empty.

export type Quote = { text: string; who: string };

/** A goal panel's content plus whether it has been marked as real records and real quotes. */
export type LiveGoal = GoalContent & { real: boolean };

const Row = z.object({
  key: z.string(),
  about: z.string().nullable(),
  how: z.array(z.string()).nullable(),
  past: z.array(z.string()).nullable(),
  present: z.array(z.string()).nullable(),
  ahead: z.array(z.string()).nullable(),
  quotes: z.array(z.object({ text: z.string(), who: z.string() })).nullable(),
  content_is_real: z.boolean(),
});
type GoalRow = z.infer<typeof Row>;

const COLUMNS =
  "key, about, how, past, present, ahead, quotes, content_is_real";

async function fetchRows(): Promise<GoalRow[]> {
  const { data, error } = await supabase.from("goal_content").select(COLUMNS);
  if (error || !data) return [];
  const parsed = z.array(Row).safeParse(data);
  return parsed.success ? parsed.data : [];
}

export function mergeGoal(
  base: GoalContent,
  row: GoalRow | undefined,
): LiveGoal {
  if (!row) return { ...base, real: false };
  return {
    ...base,
    about: row.about ?? base.about,
    how: row.how ?? base.how,
    past: row.past ?? base.past,
    present: row.present ?? base.present,
    ahead: row.ahead ?? base.ahead,
    quotes: row.quotes ?? base.quotes,
    real: row.content_is_real,
  };
}

function useRows() {
  return useQuery({
    queryKey: ["content", "goal-content"],
    queryFn: fetchRows,
    staleTime: 60_000,
  });
}

/** The live version of a goal's panel text, or null when no goal is open. */
export function useLiveGoal(goal: GoalContent | null): LiveGoal | null {
  const rows = useRows().data ?? [];
  if (!goal) return null;
  return mergeGoal(
    goal,
    rows.find((r) => r.key === goal.key),
  );
}

/** All five goals as they are now, or null while loading. Used by the admin screen. */
export function useLiveGoals(): LiveGoal[] | null {
  const q = useRows();
  if (!q.data) return null;
  const rows = q.data;
  return GOAL_CONTENT.map((g) =>
    mergeGoal(
      g,
      rows.find((r) => r.key === g.key),
    ),
  );
}

export type GoalValues = {
  about: string;
  how: string[];
  past: string[];
  present: string[];
  ahead: string[];
  quotes: Quote[];
  real: boolean;
};

export async function saveGoalContent(key: GoalKey, v: GoalValues) {
  const { error, data } = await supabase
    .from("goal_content")
    .update({
      about: v.about,
      how: v.how,
      past: v.past,
      present: v.present,
      ahead: v.ahead,
      quotes: v.quotes,
      content_is_real: v.real,
    })
    .eq("key", key)
    .select("key");
  if (error) throw error;
  if (!data || data.length === 0)
    throw new Error(
      "The goal could not be saved. Only administrators can change it, and migration 023 must have been run.",
    );
}
