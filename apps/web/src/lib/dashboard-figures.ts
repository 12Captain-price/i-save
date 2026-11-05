import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { DEMO_KPIS, type Metric, type MonthPoint } from "@/lib/home-dashboard";
import { HOME_MEMBER_COUNT } from "@/lib/home-stats";

// The home page figures. Anyone may read them; only admins may change them (the database
// enforces both, migration 022). If the database cannot be reached, the built-in demo figures
// are used so the home page is never empty.

export type MonthlyFigure = { month: string; savings: number; members: number };

export type DashboardFigures = {
  memberCount: number | null;
  /** null means: count the published agents. */
  agentCount: number | null;
  activeSavers: number;
  goalsReached: number;
  townsReached: number;
  avgSaved: number;
  monthly: MonthlyFigure[];
  illustrative: boolean;
};

const kpi = (label: string) =>
  DEMO_KPIS.find((k) => k.label === label)?.value ?? 0;

export const DEFAULT_FIGURES: DashboardFigures = {
  memberCount: HOME_MEMBER_COUNT,
  agentCount: null,
  activeSavers: kpi("Active savers"),
  goalsReached: kpi("Goals reached"),
  townsReached: kpi("Towns reached"),
  avgSaved: kpi("Average saved per member"),
  monthly: [],
  illustrative: true,
};

const Row = z.object({
  member_count: z.number().nullable(),
  agent_count: z.number().nullable(),
  active_savers: z.number(),
  goals_reached: z.number(),
  towns_reached: z.number(),
  avg_saved: z.number(),
  monthly: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      savings: z.number(),
      members: z.number(),
    }),
  ),
  illustrative: z.boolean(),
});

const COLUMNS =
  "member_count, agent_count, active_savers, goals_reached, towns_reached, avg_saved, monthly, illustrative";

async function fetchFigures(): Promise<DashboardFigures> {
  const { data, error } = await supabase
    .from("dashboard_figures")
    .select(COLUMNS)
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULT_FIGURES;
  const parsed = Row.safeParse(data);
  if (!parsed.success) return DEFAULT_FIGURES;
  const r = parsed.data;
  return {
    memberCount: r.member_count,
    agentCount: r.agent_count,
    activeSavers: r.active_savers,
    goalsReached: r.goals_reached,
    townsReached: r.towns_reached,
    avgSaved: r.avg_saved,
    monthly: r.monthly,
    illustrative: r.illustrative,
  };
}

/** The live figures, or null for the moment they are loading. */
export function useDashboardFigures(): DashboardFigures | null {
  const query = useQuery({
    queryKey: ["content", "dashboard-figures"],
    queryFn: fetchFigures,
    staleTime: 60_000,
  });
  return query.data ?? null;
}

export async function saveDashboardFigures(values: DashboardFigures) {
  const { error, data } = await supabase
    .from("dashboard_figures")
    .update({
      member_count: values.memberCount,
      agent_count: values.agentCount,
      active_savers: values.activeSavers,
      goals_reached: values.goalsReached,
      towns_reached: values.townsReached,
      avg_saved: values.avgSaved,
      monthly: values.monthly,
      illustrative: values.illustrative,
    })
    .eq("id", 1)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0)
    throw new Error(
      "The figures could not be saved. Only administrators can change them.",
    );
}

/** The four headline figures on the dashboard, in the order they are shown. */
export function kpisFrom(f: DashboardFigures) {
  return [
    { label: "Active savers", value: f.activeSavers, money: false },
    { label: "Goals reached", value: f.goalsReached, money: false },
    { label: "Towns reached", value: f.townsReached, money: false },
    { label: "Average saved per member", value: f.avgSaved, money: true },
  ];
}

/** Replaces the demo value of any month the office has entered. Other months are unchanged. */
export function withOverrides(
  points: MonthPoint[],
  monthly: MonthlyFigure[],
  metric: Metric,
): MonthPoint[] {
  if (monthly.length === 0) return points;
  const byMonth = new Map(monthly.map((m) => [m.month, m]));
  return points.map((p) => {
    const o = byMonth.get(p.key);
    if (!o) return p;
    return { ...p, value: metric === "savings" ? o.savings : o.members };
  });
}

/** A whole number from 0 to max, or null when the text is not one. Blank is not allowed here. */
export function wholeNumber(text: string, max: number): number | null {
  const t = text.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= max ? n : null;
}
