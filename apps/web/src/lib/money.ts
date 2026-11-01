import Decimal from "decimal.js";

// All money maths in the app goes through this file. Never add or compare amounts
// with plain JavaScript numbers: 0.1 + 0.2 is 0.30000000000000004.
const D = Decimal.clone({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/** A canonical amount with exactly two decimals, for example "20.00". */
export type Money = string;

export type MoneyParseResult = { ok: true; value: Money } | { ok: false; message: string };

// Digits, with optional thousands commas and up to 2 decimals, and an optional leading $.
const AMOUNT_PATTERN = /^\$?\s*(\d{1,12}|\d{1,3}(?:,\d{3})+)(\.\d+)?$/;

/** Reads an amount a person typed. Never rounds silently: bad input is rejected with a plain message. */
export function parseAmountInput(text: string): MoneyParseResult {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, message: "Enter an amount." };

  const match = AMOUNT_PATTERN.exec(trimmed);
  if (!match) return { ok: false, message: "Enter a valid amount, for example 20 or 20.50." };

  const decimals = match[2] ? match[2].length - 1 : 0;
  if (decimals > 2) return { ok: false, message: "Use at most 2 decimal places." };

  const value = new D(trimmed.replace(/[$,\s]/g, ""));
  if (value.lte(0)) return { ok: false, message: "The amount must be more than zero." };

  return { ok: true, value: value.toFixed(2) };
}

/**
 * Converts a value that came from the database into Money.
 * Throws if the value is not a clean 2-decimal amount, because that means a bug.
 */
export function toMoney(value: number | string): Money {
  const d = new D(value);
  if (!d.isFinite()) throw new Error(`Not a valid amount: ${String(value)}`);
  if (d.decimalPlaces() > 2) {
    throw new Error(`Amount has more than 2 decimals: ${String(value)}`);
  }
  return d.toFixed(2);
}

export function addMoney(a: Money, b: Money): Money {
  return new D(a).plus(b).toFixed(2);
}

export function subtractMoney(a: Money, b: Money): Money {
  return new D(a).minus(b).toFixed(2);
}

export function sumMoney(values: Money[]): Money {
  return values.reduce((total, v) => total.plus(v), new D(0)).toFixed(2);
}

/** Returns -1 if a < b, 0 if equal, 1 if a > b. */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  return new D(a).comparedTo(b) as -1 | 0 | 1;
}

/** Formats for display: $1,020.50 for USD, "ZWG 1,020.50" for anything else. */
export function formatMoney(value: Money, currency = "USD"): string {
  const d = new D(value);
  const [whole, cents] = d.abs().toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = d.isNegative() && !d.isZero() ? "-" : "";
  const prefix = currency === "USD" ? "$" : `${currency} `;
  return `${sign}${prefix}${grouped}.${cents}`;
}
