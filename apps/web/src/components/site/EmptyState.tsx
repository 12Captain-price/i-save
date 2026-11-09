import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A friendly "nothing here yet" box, instead of one grey line of text. */
export function EmptyState({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary [&_svg]:size-6"
      >
        {icon}
      </span>
      <p className="text-lg font-semibold">{title}</p>
      {children && (
        <p className="max-w-md text-sm text-muted-foreground">{children}</p>
      )}
    </div>
  );
}
