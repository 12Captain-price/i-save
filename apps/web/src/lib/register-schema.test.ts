import { describe, expect, it } from "vitest";
import { registerApplicantSchema } from "./register-schema";

const valid = {
  fullName: "Rudo Moyo",
  email: "Rudo@Example.com",
  phone: "077 123 4567",
  nationalId: "63-123456-A-12",
  categoryInterest: "education",
  ageConfirmed: true,
  termsAccepted: true,
};

describe("office registration form rules", () => {
  it("cleans up what staff typed the same way the online form does", () => {
    const r = registerApplicantSchema.parse(valid);
    expect(r.email).toBe("rudo@example.com");
    expect(r.phone).toBe("+263771234567");
    expect(r.nationalId).toBe("63123456A12");
  });
  it("needs no password", () => {
    expect(registerApplicantSchema.safeParse(valid).success).toBe(true);
  });
  it("requires an email, because the login link is emailed", () => {
    expect(
      registerApplicantSchema.safeParse({ ...valid, email: "" }).success,
    ).toBe(false);
  });
  it("needs both confirmations", () => {
    expect(
      registerApplicantSchema.safeParse({ ...valid, ageConfirmed: false })
        .success,
    ).toBe(false);
    expect(
      registerApplicantSchema.safeParse({ ...valid, termsAccepted: false })
        .success,
    ).toBe(false);
  });
  it("rejects an unknown category and a bad phone", () => {
    expect(
      registerApplicantSchema.safeParse({ ...valid, categoryInterest: "yacht" })
        .success,
    ).toBe(false);
    expect(
      registerApplicantSchema.safeParse({ ...valid, phone: "12" }).success,
    ).toBe(false);
  });
});
