import { describe, expect, it } from "vitest";
import {
  buildMemberSearchFilter,
  formatCalendarDay,
  isAdminRole,
  isStaffRole,
  normalizeNationalId,
  providerLabel,
  purposeLabel,
  receiptPurposeNote,
  reversalConsequences,
  validateReversalReason,
  staffErrorMessage,
  validateNationalId,
  validateReceiptNo,
} from "./staff-utils";

describe("roles", () => {
  it("treats finance, admin and super_admin as staff", () => {
    expect(isStaffRole(["member", "finance"])).toBe(true);
    expect(isStaffRole(["admin"])).toBe(true);
    expect(isStaffRole(["super_admin"])).toBe(true);
  });
  it("does not treat a plain member as staff", () => {
    expect(isStaffRole(["member"])).toBe(false);
    expect(isStaffRole([])).toBe(false);
  });
  it("only admins can sign off", () => {
    expect(isAdminRole(["member", "finance"])).toBe(false);
    expect(isAdminRole(["member", "finance", "admin"])).toBe(true);
    expect(isAdminRole(["super_admin"])).toBe(true);
  });
});

describe("buildMemberSearchFilter", () => {
  it("returns null for an empty search", () => {
    expect(buildMemberSearchFilter("   ")).toBeNull();
    expect(buildMemberSearchFilter('%,()"')).toBeNull();
  });
  it("searches name, member number, email and phone", () => {
    const filter = buildMemberSearchFilter("sipho");
    expect(filter).toContain('full_name.ilike."%sipho%"');
    expect(filter).toContain('member_number.ilike."%sipho%"');
    expect(filter).toContain('email.ilike."%sipho%"');
    expect(filter).toContain('phone.ilike."%sipho%"');
  });
  it("cannot be used to inject extra filter conditions", () => {
    const filter = buildMemberSearchFilter('x%",status.eq.active,("') ?? "";
    expect(filter).not.toContain(",status.eq.active");
    expect(filter.split(",")).toHaveLength(4);
  });
  it("adds an exact match for a normalised phone number", () => {
    expect(buildMemberSearchFilter("0771234567", "+263771234567")).toContain(
      "phone.eq.+263771234567",
    );
  });
});

describe("national ID", () => {
  it("keeps letters and digits only, in upper case", () => {
    expect(normalizeNationalId("63-123456 a 12")).toBe("63123456A12");
  });
  it("accepts a normal Zimbabwean ID", () => {
    expect(validateNationalId("63-123456 A 12")).toBeNull();
  });
  it("rejects empty and out-of-range numbers", () => {
    expect(validateNationalId("")).not.toBeNull();
    expect(validateNationalId("12345")).not.toBeNull();
    expect(validateNationalId("1".repeat(21))).not.toBeNull();
  });
});

describe("receipt number", () => {
  it("needs 3 to 40 characters", () => {
    expect(validateReceiptNo("12")).not.toBeNull();
    expect(validateReceiptNo("  A-1043 ")).toBeNull();
    expect(validateReceiptNo("x".repeat(41))).not.toBeNull();
  });
});

describe("display helpers", () => {
  it("labels purposes in plain words", () => {
    expect(purposeLabel("registration_fee")).toBe("Registration fee");
    expect(purposeLabel("something_new")).toBe("Something new");
  });
  it("formats a calendar day without shifting it", () => {
    expect(formatCalendarDay("2026-11-01")).toContain("1 Nov 2026");
  });
  it("uses the database message when there is one", () => {
    expect(
      staffErrorMessage({ message: "Receipt number A1 has already been used" }),
    ).toBe("Receipt number A1 has already been used");
    expect(staffErrorMessage(null)).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("receipt wording", () => {
  it("names how the member paid", () => {
    expect(providerLabel("office_cash")).toBe("Cash");
    expect(providerLabel("office_bank_transfer")).toBe("Bank transfer");
    expect(providerLabel("mobile_money")).toBe("Mobile money");
  });
  it("says savings contributions go to savings", () => {
    expect(receiptPurposeNote("savings_contribution")).toMatch(
      /added to your savings/i,
    );
  });
  it("says fees are not savings", () => {
    for (const purpose of ["registration_fee", "monthly_subscription"]) {
      expect(receiptPurposeNote(purpose)).toMatch(/not added to your savings/i);
    }
  });
  it("adds no note for a purpose it does not know", () => {
    expect(receiptPurposeNote("something_else")).toBe("");
  });
});

describe("reversals", () => {
  it("needs a real reason", () => {
    expect(validateReversalReason("")).not.toBeNull();
    expect(validateReversalReason("   oops ")).not.toBeNull();
    expect(validateReversalReason("Wrong member")).toBeNull();
    expect(validateReversalReason("x".repeat(301))).not.toBeNull();
  });
  it("tells staff a contribution becomes due again", () => {
    expect(reversalConsequences("savings_contribution").join(" ")).toMatch(
      /due again/i,
    );
  });
  it("tells staff a registration fee reversal does not deactivate the member", () => {
    expect(reversalConsequences("registration_fee").join(" ")).toMatch(
      /stays active/i,
    );
  });
});
