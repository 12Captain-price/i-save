import { useState } from "react";
import { MediaThumb } from "@/components/site/MediaThumb";
import { MediaViewer } from "@/components/site/MediaViewer";
import type { SiteEvent } from "@/lib/content";
import { MEDIA_LABEL } from "@/lib/event-media";

/** Every picture, video and flier of an event. Tapping one opens the viewer. */
export function EventGallery({
  event,
  initialOpenId,
}: {
  event: SiteEvent;
  /** A file to open straight away, used when someone follows a shared link. */
  initialOpenId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const index = openId ? event.images.findIndex((m) => m.id === openId) : -1;

  if (event.images.length === 0) return null;

  return (
    <>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {event.images.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setOpenId(m.id)}
              aria-label={`Open ${MEDIA_LABEL[m.media_type].toLowerCase()}${m.caption ? `: ${m.caption}` : ""}`}
              className="group zoom-photo block w-full cursor-zoom-in overflow-hidden rounded-md border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <MediaThumb item={m} className="aspect-[4/3] w-full" />
            </button>
            {m.caption && (
              <p className="mt-2 text-xs text-muted-foreground">{m.caption}</p>
            )}
          </li>
        ))}
      </ul>
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
    </>
  );
}
