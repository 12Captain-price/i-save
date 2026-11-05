import { Quote } from "lucide-react";
import { Stars } from "@/components/site/StarRating";
import type { Review } from "@/lib/reviews";

/** One approved review as a card, shown on the home page and the Reviews page. */
export function ReviewCard({ review }: { review: Review }) {
  const initials = review.author_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <figure className="lift-card relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-portal-accent to-portal-warm"
      />
      <Quote
        aria-hidden="true"
        className="absolute top-5 right-5 size-12 text-primary/10"
      />
      <Stars rating={review.rating} />
      <blockquote className="mt-4 flex-1 text-[0.95rem] leading-relaxed text-card-foreground">
        “{review.body}”
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-2 ring-primary/20"
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
