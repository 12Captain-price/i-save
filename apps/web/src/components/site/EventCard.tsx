import { Link } from "@tanstack/react-router";
import { Photo } from "@/components/site/Photo";
import type { SiteEvent } from "@/lib/content";
import { formatDate } from "@/lib/staff-utils";

export function EventCard({ event }: { event: SiteEvent }) {
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className="group block overflow-hidden rounded-md border border-border bg-card"
    >
      <Photo
        path={event.images[0]?.path ?? null}
        alt=""
        className="aspect-[16/10] w-full"
      />
      <div className="p-5">
        <p className="text-xs text-muted-foreground">
          {formatDate(event.event_date)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        <h2 className="mt-1 text-lg font-semibold group-hover:underline">
          {event.title}
        </h2>
        {event.summary && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {event.summary}
          </p>
        )}
      </div>
    </Link>
  );
}
