import type { ReactNode } from "react";

/** Colours for charts. They come from the theme so the charts follow it. */
export const CHART_COLORS = {
  savings: "var(--primary)",
  registration: "var(--portal-warm)",
  subscription: "oklch(0.78 0.1 230)",
  neutral: "oklch(0.62 0.03 225)",
  warn: "var(--destructive)",
} as const;

export function ChartCard({
  id,
  title,
  subtitle,
  action,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-border bg-card p-5 md:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Legend({
  items,
  hidden,
  onToggle,
}: {
  items: { key: string; label: string; color: string }[];
  hidden?: Set<string>;
  onToggle?: (key: string) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map((i) => {
        const off = hidden?.has(i.key) ?? false;
        const body = (
          <>
            <span
              aria-hidden
              className="size-2.5 rounded-sm"
              style={{
                background: off ? "transparent" : i.color,
                border: `1.5px solid ${i.color}`,
              }}
            />
            <span className={off ? "text-muted-foreground line-through" : ""}>
              {i.label}
            </span>
          </>
        );
        return (
          <li key={i.key}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={!off}
                onClick={() => onToggle(i.key)}
                className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded px-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {body}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

/** A small segmented control, for example 6 or 12 months. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border border-border p-0.5"
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={
            "min-h-8 cursor-pointer rounded px-2.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none " +
            (o.value === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
