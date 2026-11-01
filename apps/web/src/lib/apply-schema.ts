import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

// The five interest categories. An interest is not an enrolment in any plan.
export const CATEGORY_OPTIONS = [
  { id: "asset", label: "Asset" },
  { id: "holiday", label: "Holiday" },
  { id: "emergency", label: "Emergency" },
  { id: "retrenchment", label: "Retrenchment" },
  { id: "education", label: "Education" },
] as const;

/** Same clean-up the database does: letters and digits only, upper case. */
export function normalizeNationalId(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Fields shared by the online application and the office registration form. */
export const applicantFields = {
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name as it appears on your national ID.")
    .max(120, "That name is too long."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().transform((value, ctx) => {
    const result = normalizePhone(value);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
      return z.NEVER;
    }
    return result.value;
  }),
  nationalId: z
    .string()
    .transform(normalizeNationalId)
    .pipe(
      z
        .string()
        .min(6, "Enter your national ID number.")
        .max(20, "That ID number is too long."),
    ),
  categoryInterest: z
    .string()
    .refine(
      (value) =>
        value === "" || CATEGORY_OPTIONS.some((option) => option.id === value),
      "Choose one of the listed categories.",
    ),
  ageConfirmed: z.literal(true, {
    errorMap: () => ({
      message: "You must confirm that you are 18 or older.",
    }),
  }),
  termsAccepted: z.literal(true, {
    errorMap: () => ({
      message: "You must accept the Terms and Privacy notice.",
    }),
  }),
};

export const applySchema = z
  .object({
    ...applicantFields,
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Use at most 72 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match.",
  });

export type ApplyInput = z.input<typeof applySchema>;
export type ApplyOutput = z.output<typeof applySchema>;

/** First error message for each field, ready to show under the inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
