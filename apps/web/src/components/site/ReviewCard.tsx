import { Quote } from "lucide-react";
import { Stars } from "@/components/site/StarRating";
import type { Review } from "@/lib/reviews";

/** One approved review, shown on the home page and the Reviews page. */
export function ReviewCard({ review }: { review: Review }) {
  const initials = review.author_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <figure className="lift-card flex h-full flex-col rounded-md border border-border bg-card p-5">
      <Quote className="size-6 text-primary/60" aria-hidden="true" />
      <Stars rating={review.rating} className="mt-3" />
      <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-card-foreground">
        {review.body}
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
        >
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {review.author_name}
          </span>
          {review.author_title && (
            <span className="block truncate text-xs text-muted-foreground">
              {review.author_title}
            </span>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
