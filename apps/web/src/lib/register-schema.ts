import { z } from "zod";
import { applicantFields } from "@/lib/apply-schema";

// What staff type when registering an applicant in the office. The same field rules as the
// online application, minus the password: the member sets their own through an emailed
// link. The Worker imports this file too, so the screen and the server can never disagree.
export const registerApplicantSchema = z.object({
  ...applicantFields,
  // Staff attest on the member's behalf, so the wording differs from the online form.
  ageConfirmed: z.literal(true, {
    errorMap: () => ({
      message: "Confirm that the applicant is 18 or older.",
    }),
  }),
  termsAccepted: z.literal(true, {
    errorMap: () => ({
      message:
        "Confirm that the applicant accepted the Terms and Privacy notice.",
    }),
  }),
});

export type RegisterApplicantInput = z.input<typeof registerApplicantSchema>;
export type RegisterApplicantOutput = z.output<typeof registerApplicantSchema>;

/**
 * What the Worker sends back. `emailSent: false` means the account exists but the link did
 * not go out; `auditLogged: false` means the audit row did not save. Staff are told either way.
 */
export type RegisterApplicantResult = {
  memberId: string;
  memberNumber: string | null;
  emailSent: boolean;
  auditLogged: boolean;
};
