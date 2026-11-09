import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { DateBadge } from "@/components/site/DateBadge";
import { MediaThumb } from "@/components/site/MediaThumb";
import { MediaViewer } from "@/components/site/MediaViewer";
import { Photo } from "@/components/site/Photo";
import { ShareButton } from "@/components/site/ShareButton";
import { Tag } from "@/components/site/Tags";
import type { SiteEvent } from "@/lib/content";
import { MEDIA_LABEL } from "@/lib/event-media";
import { filesLabel, isRecent, timingLabel } from "@/lib/updates";
import { cn } from "@/lib/utils";

/**
 * One event on the list. Tapping the picture (or video, or flier) opens it in the viewer
 * right here; the title and text go to the event's own page. The whole flier is shown on a
 * soft blurred backdrop (nothing is cropped), the date is a calendar tile, and small tags say
 * how soon it is (Today, In 5 days) and what is inside (Video, 3 files).
 * `featured` makes it larger, for the first card on the homepage.
 */
export function EventCard({
  event,
  featured = false,
}: {
  event: SiteEvent;
  featured?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Prefer a picture as the cover; otherwise show the first video or PDF.
  const cover =
    event.images.find((m) => m.media_type === "image") ?? event.images[0];
  const index = openId ? event.images.findIndex((m) => m.id === openId) : -1;
  const when = timingLabel(event.event_date);
  const contents = filesLabel(event.images);
  const isNew = isRecent(event.published_at);
  const coverShape = featured
    ? "aspect-[16/10] lg:aspect-auto lg:min-h-72 lg:flex-1"
    : "aspect-[16/10]";

  return (
    <div className="zoom-photo flex h-full flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className={cn("relative flex flex-col", featured && "lg:flex-1")}>
        {cover ? (
          <button
            type="button"
            onClick={() => setOpenId(cover.id)}
            aria-label={`Open ${MEDIA_LABEL[cover.media_type].toLowerCase()}: ${event.title}`}
            className={cn(
              "block w-full cursor-zoom-in focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              featured && "lg:flex lg:flex-1 lg:flex-col",
            )}
          >
            <MediaThumb
              item={cover}
              backdrop
              className={cn("w-full", coverShape)}
            />
          </button>
        ) : (
          <Photo path={null} alt="" className={cn("w-full", coverShape)} />
        )}
        <DateBadge
          day={event.event_date}
          className="pointer-events-none absolute top-2 left-2"
        />
        {(when || isNew) && (
          <div className="pointer-events-none absolute top-2 right-2 flex flex-col items-end gap-1.5">
            {when && (
              <Tag tone="soon" className="bg-background/90">
                {when}
              </Tag>
            )}
            {isNew && <Tag tone="new">New</Tag>}
          </div>
        )}
      </div>

      <Link
        to="/events/$eventId"
        params={{ eventId: event.id }}
        className="group block p-5 pb-3"
      >
        {event.location && (
          <p className="text-xs text-muted-foreground">{event.location}</p>
        )}
        <h2
          className={cn(
            "mt-1 font-semibold group-hover:underline",
            featured ? "text-xl" : "text-lg",
          )}
        >
          {event.title}
        </h2>
        {event.summary && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {event.summary}
          </p>
        )}
        <span className="mt-3 inline-block text-xs font-semibold text-primary">
          View details →
        </span>
      </Link>

      <div className="mt-auto flex items-center justify-between gap-2 px-5 pb-4">
        {contents ? <Tag>{contents}</Tag> : <span />}
        <ShareButton
          title={event.title}
          url={`${window.location.origin}/events/${event.id}`}
          iconOnly
        />
      </div>

      {index >= 0 && (
        <MediaViewer
          items={event.images}
          index={index}
          title={event.title}
          shareUrl={(m) =>
            `${window.location.origin}/events/${event.id}?m=${m.id}`
          }
          onIndexChange={(i) => setOpenId(event.images[i].id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
