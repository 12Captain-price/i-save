import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MediaThumb } from "@/components/site/MediaThumb";
import { MediaViewer } from "@/components/site/MediaViewer";
import { Photo } from "@/components/site/Photo";
import type { SiteEvent } from "@/lib/content";
import { MEDIA_LABEL } from "@/lib/event-media";
import { formatDate } from "@/lib/staff-utils";

/**
 * One event on the list. Tapping the picture (or video, or flier) opens it in the viewer
 * right here; the title and text go to the event's own page.
 */
export function EventCard({ event }: { event: SiteEvent }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Prefer a picture as the cover; otherwise show the first video or PDF.
  const cover =
    event.images.find((m) => m.media_type === "image") ?? event.images[0];
  const index = openId ? event.images.findIndex((m) => m.id === openId) : -1;

  return (
    <div className="zoom-photo flex h-full flex-col overflow-hidden rounded-md border border-border bg-card">
      {cover ? (
        <button
          type="button"
          onClick={() => setOpenId(cover.id)}
          aria-label={`Open ${MEDIA_LABEL[cover.media_type].toLowerCase()}: ${event.title}`}
          className="block w-full cursor-zoom-in focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <MediaThumb item={cover} className="aspect-[16/10] w-full" />
        </button>
      ) : (
        <Photo path={null} alt="" className="aspect-[16/10] w-full" />
      )}

      <Link
        to="/events/$eventId"
        params={{ eventId: event.id }}
        className="group block flex-1 p-5"
      >
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
        <span className="mt-3 inline-block text-xs font-semibold text-primary">
          View details →
        </span>
      </Link>

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
