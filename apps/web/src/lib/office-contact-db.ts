import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { OFFICE_CONTACT, type OfficeContact } from "@/lib/office-contact";

// The live office details. Anyone may read them; only admins may change them (the database
// enforces both). If the database cannot be reached, the approved values in office-contact.ts
// are used so the Contact page is never empty.

const Row = z.object({
  phones: z.array(z.object({ label: z.string(), value: z.string() })),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  hours: z.string().nullable(),
});

const blank = (v: string | null) => (v && v.trim() !== "" ? v.trim() : null);

function toContact(r: z.infer<typeof Row>): OfficeContact {
  const phones = r.phones.filter((p) => p.value.trim() !== "");
  return {
    phone: phones[0]?.value ?? null,
    phones,
    whatsapp: blank(r.whatsapp),
    email: blank(r.email),
    address: blank(r.address),
    hours: blank(r.hours),
  };
}

async function fetchContact(): Promise<OfficeContact> {
  const { data, error } = await supabase
    .from("office_contact")
    .select("phones, whatsapp, email, address, hours")
    .eq("id", 1)
    .maybeSingle();
  // Not set up yet (or unreachable): fall back to the approved starting values.
  if (error || !data) return OFFICE_CONTACT;
  return toContact(Row.parse(data));
}

/** The office details, or null for the moment they are loading. */
export function useOfficeContact(): OfficeContact | null {
  const query = useQuery({
    queryKey: ["content", "office-contact"],
    queryFn: fetchContact,
    staleTime: 60_000,
  });
  return query.data ?? null;
}

export type OfficeContactValues = {
  phones: Array<{ label: string; value: string }>;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  hours: string | null;
};

export async function saveOfficeContact(values: OfficeContactValues) {
  const { error, data } = await supabase
    .from("office_contact")
    .update(values)
    .eq("id", 1)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0)
    throw new Error(
      "The contact details could not be saved. Only administrators can change them.",
    );
}
