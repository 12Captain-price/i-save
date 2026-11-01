import { describe, expect, it } from "vitest";
import {
  EMPTY_VERSION_FORM,
  activationProblems,
  describeAmount,
  describeDuration,
  describePlanAmount,
  nextVersionNumber,
  validatePlanDescription,
  validatePlanName,
  validateVersionForm,
  versionToFormInput,
  type VersionFormInput,
} from "./plan-utils";

const fixed = (over: Partial<VersionFormInput> = {}): VersionFormInput => ({
  ...EMPTY_VERSION_FORM,
  mode: "fixed",
  amount: "5",
  terms: "Pay every week.",
  ...over,
});

const range = (over: Partial<VersionFormInput> = {}): VersionFormInput => ({
  ...EMPTY_VERSION_FORM,
  mode: "range",
  min: "2",
  max: "10",
  terms: "Pay every week.",
  ...over,
});

describe("validateVersionForm: fixed amount", () => {
  it("accepts a fixed amount and clears the range columns", () => {
    const r = validateVersionForm(fixed({ durationWeeks: "52" }));
    expect(r).toEqual({
      ok: true,
      value: {
        contribution_amount: "5.00",
        min_amount: null,
        max_amount: null,
        duration_weeks: 52,
        terms_text: "Pay every week.",
      },
    });
  });
  it("ignores leftover range text when the mode is fixed", () => {
    const r = validateVersionForm(fixed({ min: "99", max: "1" }));
    expect(r.ok).toBe(true);
  });
  it("lets a draft have no amount yet", () => {
    const r = validateVersionForm(fixed({ amount: "" }));
    expect(r.ok && r.value.contribution_amount).toBe(null);
  });
  it("rejects zero, three decimals and words", () => {
    for (const bad of ["0", "5.123", "five", "-3"]) {
      const r = validateVersionForm(fixed({ amount: bad }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.amount).toBeTruthy();
    }
  });
});

describe("validateVersionForm: range", () => {
  it("accepts a lowest and highest amount and clears the fixed column", () => {
    const r = validateVersionForm(range());
    expect(r.ok && r.value).toMatchObject({
      contribution_amount: null,
      min_amount: "2.00",
      max_amount: "10.00",
    });
  });
  it("accepts equal lowest and highest", () => {
    expect(validateVersionForm(range({ min: "5", max: "5" })).ok).toBe(true);
  });
  it("rejects highest below lowest", () => {
    const r = validateVersionForm(range({ min: "10", max: "2" }));
    expect(!r.ok && r.errors.max).toMatch(/at least/);
  });
  it("needs both ends or neither", () => {
    const onlyMin = validateVersionForm(range({ max: "" }));
    expect(!onlyMin.ok && onlyMin.errors.max).toBeTruthy();
    const onlyMax = validateVersionForm(range({ min: "" }));
    expect(!onlyMax.ok && onlyMax.errors.min).toBeTruthy();
    expect(validateVersionForm(range({ min: "", max: "" })).ok).toBe(true);
  });
  it("does not compare amounts as floating point numbers", () => {
    expect(validateVersionForm(range({ min: "0.10", max: "0.30" })).ok).toBe(true);
  });
});

describe("validateVersionForm: duration and terms", () => {
  it("treats an empty duration as no end date", () => {
    const r = validateVersionForm(fixed({ durationWeeks: "  " }));
    expect(r.ok && r.value.duration_weeks).toBe(null);
  });
  it("rejects decimals, zero, text and absurd lengths", () => {
    for (const bad of ["1.5", "0", "abc", "-4", "521"]) {
      const r = validateVersionForm(fixed({ durationWeeks: bad }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.durationWeeks).toBeTruthy();
    }
  });
  it("trims the terms and caps their length", () => {
    const r = validateVersionForm(fixed({ terms: "  hello  " }));
    expect(r.ok && r.value.terms_text).toBe("hello");
    const long = validateVersionForm(fixed({ terms: "x".repeat(5001) }));
    expect(!long.ok && long.errors.terms).toBeTruthy();
  });
  it("reports every problem at once", () => {
    const r = validateVersionForm(fixed({ amount: "x", durationWeeks: "y" }));
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["amount", "durationWeeks"]);
  });
});

describe("plan name and description", () => {
  it("checks the name length", () => {
    expect(validatePlanName("A")).toBeTruthy();
    expect(validatePlanName("   ")).toBeTruthy();
    expect(validatePlanName("Weekly Saver")).toBeNull();
    expect(validatePlanName("x".repeat(81))).toBeTruthy();
  });
  it("checks the description length", () => {
    expect(validatePlanDescription("")).toBeNull();
    expect(validatePlanDescription("x".repeat(501))).toBeTruthy();
  });
});

describe("activationProblems", () => {
  const ready = {
    planName: "Weekly Saver",
    contributionAmount: "5.00",
    minAmount: null,
    maxAmount: null,
    termsText: "Approved terms.",
  };
  it("passes a complete fixed plan", () => {
    expect(activationProblems(ready)).toEqual([]);
  });
  it("passes a complete range plan", () => {
    expect(
      activationProblems({
        ...ready,
        contributionAmount: null,
        minAmount: "2.00",
        maxAmount: "10.00",
      }),
    ).toEqual([]);
  });
  it("blocks a plan with no amount", () => {
    const p = activationProblems({ ...ready, contributionAmount: null });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/amount/);
  });
  it("blocks half a range", () => {
    const p = activationProblems({
      ...ready,
      contributionAmount: null,
      minAmount: "2.00",
      maxAmount: null,
    });
    expect(p).toHaveLength(1);
  });
  it("blocks empty terms", () => {
    expect(activationProblems({ ...ready, termsText: "   " })).toHaveLength(1);
  });
  it("blocks the seeded placeholder text and name", () => {
    const p = activationProblems({
      ...ready,
      planName: "Sample Plan A (PLACEHOLDER)",
      termsText: "PLACEHOLDER TERMS. To be replaced after owner approval.",
    });
    expect(p).toHaveLength(2);
  });
});

describe("nextVersionNumber", () => {
  it("starts at 1 and goes one past the highest", () => {
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([1, 2, 5])).toBe(6);
  });
});

describe("display helpers", () => {
  const base = { currency: "USD", frequency: "weekly" };
  it("describes a fixed amount", () => {
    expect(
      describeAmount({ ...base, contributionAmount: "5.00", minAmount: null, maxAmount: null }),
    ).toBe("$5.00 per week");
  });
  it("describes a range", () => {
    expect(
      describeAmount({ ...base, contributionAmount: null, minAmount: "2.00", maxAmount: "10.00" }),
    ).toBe("$2.00 to $10.00 per week");
  });
  it("says when the amount is not set", () => {
    expect(
      describeAmount({ ...base, contributionAmount: null, minAmount: null, maxAmount: null }),
    ).toBe("Amount not set");
  });
  it("describes durations", () => {
    expect(describeDuration(null)).toBe("No end date");
    expect(describeDuration(1)).toBe("1 week");
    expect(describeDuration(52)).toBe("52 weeks");
  });
});

describe("describePlanAmount", () => {
  const base = { currency: "USD", frequency: "weekly" };
  it("describes the member-facing plan shape", () => {
    expect(
      describePlanAmount({ ...base, amount: "5.00", minAmount: null, maxAmount: null }),
    ).toBe("$5.00 per week");
    expect(
      describePlanAmount({ ...base, amount: null, minAmount: "2.00", maxAmount: "10.00" }),
    ).toBe("$2.00 to $10.00 per week");
  });
});

describe("versionToFormInput", () => {
  it("round-trips a fixed version", () => {
    const form = versionToFormInput({
      contributionAmount: "5.00",
      minAmount: null,
      maxAmount: null,
      durationWeeks: 52,
      termsText: "T",
    });
    expect(form).toEqual({
      mode: "fixed",
      amount: "5.00",
      min: "",
      max: "",
      durationWeeks: "52",
      terms: "T",
    });
  });
  it("opens a range version in range mode", () => {
    const form = versionToFormInput({
      contributionAmount: null,
      minAmount: "2.00",
      maxAmount: "10.00",
      durationWeeks: null,
      termsText: "",
    });
    expect(form.mode).toBe("range");
    expect(form.durationWeeks).toBe("");
  });
  it("opens an empty draft in fixed mode", () => {
    const form = versionToFormInput({
      contributionAmount: null,
      minAmount: null,
      maxAmount: null,
      durationWeeks: null,
      termsText: "",
    });
    expect(form.mode).toBe("fixed");
  });
});
