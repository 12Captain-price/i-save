import { describe, expect, it } from "vitest";
import { isZimbabweMobile, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["0771234567", "+263771234567"],
    ["077 123 4567", "+263771234567"],
    ["077-123-4567", "+263771234567"],
    ["+263771234567", "+263771234567"],
    ["+263 77 123 4567", "+263771234567"],
    ["263771234567", "+263771234567"],
    ["00263771234567", "+263771234567"],
    ["771234567", "+263771234567"],
    ["(077) 123 4567", "+263771234567"],
    ["  0771234567  ", "+263771234567"],
  ])("normalises %j", (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, value: expected });
  });

  it("accepts international numbers from other countries", () => {
    expect(normalizePhone("+27821234567")).toEqual({ ok: true, value: "+27821234567" });
    expect(normalizePhone("0027821234567")).toEqual({ ok: true, value: "+27821234567" });
  });

  it.each([
    ["", "Enter a phone number."],
    ["   ", "Enter a phone number."],
    ["077abc4567", "Phone numbers can only contain digits, spaces, dashes and a leading +."],
    ["077123456", "A Zimbabwean number starting with 0 needs 10 digits, for example 0771234567."],
    ["07712345678", "A Zimbabwean number starting with 0 needs 10 digits, for example 0771234567."],
    ["+26377123456", "Zimbabwean numbers need 9 digits after +263."],
    ["12345", "Enter the number like 0771234567, or with a country code like +263771234567."],
    ["+0771234567", "That does not look like a valid phone number."],
    ["+123", "That does not look like a valid phone number."],
  ])("rejects %j", (input, message) => {
    expect(normalizePhone(input)).toEqual({ ok: false, message });
  });

  it("always produces something the database accepts", () => {
    const dbPattern = /^\+[1-9][0-9]{7,14}$/;
    for (const input of ["0771234567", "263771234567", "+27821234567", "771234567"]) {
      const result = normalizePhone(input);
      expect(result.ok && dbPattern.test(result.value)).toBe(true);
    }
  });
});

describe("isZimbabweMobile", () => {
  it("recognises Zimbabwean mobile prefixes", () => {
    for (const n of ["+263771234567", "+263781234567", "+263711234567", "+263731234567"]) {
      expect(isZimbabweMobile(n)).toBe(true);
    }
  });

  it("rejects landlines and foreign numbers", () => {
    expect(isZimbabweMobile("+263292123456")).toBe(false);
    expect(isZimbabweMobile("+27821234567")).toBe(false);
  });
});
