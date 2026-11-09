import { useState } from "react";
import { MediaThumb } from "@/components/site/MediaThumb";
import { MediaViewer } from "@/components/site/MediaViewer";
import type { EventMedia } from "@/lib/content";
import { MEDIA_LABEL } from "@/lib/event-media";

/** Pictures, videos and fliers of an event or notice. Tapping one opens the viewer. */
export function MediaGallery({
  items,
  title,
  pageUrl,
  initialOpenId,
  columns = "sm:grid-cols-2",
}: {
  items: EventMedia[];
  title: string;
  /** The page these files belong to, e.g. "/events/<id>". Shared links add ?m=<file id>. */
  pageUrl: string;
  /** A file to open straight away, used when someone follows a shared link. */
  initialOpenId?: string;
  columns?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const index = openId ? items.findIndex((m) => m.id === openId) : -1;

  if (items.length === 0) return null;

  return (
    <>
      <ul className={`grid gap-4 ${columns}`}>
        {items.map((m) => (
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
          items={items}
          index={index}
          title={title}
          shareUrl={(m) => `${window.location.origin}${pageUrl}?m=${m.id}`}
          onIndexChange={(i) => setOpenId(items[i].id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}
