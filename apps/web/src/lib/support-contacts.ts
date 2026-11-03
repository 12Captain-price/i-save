import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const Row = z.object({
  id: z.string(),
  full_name: z.string(),
  role_title: z.string(),
  whatsapp_phone: z.string(),
  sort_order: z.number(),
  active: z.boolean(),
});
export type SupportContact = z.infer<typeof Row>;

const COLUMNS = "id, full_name, role_title, whatsapp_phone, sort_order, active";

/** Staff a member can message. Members get active rows only; admins also see hidden ones. */
export const useSupportContacts = () =>
  useQuery({
    queryKey: ["support-contacts"],
    queryFn: async (): Promise<SupportContact[]> => {
      const { data, error } = await supabase
        .from("support_contacts")
        .select(COLUMNS)
        .order("sort_order")
        .order("full_name");
      if (error) throw error;
      return z.array(Row).parse(data);
    },
  });

export type SupportContactValues = Omit<SupportContact, "id">;

export async function saveSupportContact(
  values: SupportContactValues,
  id?: string,
) {
  const { error } = id
    ? await supabase.from("support_contacts").update(values).eq("id", id)
    : await supabase.from("support_contacts").insert(values);
  if (error) throw error;
}

export async function deleteSupportContact(id: string) {
  const { error } = await supabase
    .from("support_contacts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
