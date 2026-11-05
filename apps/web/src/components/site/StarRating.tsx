import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only stars. The words are there for screen readers. */
export function Stars({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn(
            "size-4",
            n <= rating
              ? "fill-portal-warm text-portal-warm"
              : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

/** Pick 1 to 5 stars. Works with a keyboard because each star is a real radio button. */
export function StarPicker({
  value,
  onChange,
  idPrefix = "rating",
}: {
  value: number;
  onChange: (rating: number) => void;
  idPrefix?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Your rating</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            htmlFor={`${idPrefix}-${n}`}
            className="has-[:focus-visible]:ring-ring cursor-pointer rounded p-1 has-[:focus-visible]:ring-2"
          >
            <input
              id={`${idPrefix}-${n}`}
              type="radio"
              name={idPrefix}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <Star
              aria-hidden="true"
              className={cn(
                "size-7 transition-transform hover:scale-110",
                n <= value
                  ? "fill-portal-warm text-portal-warm"
                  : "text-muted-foreground/50",
              )}
            />
            <span className="sr-only">
              {n} star{n > 1 ? "s" : ""}
            </span>
          </label>
        ))}
        <span className="ml-2 text-sm text-muted-foreground" aria-hidden="true">
          {value} of 5
        </span>
      </div>
    </fieldset>
  );
}
