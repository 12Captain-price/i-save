import { LoadingSkeleton } from "@/components/ui/motion";
import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AdminOnly } from "@/components/staff/AdminOnly";
import { ErrorLine, PageHeading } from "@/components/staff/FormBits";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { fieldErrors } from "@/lib/apply-schema";
import { useAuth } from "@/lib/auth";
import {
  CreateStaffError,
  createStaffAccount,
  useStaffAccounts,
} from "@/lib/staff-accounts";
import {
  STAFF_ROLES,
  createStaffSchema,
  type CreateStaffResult,
} from "@/lib/staff-account-schema";

export const Route = createFileRoute("/staff/accounts")({
  component: () => (
    <AdminOnly title="Staff accounts">
      <StaffAccountsPage />
    </AdminOnly>
  ),
});

const ROLE_LABEL: Record<string, string> = {
  finance: "Staff",
  admin: "Administrator",
  super_admin: "Super administrator",
};

function StaffAccountsPage() {
  const { realAdmin } = useAuth();
  const list = useStaffAccounts();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "finance",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    name: string;
    email: string;
    result: CreateStaffResult;
  } | null>(null);

  // Only real administrators can create another administrator.
  const roleOptions = STAFF_ROLES.filter(
    (r) => realAdmin || r.id === "finance",
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    setDone(null);
    const parsed = createStaffSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await createStaffAccount(parsed.data);
      setDone({ name: parsed.data.fullName, email: parsed.data.email, result });
      setValues({ fullName: "", email: "", phone: "", role: "finance" });
      await queryClient.invalidateQueries({ queryKey: ["staff", "accounts"] });
    } catch (err) {
      if (err instanceof CreateStaffError) {
        setFormError(err.message);
        setErrors(err.fieldErrors);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeading
        title="Staff accounts"
        lead="Create sign-in accounts for new office staff. They get an email to set their own password. Every account created is recorded in the audit log."
      />

      <form
        onSubmit={submit}
        className="mt-6 grid max-w-xl gap-4 rounded-md border border-border p-5"
        noValidate
      >
        <h2 className="text-lg font-semibold">Add a staff member</h2>
        <Field
          id="sa-name"
          label="Full name"
          value={values.fullName}
          error={errors.fullName}
          onChange={(e) => setValues({ ...values, fullName: e.target.value })}
        />
        <Field
          id="sa-email"
          label="Email address"
          type="email"
          value={values.email}
          error={errors.email}
          hint="Their login. The set-password link is sent here."
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
        <Field
          id="sa-phone"
          label="Phone number"
          value={values.phone}
          error={errors.phone}
          hint="For example 0771234567"
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
        <div>
          <label htmlFor="sa-role" className="mb-1.5 block text-sm font-medium">
            Role
          </label>
          <select
            id="sa-role"
            className={inputClass}
            value={values.role}
            onChange={(e) => setValues({ ...values, role: e.target.value })}
          >
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {!realAdmin && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              In admin mode you can create staff accounts. Only administrators
              can create other administrators.
            </p>
          )}
          {errors.role && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {errors.role}
            </p>
          )}
        </div>
        <ErrorLine message={formError} />
        {done && (
          <p
            role="status"
            className="rounded-md border border-border bg-card p-3 text-sm"
          >
            {done.name} can now sign in.{" "}
            {done.result.emailSent
              ? `A link to set their password was emailed to ${done.email}.`
              : `The account was created, but the email did not send. Ask them to use “Forgot password” on the login page with ${done.email}.`}
          </p>
        )}
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
        </div>
      </form>

      <h2 className="mt-12 text-lg font-semibold">Current staff</h2>
      {list.isPending && <LoadingSkeleton />}
      {list.isError && (
        <ErrorLine message="The staff list could not be loaded." />
      )}
      {list.data && (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {list.data.map((s) => (
            <li
              key={s.userId}
              className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
            >
              <div>
                <p className="font-medium">{s.fullName || "(no name)"}</p>
                <p className="text-xs text-muted-foreground">
                  {s.email}
                  {s.phone ? ` · ${s.phone}` : ""}
                </p>
              </div>
              <p className="text-xs font-semibold text-muted-foreground">
                {s.roles.map((r) => ROLE_LABEL[r]).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
