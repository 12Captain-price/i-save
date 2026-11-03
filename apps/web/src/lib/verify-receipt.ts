import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toMoney, type Money } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import { isReceiptId } from "@/lib/receipt-link";

const Answer = z.discriminatedUnion("found", [
  z.object({ found: z.literal(false) }),
  z.object({
    found: z.literal(true),
    receipt_number: z.string(),
    purpose: z.string(),
    amount: z.union([z.number(), z.string()]),
    currency: z.string(),
    issued_at: z.string(),
    reversed: z.boolean(),
    member_initials: z.string(),
  }),
]);

export type ReceiptCheck =
  | { found: false }
  | {
      found: true;
      receiptNumber: string;
      purpose: string;
      amount: Money;
      currency: string;
      issuedAt: string;
      reversed: boolean;
      memberInitials: string;
    };

/** Asks the database whether a receipt is real. Works for visitors who are not signed in. */
export function useVerifyReceipt(id: string) {
  return useQuery({
    queryKey: ["verify-receipt", id],
    enabled: isReceiptId(id),
    retry: false,
    queryFn: async (): Promise<ReceiptCheck> => {
      const { data, error } = await supabase.rpc("verify_receipt", {
        p_id: id,
      });
      if (error) throw error;
      const a = Answer.parse(data);
      if (!a.found) return { found: false };
      return {
        found: true,
        receiptNumber: a.receipt_number,
        purpose: a.purpose,
        amount: toMoney(a.amount),
        currency: a.currency,
        issuedAt: a.issued_at,
        reversed: a.reversed,
        memberInitials: a.member_initials,
      };
    },
  });
}
