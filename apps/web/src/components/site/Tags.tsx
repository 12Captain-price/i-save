import { cn } from "@/lib/utils";

/** Small coloured label: "New", "Today", "In 5 days", "Video", "3 files". */
export function Tag({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "new" | "soon" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase",
        tone === "new" && "bg-primary text-primary-foreground",
        tone === "soon" && "bg-amber-500/20 text-amber-700 dark:text-amber-300",
        tone === "muted" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Round count shown on a menu item, e.g. 2 new announcements. */
export function CountBadge({
  text,
  label,
  className,
}: {
  text: string;
  /** Read out by screen readers, e.g. "2 new". */
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[0.65rem] leading-5 font-bold text-white",
        className,
      )}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
