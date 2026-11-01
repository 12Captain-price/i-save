import { describe, expect, it } from "vitest";
import {
  addMoney,
  compareMoney,
  formatMoney,
  parseAmountInput,
  subtractMoney,
  sumMoney,
  toMoney,
} from "./money";

describe("parseAmountInput", () => {
  it.each([
    ["20", "20.00"],
    ["20.5", "20.50"],
    ["20.50", "20.50"],
    ["  5 ", "5.00"],
    ["$10", "10.00"],
    ["1,000.50", "1000.50"],
    ["0.01", "0.01"],
  ])("accepts %s", (input, expected) => {
    expect(parseAmountInput(input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ["", "Enter an amount."],
    ["   ", "Enter an amount."],
    ["abc", "Enter a valid amount, for example 20 or 20.50."],
    ["-5", "Enter a valid amount, for example 20 or 20.50."],
    ["1,00", "Enter a valid amount, for example 20 or 20.50."],
    ["20.", "Enter a valid amount, for example 20 or 20.50."],
    ["10.555", "Use at most 2 decimal places."],
    ["0", "The amount must be more than zero."],
    ["0.00", "The amount must be more than zero."],
  ])("rejects %j", (input, message) => {
    expect(parseAmountInput(input)).toEqual({ ok: false, message });
  });
});

describe("toMoney", () => {
  it("turns database values into canonical amounts", () => {
    expect(toMoney(20)).toBe("20.00");
    expect(toMoney("20.5")).toBe("20.50");
    expect(toMoney("0")).toBe("0.00");
  });

  it("refuses values with stray decimals, which means a calculation bug upstream", () => {
    expect(() => toMoney(0.1 + 0.2)).toThrow();
    expect(() => toMoney("1.005")).toThrow();
  });

  it("refuses values that are not numbers", () => {
    expect(() => toMoney("abc")).toThrow();
    expect(() => toMoney(Number.NaN)).toThrow();
    expect(() => toMoney(Infinity)).toThrow();
  });
});

describe("arithmetic", () => {
  it("adds exactly where plain numbers would not", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30");
  });

  it("subtracts and can go negative", () => {
    expect(subtractMoney("20.00", "5.50")).toBe("14.50");
    expect(subtractMoney("5.00", "20.00")).toBe("-15.00");
  });

  it("sums a list, and an empty list is zero", () => {
    expect(sumMoney(["10.00", "10.00", "0.01"])).toBe("20.01");
    expect(sumMoney([])).toBe("0.00");
  });

  it("compares", () => {
    expect(compareMoney("10.00", "20.00")).toBe(-1);
    expect(compareMoney("20.00", "20.00")).toBe(0);
    expect(compareMoney("20.01", "20.00")).toBe(1);
  });
});

describe("formatMoney", () => {
  it("formats USD with a dollar sign and thousands separators", () => {
    expect(formatMoney("20.00")).toBe("$20.00");
    expect(formatMoney("1020.5")).toBe("$1,020.50");
    expect(formatMoney("1234567.89")).toBe("$1,234,567.89");
  });

  it("uses the currency code for other currencies", () => {
    expect(formatMoney("1500.00", "ZWG")).toBe("ZWG 1,500.00");
  });

  it("shows negatives with a minus sign and never shows -$0.00", () => {
    expect(formatMoney("-15.00")).toBe("-$15.00");
    expect(formatMoney("-0.00")).toBe("$0.00");
  });
});
