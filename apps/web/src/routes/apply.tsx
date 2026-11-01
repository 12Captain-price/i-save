import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/AuthCard";
import { CheckField, Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_OPTIONS,
  applySchema,
  fieldErrors,
  type ApplyInput,
} from "@/lib/apply-schema";
import { friendlySignUpError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/apply")({
  component: ApplyPage,
});

// The schema insists the two boxes are true; while typing they can be either.
type FormValues = Omit<ApplyInput, "ageConfirmed" | "termsAccepted"> & {
  ageConfirmed: boolean;
  termsAccepted: boolean;
};

const EMPTY: FormValues = {
  fullName: "",
  email: "",
  phone: "",
  nationalId: "",
  categoryInterest: "",
  password: "",
  confirmPassword: "",
  ageConfirmed: false,
  termsAccepted: false,
};

function ApplyPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = applySchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const data = parsed.data;

    setBusy(true);
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: window.location.origin + "/login",
        data: {
          full_name: data.fullName,
          phone: data.phone,
          national_id: data.nationalId,
          category_interest: data.categoryInterest,
          age_confirmed: "true",
          terms_accepted: "true",
        },
      },
    });
    setBusy(false);

    if (error) {
      setFormError(friendlySignUpError(error.message));
      return;
    }
    if (result.session) {
      await navigate({ to: "/account" });
      return;
    }
    setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <AuthCard title="Check your email">
        <div className="grid gap-4 text-sm">
          <p role="status">
            We have sent a message to{" "}
            <strong>{values.email.trim().toLowerCase()}</strong>. Open it and
            follow the link to confirm your email, then log in.
          </p>
          <p className="text-muted-foreground">
            Your application is not complete yet. To activate your account,
            visit the office with your national ID and pay the registration fee.
            Staff will check your ID and record your payment.
          </p>
          <a
            href="/login"
            className="text-primary underline underline-offset-4"
          >
            Go to log in
          </a>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      wide
      title="Apply for membership"
      lead="Fill in your details. Your account becomes active once you pay the registration fee at the office and staff have checked your national ID."
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <Field
          id="fullName"
          label="Full name"
          autoComplete="name"
          hint="As it appears on your national ID."
          value={values.fullName}
          error={errors.fullName}
          onChange={(event) => set("fullName", event.target.value)}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          hint="We use this for logging in and for reminders. The office can help you create one."
          value={values.email}
          error={errors.email}
          onChange={(event) => set("email", event.target.value)}
        />
        <Field
          id="phone"
          label="Phone number"
          type="tel"
          autoComplete="tel"
          hint="For example 077 123 4567."
          value={values.phone}
          error={errors.phone}
          onChange={(event) => set("phone", event.target.value)}
        />
        <Field
          id="nationalId"
          label="National ID number"
          autoComplete="off"
          hint="Staff will look at your physical ID in the office. We do not collect ID photos."
          value={values.nationalId}
          error={errors.nationalId}
          onChange={(event) => set("nationalId", event.target.value)}
        />
        <div>
          <label
            htmlFor="categoryInterest"
            className="mb-1.5 block text-sm font-medium"
          >
            What are you most interested in saving for? (optional)
          </label>
          <select
            id="categoryInterest"
            name="categoryInterest"
            className={inputClass}
            value={values.categoryInterest}
            onChange={(event) => set("categoryInterest", event.target.value)}
          >
            <option value="">No preference yet</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            This only shows your interest. It does not enrol you in a plan.
          </p>
        </div>
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={values.password}
          error={errors.password}
          onChange={(event) => set("password", event.target.value)}
        />
        <Field
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => set("confirmPassword", event.target.value)}
        />
        <CheckField
          id="ageConfirmed"
          checked={values.ageConfirmed}
          error={errors.ageConfirmed}
          onChange={(checked) => set("ageConfirmed", checked)}
        >
          I confirm that I am 18 years old or older.
        </CheckField>
        <CheckField
          id="termsAccepted"
          checked={values.termsAccepted}
          error={errors.termsAccepted}
          onChange={(checked) => set("termsAccepted", checked)}
        >
          I have read and accept the{" "}
          <a
            href="/terms"
            className="text-primary underline underline-offset-4"
          >
            Terms
          </a>{" "}
          and the{" "}
          <a
            href="/privacy"
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
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Sending your application…" : "Apply for membership"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Already applied?{" "}
          <a
            href="/login"
            className="text-primary underline underline-offset-4"
          >
            Log in
          </a>
          .
        </p>
      </form>
    </AuthCard>
  );
}
