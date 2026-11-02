import { z } from "zod";
import { applicantFields } from "@/lib/apply-schema";

// What an administrator types to create a staff account. The Worker imports this file too,
// so the screen and the server can never disagree.
export const STAFF_ROLES = [
  { id: "finance", label: "Staff (records payments, checks IDs)" },
  {
    id: "admin",
    label: "Administrator (also manages plans, content and staff)",
  },
] as const;

export const createStaffSchema = z.object({
  fullName: applicantFields.fullName,
  email: applicantFields.email,
  phone: applicantFields.phone,
  role: z.enum(["finance", "admin"], {
    errorMap: () => ({ message: "Choose a role." }),
  }),
});

export type CreateStaffInput = z.input<typeof createStaffSchema>;
export type CreateStaffOutput = z.output<typeof createStaffSchema>;

/** `emailSent: false` means the account exists but the set-password link did not go out. */
export type CreateStaffResult = {
  userId: string;
  emailSent: boolean;
};
