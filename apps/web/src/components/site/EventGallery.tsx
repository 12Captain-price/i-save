import { MediaGallery } from "@/components/site/MediaGallery";
import type { SiteEvent } from "@/lib/content";

/** Every picture, video and flier of an event. Tapping one opens the viewer. */
export function EventGallery({
  event,
  initialOpenId,
}: {
  event: SiteEvent;
  /** A file to open straight away, used when someone follows a shared link. */
  initialOpenId?: string;
}) {
  if (event.images.length === 0) return null;
  return (
    <div className="mt-10">
      <MediaGallery
        items={event.images}
        title={event.title}
        pageUrl={`/events/${event.id}`}
        initialOpenId={initialOpenId}
      />
    </div>
  );
}
