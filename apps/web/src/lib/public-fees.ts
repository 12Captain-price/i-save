import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { parseFeeSetting, type Fee } from "@/lib/fee-setting";

export type PublicFees = { registration: Fee | null; subscription: Fee | null };

// Only settings that are both public and approved by the owner are ever shown.
async function fetchPublicFees(): Promise<PublicFees> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["registration_fee", "monthly_subscription"])
    .eq("is_public", true)
    .eq("approved", true);
  if (error) throw error;
  const byKey = new Map(
    (data ?? []).map((row) => [row.key as string, row.value as unknown]),
  );
  return {
    registration: parseFeeSetting(byKey.get("registration_fee")),
    subscription: parseFeeSetting(byKey.get("monthly_subscription")),
  };
}

export function usePublicFees() {
  return useQuery({
    queryKey: ["public-fees"],
    queryFn: fetchPublicFees,
    staleTime: 5 * 60_000,
  });
}
