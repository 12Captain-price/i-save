import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// Registration agents. Visitors can read published agents only; administrators can read and
// change everything. The database enforces both rules (migration 017).

const AgentRow = z.object({
  id: z.string(),
  name: z.string(),
  registration_url: z.string(),
  note: z.string().nullable(),
  sort_order: z.number(),
  published: z.boolean(),
});
export type Agent = z.infer<typeof AgentRow>;

export type AgentValues = {
  name: string;
  registration_url: string;
  note: string | null;
  sort_order: number;
  published: boolean;
};

const AGENT_COLUMNS = "id, name, registration_url, note, sort_order, published";

async function fetchAgents(all: boolean): Promise<Agent[]> {
  let q = supabase
    .from("agents")
    .select(AGENT_COLUMNS)
    .order("sort_order")
    .order("name");
  if (!all) q = q.eq("published", true);
  const { data, error } = await q;
  if (error) throw error;
  return z.array(AgentRow).parse(data);
}

/** The ["content", ...] key means useContentAction refreshes these lists after every change. */
export const useAgents = (all = false) =>
  useQuery({
    queryKey: ["content", "agents", all],
    queryFn: () => fetchAgents(all),
  });

export async function saveAgent(values: AgentValues, id?: string) {
  const { error } = id
    ? await supabase.from("agents").update(values).eq("id", id)
    : await supabase.from("agents").insert(values);
  if (error) throw error;
}

export async function deleteAgent(agent: Agent) {
  const { error } = await supabase.from("agents").delete().eq("id", agent.id);
  if (error) throw error;
}
