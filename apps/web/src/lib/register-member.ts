import { supabase } from "@/lib/supabase";
import type {
  RegisterApplicantOutput,
  RegisterApplicantResult,
} from "@/lib/register-schema";

// Empty means "same address as the website", which is how the live site works (one Worker
// serves both). For local development, set VITE_API_URL=http://localhost:8787.
const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** An error from the Worker, with the per-field messages when there are any. */
export class RegisterError extends Error {
  fieldErrors: Record<string, string>;
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Registers an applicant in the office. The Worker re-checks everything, so this only sends
 * the staff member's sign-in token and the already-validated details.
 */
export async function registerApplicant(
  input: RegisterApplicantOutput,
): Promise<RegisterApplicantResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new RegisterError("Please sign in again.");

  let res: Response;
  try {
    res = await fetch(`${API_URL}/staff/register-member`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new RegisterError(
      "Could not reach the registration service. Check your connection and try again.",
    );
  }

  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    fieldErrors?: Record<string, string>;
    result?: RegisterApplicantResult;
  } | null;

  if (!res.ok || !body?.ok || !body.result) {
    throw new RegisterError(
      body?.error ?? "Something went wrong. Please try again.",
      body?.fieldErrors ?? {},
    );
  }
  return body.result;
}