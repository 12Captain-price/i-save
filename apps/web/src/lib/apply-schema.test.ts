import { describe, expect, it } from "vitest";
import { applySchema, fieldErrors, normalizeNationalId } from "./apply-schema";

const valid = {
  fullName: "  Tanaka Moyo ",
  email: "  Tanaka@Example.COM ",
  phone: "077 123 4567",
  nationalId: "63-123456 a 12",
  categoryInterest: "education",
  password: "correct horse",
  confirmPassword: "correct horse",
  ageConfirmed: true,
  termsAccepted: true,
};

describe("applySchema", () => {
  it("accepts a valid application and cleans the values", () => {
    const result = applySchema.parse(valid);
    expect(result.fullName).toBe("Tanaka Moyo");
    expect(result.email).toBe("tanaka@example.com");
    expect(result.phone).toBe("+263771234567");
    expect(result.nationalId).toBe("63123456A12");
  });

  it("allows no category interest", () => {
    expect(
      applySchema.safeParse({ ...valid, categoryInterest: "" }).success,
    ).toBe(true);
  });

  it("rejects an unknown category", () => {
    expect(
      applySchema.safeParse({ ...valid, categoryInterest: "crypto" }).success,
    ).toBe(false);
  });

  it("rejects a bad phone number with a plain message", () => {
    const result = applySchema.safeParse({ ...valid, phone: "12" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).phone).toBeTruthy();
  });

  it("rejects an ID that is too short once cleaned", () => {
    const result = applySchema.safeParse({ ...valid, nationalId: "--12--" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(fieldErrors(result.error).nationalId).toBeTruthy();
  });

  it("rejects a short password", () => {
    const result = applySchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords on the confirm field", () => {
    const result = applySchema.safeParse({
      ...valid,
      confirmPassword: "different one",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(fieldErrors(result.error).confirmPassword).toBeTruthy();
  });

  it("requires the age confirmation and the terms", () => {
    const age = applySchema.safeParse({ ...valid, ageConfirmed: false });
    const terms = applySchema.safeParse({ ...valid, termsAccepted: false });
    expect(age.success).toBe(false);
    expect(terms.success).toBe(false);
    if (!age.success) expect(fieldErrors(age.error).ageConfirmed).toBeTruthy();
    if (!terms.success)
      expect(fieldErrors(terms.error).termsAccepted).toBeTruthy();
  });

  it("rejects an invalid email", () => {
    expect(
      applySchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });
});

describe("normalizeNationalId", () => {
  it("keeps letters and digits only, in upper case", () => {
    expect(normalizeNationalId("63-123456 b 42")).toBe("63123456B42");
  });
});
