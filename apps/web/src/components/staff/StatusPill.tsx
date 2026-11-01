import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  pending: "text-portal-warm",
  active: "text-primary",
  suspended: "text-destructive",
  closed: "text-destructive",
  reversed: "text-destructive",
  overdue: "text-destructive",
  open: "text-portal-warm",
};

/** Small label with colour AND words, so status never relies on colour alone. */
export function StatusPill({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/30 px-2.5 py-0.5 text-xs font-semibold capitalize",
        TONES[status] ?? "text-muted-foreground",
      )}
    >
      {label ?? status}
    </span>
  );
}
