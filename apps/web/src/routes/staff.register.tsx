import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { CheckField, Field, inputClass } from "@/components/ui/field";
import { CATEGORY_OPTIONS, fieldErrors } from "@/lib/apply-schema";
import { RegisterError, registerApplicant } from "@/lib/register-member";
import {
  registerApplicantSchema,
  type RegisterApplicantResult,
} from "@/lib/register-schema";

export const Route = createFileRoute("/staff/register")({
  component: RegisterApplicantPage,
});

type Values = {
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  categoryInterest: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
};

const EMPTY: Values = {
  fullName: "",
  email: "",
  phone: "",
  nationalId: "",
  categoryInterest: "",
  ageConfirmed: false,
  termsAccepted: false,
};

function RegisterApplicantPage() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    name: string;
    email: string;
    result: RegisterApplicantResult;
  } | null>(null);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setFormError(null);
    const parsed = registerApplicantSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await registerApplicant(parsed.data);
      setDone({ name: parsed.data.fullName, email: parsed.data.email, result });
      setValues(EMPTY);
    } catch (error) {
      if (error instanceof RegisterError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const { result } = done;
    return (
      <div className="max-w-xl">
        <h1 className="text-3xl font-semibold md:text-4xl">
          Applicant registered
        </h1>
        <p role="status" className="mt-4">
          {done.name} is now registered as{" "}
          <strong>{result.memberNumber ?? "a new member"}</strong> and is
          waiting for activation.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          {result.emailSent ? (
            <li>
              A link to choose a password was emailed to {done.email}. Ask them
              to check their spam folder if it does not arrive.
            </li>
          ) : (
            <li role="alert" className="text-destructive">
              The account was created, but the password email did not send. The
              member can use “Forgot password” on the sign-in page to get a
              link.
            </li>
          )}
          {!result.auditLogged && (
            <li role="alert" className="text-destructive">
              The registration was not written to the audit log. Tell an
              administrator.
            </li>
          )}
          <li>
            Next: open the member, check their ID document and mark it as
            sighted, then record the registration fee.
          </li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          {result.memberId && (
            <Link
              to="/staff/members/$memberId"
              params={{ memberId: result.memberId }}
              className={buttonVariants()}
            >
              Open this member
            </Link>
          )}
          <Button variant="outline" onClick={() => setDone(null)}>
            Register another applicant
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-semibold md:text-4xl">
        Register an applicant
      </h1>
      <p className="mt-3 text-muted-foreground">
        For people applying in the office. They will get an email to choose
        their own password, so an email address is needed. The account starts as
        waiting for activation, like an online application.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
        <Field
          id="fullName"
          label="Full name"
          hint="As it appears on their national ID."
          autoComplete="off"
          value={values.fullName}
          error={errors.fullName}
          onChange={(e) => set("fullName", e.target.value)}
        />
        <Field
          id="email"
          label="Email address"
          type="email"
          autoComplete="off"
          value={values.email}
          error={errors.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <Field
          id="phone"
          label="Phone number"
          type="tel"
          hint="For example 0771234567."
          autoComplete="off"
          value={values.phone}
          error={errors.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
        <Field
          id="nationalId"
          label="National ID number"
          hint="Copy it from the document in front of you."
          autoComplete="off"
          value={values.nationalId}
          error={errors.nationalId}
          onChange={(e) => set("nationalId", e.target.value)}
        />
        <div>
          <label
            htmlFor="categoryInterest"
            className="mb-1.5 block text-sm font-medium"
          >
            Savings interest (optional)
          </label>
          <select
            id="categoryInterest"
            name="categoryInterest"
            className={inputClass}
            value={values.categoryInterest}
            onChange={(e) => set("categoryInterest", e.target.value)}
          >
            <option value="">No preference yet</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            This only shows their interest. It does not enrol them in a plan.
          </p>
        </div>
        <CheckField
          id="ageConfirmed"
          checked={values.ageConfirmed}
          error={errors.ageConfirmed}
          onChange={(checked) => set("ageConfirmed", checked)}
        >
          I have seen their ID and they are 18 years old or older.
        </CheckField>
        <CheckField
          id="termsAccepted"
          checked={values.termsAccepted}
          error={errors.termsAccepted}
          onChange={(checked) => set("termsAccepted", checked)}
        >
          They have read and accepted the{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            Privacy notice
          </a>
          .
        </CheckField>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Registering…" : "Register applicant"}
          </Button>
          <Link
            to="/staff"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
