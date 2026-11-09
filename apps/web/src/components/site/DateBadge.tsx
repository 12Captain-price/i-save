import { dateParts } from "@/lib/calendar";
import { cn } from "@/lib/utils";

/** A calendar tile (month, big day number, weekday): the first thing people look for. */
export function DateBadge({
  day,
  className,
}: {
  day: string;
  className?: string;
}) {
  const p = dateParts(day);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-sm",
        className,
      )}
    >
      <span className="w-full bg-primary py-0.5 text-center text-[0.65rem] font-bold tracking-wider text-primary-foreground">
        {p.month}
      </span>
      <span className="text-2xl leading-tight font-bold">{p.day}</span>
      <span className="pb-1 text-[0.65rem] text-muted-foreground">
        {p.weekday}
      </span>
    </div>
  );
}
