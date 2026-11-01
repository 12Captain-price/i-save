import { z } from "zod";
import { toMoney, type Money } from "@/lib/money";

export type Fee = { amount: Money; currency: string };

const FeeValue = z.object({ amount: z.string(), currency: z.string().min(1) });

/**
 * Reads a fee from a system_settings value such as {"amount": "20.00", "currency": "USD"}.
 * Returns null for anything malformed, so a bad setting shows "to be confirmed"
 * instead of a wrong number.
 */
export function parseFeeSetting(value: unknown): Fee | null {
  const parsed = FeeValue.safeParse(value);
  if (!parsed.success) return null;
  try {
    return {
      amount: toMoney(parsed.data.amount),
      currency: parsed.data.currency,
    };
  } catch {
    return null;
  }
}
