import { useState, type ReactNode } from "react";
import { MediaThumb } from "@/components/site/MediaThumb";
import { MediaViewer } from "@/components/site/MediaViewer";
import type { SiteEvent } from "@/lib/content";
import { MEDIA_LABEL } from "@/lib/event-media";

/**
 * The media of an event page: a large cover on top, then (as `children`) the event text, then
 * the rest of the pictures, videos and fliers as a swipeable strip. Tapping any of them opens
 * the viewer. With no media at all, only the children are shown.
 */
export function EventGallery({
  event,
  initialOpenId,
  children,
}: {
  event: SiteEvent;
  /** A file to open straight away, used when someone follows a shared link. */
  initialOpenId?: string;
  /** Shown between the cover and the strip. */
  children?: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const items = event.images;
  const index = openId ? items.findIndex((m) => m.id === openId) : -1;

  if (items.length === 0) return <>{children}</>;

  const cover = items.find((m) => m.media_type === "image") ?? items[0];
  const rest = items.filter((m) => m.id !== cover.id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenId(cover.id)}
        aria-label={`Open ${MEDIA_LABEL[cover.media_type].toLowerCase()}${cover.caption ? `: ${cover.caption}` : ""}`}
        className="zoom-photo mb-6 block w-full cursor-zoom-in overflow-hidden rounded-md border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <MediaThumb
          item={cover}
          backdrop
          className="aspect-[4/3] max-h-[34rem] w-full sm:aspect-[16/9]"
        />
      </button>
      {cover.caption && (
        <p className="-mt-4 mb-6 text-xs text-muted-foreground">
          {cover.caption}
        </p>
      )}

      {children}

      {rest.length > 0 && (
        <section aria-label="More pictures and files" className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">
            More from this event
          </h2>
          <ul className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-3">
            {rest.map((m) => (
              <li key={m.id} className="w-44 shrink-0 snap-start sm:w-52">
                <button
                  type="button"
                  onClick={() => setOpenId(m.id)}
                  aria-label={`Open ${MEDIA_LABEL[m.media_type].toLowerCase()}${m.caption ? `: ${m.caption}` : ""}`}
                  className="zoom-photo block w-full cursor-zoom-in overflow-hidden rounded-md border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <MediaThumb item={m} className="aspect-[4/3] w-full" />
                </button>
                {m.caption && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {m.caption}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {index >= 0 && (
        <MediaViewer
          items={items}
          index={index}
          title={event.title}
          shareUrl={(m) =>
            `${window.location.origin}/events/${event.id}?m=${m.id}`
          }
          onIndexChange={(i) => setOpenId(items[i].id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
