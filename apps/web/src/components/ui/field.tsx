import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive";

/** Label, input, optional hint and error, wired together for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  ...inputProps
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint ? id + "-hint" : null, error ? id + "-error" : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className={cn(inputClass, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && (
        <p id={id + "-hint"} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={id + "-error"}
          role="alert"
          className="mt-1.5 text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckField({
  id,
  error,
  checked,
  onChange,
  children,
}: {
  id: string;
  error?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-3 text-sm">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? id + "-error" : undefined}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p
          id={id + "-error"}
          role="alert"
          className="mt-1.5 ml-7 text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
