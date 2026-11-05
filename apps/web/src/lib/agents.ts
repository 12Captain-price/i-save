import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { removePictures, uploadPicture } from "@/lib/content";
import { supabase } from "@/lib/supabase";

// Registration agents. Visitors can read published agents only; administrators can read and
// change everything. The database enforces both rules (migration 017).

const AgentRow = z.object({
  id: z.string(),
  name: z.string(),
  registration_url: z.string(),
  note: z.string().nullable(),
  photo_path: z.string().nullable(),
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

const AGENT_COLUMNS =
  "id, name, registration_url, note, photo_path, sort_order, published";

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

export async function saveAgent(
  values: AgentValues,
  opts: { id?: string; photo?: File | null; oldPhotoPath?: string | null } = {},
) {
  const photo_path = opts.photo
    ? await uploadPicture("agents", opts.photo)
    : undefined;
  const row = photo_path ? { ...values, photo_path } : values;
  const { error } = opts.id
    ? await supabase.from("agents").update(row).eq("id", opts.id)
    : await supabase.from("agents").insert(row);
  if (error) {
    await removePictures([photo_path]);
    throw error;
  }
  if (photo_path) await removePictures([opts.oldPhotoPath]);
}

export async function deleteAgent(agent: Agent) {
  const { error } = await supabase.from("agents").delete().eq("id", agent.id);
  if (error) throw error;
  await removePictures([agent.photo_path]);
}
