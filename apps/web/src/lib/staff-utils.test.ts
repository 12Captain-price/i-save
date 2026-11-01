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

import {
  auditActionLabel,
  auditDetailsSummary,
  buildLedgerSearchFilter,
  dayRangeToTimestamps,
  isDayRangeBackwards,
  isSensitiveAuditAction,
} from "./staff-utils";

describe("ledger search filter", () => {
  it("returns null for an empty search", () => {
    expect(buildLedgerSearchFilter("   ")).toBeNull();
  });
  it("searches member, receipt and book numbers", () => {
    const f = buildLedgerSearchFilter("RCT-00000005") ?? "";
    expect(f).toContain('receipt_number.ilike."%RCT-00000005%"');
    expect(f).toContain('office_receipt_no.ilike."%RCT-00000005%"');
    expect(f).toContain("member_number.ilike");
    expect(f).toContain("full_name.ilike");
  });
  it("cannot be used to add its own conditions", () => {
    const f = buildLedgerSearchFilter('x%",member_id.neq.0,"') ?? "";
    // Still exactly the five searches, each with its value wrapped in one pair of quotes.
    const parts = f.split(",");
    expect(parts).toHaveLength(5);
    for (const part of parts) {
      expect(part).toMatch(/^[a-z_]+\.ilike\."[^"]*"$/);
    }
  });
});

describe("day range", () => {
  it("cuts days at midnight Zimbabwe time and includes the end day", () => {
    const r = dayRangeToTimestamps("2026-11-01", "2026-11-01");
    expect(r.from).toBe("2026-10-31T22:00:00.000Z");
    expect(r.to).toBe("2026-11-01T22:00:00.000Z");
  });
  it("ignores empty or invalid days", () => {
    expect(dayRangeToTimestamps("", "nope")).toEqual({ from: null, to: null });
  });
  it("spots a backwards range", () => {
    expect(isDayRangeBackwards("2026-11-02", "2026-11-01")).toBe(true);
    expect(isDayRangeBackwards("2026-11-01", "2026-11-01")).toBe(false);
    expect(isDayRangeBackwards("", "2026-11-01")).toBe(false);
  });
});

describe("audit wording", () => {
  it("labels known and unknown actions", () => {
    expect(auditActionLabel("ledger.reversed")).toBe("Payment reversed");
    expect(auditActionLabel("some.new_action")).toBe("Some new action");
  });
  it("flags reversals and ID views", () => {
    expect(isSensitiveAuditAction("ledger.reversed")).toBe(true);
    expect(isSensitiveAuditAction("id.viewed")).toBe(true);
    expect(isSensitiveAuditAction("payment.confirmed")).toBe(false);
  });
  it("summarises a reversal with its reason", () => {
    expect(
      auditDetailsSummary("ledger.reversed", {
        reason: "Wrong amount",
        due_item_reinstated: true,
      }),
    ).toBe("Reason: Wrong amount. Contribution is due again");
  });
  it("summarises an office payment without ever showing an ID number", () => {
    expect(
      auditDetailsSummary("office_payment.recorded", {
        amount: 5,
        currency: "USD",
        method: "office_cash",
        receipt_no: "R-4001",
      }),
    ).toBe("5 USD · Cash · Receipt book no. R-4001");
    expect(auditDetailsSummary("id.viewed", {})).toBe("");
  });
});
