import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// Traffic tracking. Visitors can only call record_traffic(); administrators read the figures
// through traffic_summary(). The database enforces both rules (migration 018).

export type TrafficEventType = "page_view" | "apply_click" | "agent_click";

const VISITOR_KEY = "isave-visitor";
let memoryId: string | null = null;

/** A random code kept in this browser, so repeat visits count as one visitor. No personal data. */
function visitorId(): string {
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved && saved.length >= 8) return saved;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing can block storage. Fall back to one code per page load.
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}

/** Fire and forget. A failed count must never get in the visitor's way. */
export async function recordTraffic(
  type: TrafficEventType,
  path: string,
  agentId?: string,
): Promise<void> {
  try {
    await supabase.rpc("record_traffic", {
      p_type: type,
      p_path: path,
      p_agent_id: agentId ?? null,
      p_visitor: visitorId(),
    });
  } catch {
    // Ignored on purpose.
  }
}

const TrafficSummary = z.object({
  totals: z.object({
    page_views: z.number(),
    visitors: z.number(),
    apply_clicks: z.number(),
    agent_clicks: z.number(),
    apply_page_views: z.number(),
  }),
  pages: z.array(
    z.object({ path: z.string(), views: z.number(), visitors: z.number() }),
  ),
  agents: z.array(
    z.object({
      agent_id: z.string().nullable(),
      name: z.string(),
      removed: z.boolean(),
      clicks: z.number(),
      visitors: z.number(),
    }),
  ),
  daily: z.array(
    z.object({
      day: z.string(),
      views: z.number(),
      apply_clicks: z.number(),
      agent_clicks: z.number(),
    }),
  ),
});
export type TrafficSummaryData = z.infer<typeof TrafficSummary>;

export const useTrafficSummary = (from: string, to: string, enabled: boolean) =>
  useQuery({
    queryKey: ["traffic", from, to],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("traffic_summary", {
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return TrafficSummary.parse(data);
    },
  });
