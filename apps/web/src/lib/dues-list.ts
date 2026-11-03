import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toMoney, type Money } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import { todayInZimbabwe } from "@/lib/due-dates";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

export type DueRow = {
  id: string;
  dueDate: string;
  amount: Money | null;
  currency: string;
  memberId: string;
  memberName: string;
  memberNumber: string;
  phone: string | null;
  whatsappOptIn: boolean;
  planName: string | null;
};

const NumericLike = z.union([z.number(), z.string()]);
const one = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (Array.isArray(v) ? (v[0] ?? null) : v), schema);

const Row = z.object({
  id: z.string(),
  due_date: z.string(),
  amount: NumericLike.nullable(),
  currency: z.string(),
  member_id: z.string(),
  profiles: one(
    z
      .object({
        full_name: z.string(),
        member_number: z.string(),
        phone: z.string().nullable(),
        whatsapp_opt_in: z.boolean(),
      })
      .nullable(),
  ),
  plan_enrollments: one(
    z
      .object({
        savings_plan_versions: one(
          z
            .object({
              savings_plans: one(z.object({ name: z.string() }).nullable()),
            })
            .nullable(),
        ),
      })
      .nullable(),
  ),
});

/** Every contribution that is overdue or due in the next 60 days, soonest first. Staff only:
 *  the database lets members see just their own dues. */
export function useDueList() {
  return useQuery({
    queryKey: ["staff", "due-list"],
    queryFn: async (): Promise<DueRow[]> => {
      const today = todayInZimbabwe();
      const horizon = new Date(`${today}T00:00:00Z`);
      horizon.setUTCDate(horizon.getUTCDate() + 60);
      const { data, error } = await supabase
        .from("due_items")
        .select(
          "id, due_date, amount, currency, member_id, profiles(full_name, member_number, phone, whatsapp_opt_in), plan_enrollments(savings_plan_versions(savings_plans(name)))",
        )
        .in("status", ["scheduled", "due"])
        .lte("due_date", horizon.toISOString().slice(0, 10))
        .order("due_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return z
        .array(Row)
        .parse(data ?? [])
        .map((r) => ({
          id: r.id,
          dueDate: r.due_date,
          amount: r.amount === null ? null : toMoney(r.amount),
          currency: r.currency,
          memberId: r.member_id,
          memberName: r.profiles?.full_name ?? "",
          memberNumber: r.profiles?.member_number ?? "",
          phone: r.profiles?.phone ?? null,
          whatsappOptIn: r.profiles?.whatsapp_opt_in ?? false,
          planName:
            r.plan_enrollments?.savings_plan_versions?.savings_plans?.name ??
            null,
        }));
    },
  });
}
