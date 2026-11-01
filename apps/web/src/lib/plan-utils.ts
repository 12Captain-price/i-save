// Pure helpers for the admin plan screen. Nothing in here talks to Supabase, so it can be
// unit tested without environment variables.
import { compareMoney, formatMoney, parseAmountInput, type Money } from "@/lib/money";

export type AmountMode = "fixed" | "range";

/** What the admin typed into the version form. Everything is text, exactly as typed. */
export type VersionFormInput = {
  mode: AmountMode;
  amount: string;
  min: string;
  max: string;
  durationWeeks: string;
  terms: string;
};

/** What gets written to savings_plan_versions. Unused amount columns are null. */
export type VersionValues = {
  contribution_amount: Money | null;
  min_amount: Money | null;
  max_amount: Money | null;
  duration_weeks: number | null;
  terms_text: string;
};

export type VersionFormErrors = Partial<
  Record<"amount" | "min" | "max" | "durationWeeks" | "terms", string>
>;

export type VersionFormResult =
  | { ok: true; value: VersionValues }
  | { ok: false; errors: VersionFormErrors };

export const MAX_DURATION_WEEKS = 520; // ten years
export const MAX_TERMS_LENGTH = 5000;

export const EMPTY_VERSION_FORM: VersionFormInput = {
  mode: "fixed",
  amount: "",
  min: "",
  max: "",
  durationWeeks: "",
  terms: "",
};

/**
 * Checks a DRAFT. A draft may still be missing its amount (the owner may not have approved
 * one yet), but anything that IS entered must be valid. Whether a draft is complete enough
 * to go live is decided separately by `activationProblems`.
 */
export function validateVersionForm(input: VersionFormInput): VersionFormResult {
  const errors: VersionFormErrors = {};
  let contribution: Money | null = null;
  let min: Money | null = null;
  let max: Money | null = null;

  if (input.mode === "fixed") {
    if (input.amount.trim() !== "") {
      const parsed = parseAmountInput(input.amount);
      if (parsed.ok) contribution = parsed.value;
      else errors.amount = parsed.message;
    }
  } else {
    const hasMin = input.min.trim() !== "";
    const hasMax = input.max.trim() !== "";
    if (hasMin) {
      const parsed = parseAmountInput(input.min);
      if (parsed.ok) min = parsed.value;
      else errors.min = parsed.message;
    }
    if (hasMax) {
      const parsed = parseAmountInput(input.max);
      if (parsed.ok) max = parsed.value;
      else errors.max = parsed.message;
    }
    if (hasMin !== hasMax) {
      const message = "Enter both the lowest and the highest amount, or leave both empty.";
      if (!hasMin && !errors.min) errors.min = message;
      if (!hasMax && !errors.max) errors.max = message;
    }
    if (min && max && compareMoney(min, max) === 1) {
      errors.max = "The highest amount must be at least the lowest amount.";
    }
  }

  let duration: number | null = null;
  const durationText = input.durationWeeks.trim();
  if (durationText !== "") {
    if (!/^\d+$/.test(durationText)) {
      errors.durationWeeks = "Use a whole number of weeks, or leave empty for no end date.";
    } else {
      const weeks = Number(durationText);
      if (weeks < 1 || weeks > MAX_DURATION_WEEKS) {
        errors.durationWeeks = `Use between 1 and ${MAX_DURATION_WEEKS} weeks, or leave empty for no end date.`;
      } else {
        duration = weeks;
      }
    }
  }

  const terms = input.terms.trim();
  if (terms.length > MAX_TERMS_LENGTH) {
    errors.terms = `Keep the terms under ${MAX_TERMS_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      contribution_amount: contribution,
      min_amount: min,
      max_amount: max,
      duration_weeks: duration,
      terms_text: terms,
    },
  };
}

export function validatePlanName(input: string): string | null {
  const name = input.trim();
  if (name.length < 2) return "Give the plan a name (at least 2 characters).";
  if (name.length > 80) return "Keep the name under 80 characters.";
  return null;
}

export function validatePlanDescription(input: string): string | null {
  if (input.trim().length > 500) return "Keep the description under 500 characters.";
  return null;
}

/** The fields of a saved version that decide whether it can go live. */
export type ActivationCandidate = {
  planName: string;
  contributionAmount: Money | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  termsText: string;
};

const PLACEHOLDER = /placeholder/i;

/**
 * Reasons a draft cannot be activated yet. An empty list means it can. The database already
 * refuses an active plan with no approved amount; this just says why in plain words, and also
 * blocks the seeded sample text from ever going live.
 */
export function activationProblems(candidate: ActivationCandidate): string[] {
  const problems: string[] = [];
  const hasFixed = candidate.contributionAmount !== null;
  const hasRange = candidate.minAmount !== null && candidate.maxAmount !== null;
  if (!hasFixed && !hasRange) {
    problems.push("Add the amount the owner approved (a fixed amount, or a lowest and highest amount).");
  }
  if (candidate.termsText.trim() === "") {
    problems.push("Add the plan terms that members will be asked to accept.");
  } else if (PLACEHOLDER.test(candidate.termsText)) {
    problems.push("The terms still contain placeholder text. Replace it with the approved terms.");
  }
  if (PLACEHOLDER.test(candidate.planName)) {
    problems.push("The plan name still says PLACEHOLDER. Rename the plan before it goes live.");
  }
  return problems;
}

/** The next version number for a plan: one more than the highest that exists. */
export function nextVersionNumber(versionNumbers: number[]): number {
  return versionNumbers.length === 0 ? 1 : Math.max(...versionNumbers) + 1;
}

type AmountFields = {
  contributionAmount: Money | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  currency: string;
  frequency: string;
};

const PER: Record<string, string> = {
  daily: "per day",
  weekly: "per week",
  monthly: "per month",
};

/** For example "$5.00 per week", "$2.00 to $10.00 per week" or "Amount not set". */
export function describeAmount(v: AmountFields): string {
  const per = PER[v.frequency] ?? "per payment";
  if (v.contributionAmount !== null) {
    return `${formatMoney(v.contributionAmount, v.currency)} ${per}`;
  }
  if (v.minAmount !== null && v.maxAmount !== null) {
    return `${formatMoney(v.minAmount, v.currency)} to ${formatMoney(v.maxAmount, v.currency)} ${per}`;
  }
  return "Amount not set";
}

/** Same wording as `describeAmount`, for the member-facing plan shape (amount, not contributionAmount). */
export function describePlanAmount(plan: {
  amount: Money | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  currency: string;
  frequency: string;
}): string {
  return describeAmount({ ...plan, contributionAmount: plan.amount });
}

export function describeDuration(weeks: number | null): string {
  if (weeks === null) return "No end date";
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}

/** Turns a saved version back into form text, for editing or for starting a new version. */
export function versionToFormInput(v: {
  contributionAmount: Money | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  durationWeeks: number | null;
  termsText: string;
}): VersionFormInput {
  const isRange =
    v.contributionAmount === null && (v.minAmount !== null || v.maxAmount !== null);
  return {
    mode: isRange ? "range" : "fixed",
    amount: v.contributionAmount ?? "",
    min: v.minAmount ?? "",
    max: v.maxAmount ?? "",
    durationWeeks: v.durationWeeks === null ? "" : String(v.durationWeeks),
    terms: v.termsText,
  };
}
