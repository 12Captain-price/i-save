// Pure helpers for the staff screens. Nothing in here talks to Supabase, so it can be
// unit tested without environment variables.
import type { AppRole } from "@/lib/auth";

export type Purpose =
  "registration_fee" | "monthly_subscription" | "savings_contribution";

export const PURPOSE_LABEL: Record<Purpose, string> = {
  registration_fee: "Registration fee",
  monthly_subscription: "Monthly subscription",
  savings_contribution: "Savings contribution",
};

export function purposeLabel(purpose: string): string {
  return (
    PURPOSE_LABEL[purpose as Purpose] ??
    purpose.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function isStaffRole(roles: AppRole[]): boolean {
  return roles.some(
    (r) => r === "finance" || r === "admin" || r === "super_admin",
  );
}

export function isAdminRole(roles: AppRole[]): boolean {
  return roles.some((r) => r === "admin" || r === "super_admin");
}

/** Database errors are written for staff ("Receipt number X has already been used"), so show them as they are. */
export function staffErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim() !== ""
  ) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

/**
 * Builds the PostgREST `or` filter for the member search box, or null for an empty search.
 * Characters that would break the filter syntax are stripped first, so a search can never
 * add its own conditions.
 */
export function buildMemberSearchFilter(
  term: string,
  normalizedPhone?: string,
): string | null {
  const cleaned = term
    .replace(/[,()%*"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned === "") return null;
  const parts = [
    `full_name.ilike."%${cleaned}%"`,
    `member_number.ilike."%${cleaned}%"`,
    `email.ilike."%${cleaned}%"`,
    `phone.ilike."%${cleaned}%"`,
  ];
  if (normalizedPhone) parts.push(`phone.eq.${normalizedPhone}`);
  return parts.join(",");
}

/** Same clean-up the database applies: letters and digits only, upper case. */
export function normalizeNationalId(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function validateNationalId(input: string): string | null {
  const id = normalizeNationalId(input);
  if (id === "") return "Enter the ID number as it appears on the document.";
  if (id.length < 6 || id.length > 20) {
    return "That does not look like a valid ID number (6 to 20 letters and digits).";
  }
  return null;
}

/** Receipt book numbers: the database accepts 3 to 40 characters. */
export function validateReceiptNo(input: string): string | null {
  const value = input.trim();
  if (value.length < 3 || value.length > 40) {
    return "Enter the number from the paper receipt book (3 to 40 characters).";
  }
  return null;
}

/** A fresh key so a retried click can never record the same payment twice. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `key-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Staff work in Zimbabwe time, and the daily report is cut at midnight Africa/Harare.
const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Harare",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Harare",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const reportDay = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

/** For a plain calendar date such as "2026-11-01" (no time zone shift). */
export function formatCalendarDay(day: string): string {
  return reportDay.format(new Date(`${day}T00:00:00Z`));
}
