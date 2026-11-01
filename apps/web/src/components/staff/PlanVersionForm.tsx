import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import {
  MAX_TERMS_LENGTH,
  validateVersionForm,
  type AmountMode,
  type VersionFormErrors,
  type VersionFormInput,
  type VersionValues,
} from "@/lib/plan-utils";
import { staffErrorMessage } from "@/lib/staff-utils";

/**
 * The amount, length and terms of one plan version. Used for a new plan, for editing a draft
 * and for starting a new version. Amounts are validated as text, so nothing is ever rounded
 * or turned into a floating point number.
 */
export function PlanVersionForm({
  idPrefix,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial: VersionFormInput;
  submitLabel: string;
  onSubmit: (values: VersionValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<VersionFormInput>(initial);
  const [errors, setErrors] = useState<VersionFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof VersionFormInput>(key: K, value: VersionFormInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    const result = validateVersionForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(result.value);
    } catch (e) {
      setServerError(staffErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div>
        <label htmlFor={id("mode")} className="mb-1.5 block text-sm font-medium">
          How much does the member pay?
        </label>
        <select
          id={id("mode")}
          value={form.mode}
          onChange={(event) => set("mode", event.target.value as AmountMode)}
          className={inputClass}
        >
          <option value="fixed">One fixed amount every week</option>
          <option value="range">Any amount between a lowest and a highest</option>
        </select>
      </div>

      {form.mode === "fixed" ? (
        <Field
          id={id("amount")}
          label="Weekly amount (US$)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="For example 5.00"
          hint="Use the amount the owner approved. Leave empty to save a draft without one."
          value={form.amount}
          onChange={(event) => set("amount", event.target.value)}
          error={errors.amount}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={id("min")}
            label="Lowest weekly amount (US$)"
            inputMode="decimal"
            autoComplete="off"
            value={form.min}
            onChange={(event) => set("min", event.target.value)}
            error={errors.min}
          />
          <Field
            id={id("max")}
            label="Highest weekly amount (US$)"
            inputMode="decimal"
            autoComplete="off"
            value={form.max}
            onChange={(event) => set("max", event.target.value)}
            error={errors.max}
          />
        </div>
      )}

      <Field
        id={id("weeks")}
        label="Length in weeks"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Leave empty for no end date"
        hint="Weekly payments are the only schedule switched on at launch."
        value={form.durationWeeks}
        onChange={(event) => set("durationWeeks", event.target.value)}
        error={errors.durationWeeks}
      />

      <div>
        <label htmlFor={id("terms")} className="mb-1.5 block text-sm font-medium">
          Plan terms
        </label>
        <textarea
          id={id("terms")}
          rows={6}
          maxLength={MAX_TERMS_LENGTH}
          value={form.terms}
          onChange={(event) => set("terms", event.target.value)}
          aria-invalid={errors.terms ? true : undefined}
          aria-describedby={id("terms-hint")}
          className={inputClass}
        />
        <p id={id("terms-hint")} className="mt-1.5 text-xs text-muted-foreground">
          Members read these and tick to accept before joining. A copy of the exact
          wording is kept with their enrolment.
        </p>
        {errors.terms && (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {errors.terms}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
